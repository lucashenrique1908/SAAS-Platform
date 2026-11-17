import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, LessThan, MoreThan, Repository } from 'typeorm';
import { Organization } from '../organizations/organization.entity.js';
import {
  DeveloperIntegration,
  type DeveloperIntegrationProvider,
} from './developer-integration.entity.js';
import { DeveloperOAuthState } from './developer-oauth-state.entity.js';
import {
  decryptDeveloperToken,
  encryptDeveloperToken,
} from './developer-token-crypto.js';

type OAuthTokenResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  scope?: unknown;
  token_type?: unknown;
};
type ProviderIdentity = { id: string; displayName: string | null };
type GithubRepository = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  topics?: string[];
  private: boolean;
  archived: boolean;
  updated_at: string;
};

@Injectable()
export class DeveloperIntegrationsService {
  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(DeveloperIntegration)
    private readonly integrations: Repository<DeveloperIntegration>,
    @InjectRepository(DeveloperOAuthState)
    private readonly states: Repository<DeveloperOAuthState>,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
  ) {}

  async list(organizationId: string, userId: string) {
    const rows = await this.integrations.find({
      where: { organizationId, userId },
      select: {
        provider: true,
        providerDisplayName: true,
        accessExpiresAt: true,
        scopes: true,
        updatedAt: true,
      },
    });
    return (['github', 'linkedin', 'google_calendar'] as const).map(
      (provider) => {
        const connection = rows.find((row) => row.provider === provider);
        return {
          provider,
          connected: Boolean(connection),
          accountName: connection?.providerDisplayName ?? null,
          scopes: connection?.scopes ?? [],
          updatedAt: connection?.updatedAt ?? null,
        };
      },
    );
  }

  async startOAuth(
    provider: DeveloperIntegrationProvider,
    organizationId: string,
    userId: string,
  ) {
    this.assertProviderConfigured(provider);
    await this.states.delete({ expiresAt: LessThan(new Date()) });
    const rawState = randomBytes(32).toString('base64url');
    const stateHash = createHash('sha256').update(rawState).digest('hex');
    await this.states.save(
      this.states.create({
        stateHash,
        provider,
        userId,
        organizationId,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        consumedAt: null,
      }),
    );
    const redirectUri = this.callbackUri(provider);
    const clientId = this.config.getOrThrow<string>(this.clientIdKey(provider));
    const url = new URL(this.authorizationEndpoint(provider));
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', rawState);
    if (provider === 'github') {
      url.searchParams.set('scope', 'read:user');
      url.searchParams.set('allow_signup', 'false');
    } else if (provider === 'google_calendar') {
      url.searchParams.set('response_type', 'code');
      url.searchParams.set(
        'scope',
        'openid email profile https://www.googleapis.com/auth/calendar.events.owned',
      );
      url.searchParams.set('access_type', 'offline');
      url.searchParams.set('prompt', 'consent');
    } else {
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'openid profile email');
    }
    return { authorizationUrl: url.toString() };
  }

  async completeOAuth(
    provider: DeveloperIntegrationProvider,
    code: string,
    rawState: string,
  ) {
    if (
      !/^[A-Za-z0-9_-]{40,100}$/.test(rawState) ||
      code.length < 1 ||
      code.length > 2048
    ) {
      throw new BadRequestException('The OAuth callback is invalid.');
    }
    const stateHash = createHash('sha256').update(rawState).digest('hex');
    const state = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(DeveloperOAuthState);
      const row = await repository.findOne({
        where: {
          stateHash,
          provider,
          consumedAt: IsNull(),
          expiresAt: MoreThan(new Date()),
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row)
        throw new BadRequestException('The OAuth state is invalid or expired.');
      row.consumedAt = new Date();
      await repository.save(row);
      return row;
    });
    const organization = await this.organizations.findOne({
      where: { id: state.organizationId, isActive: true },
    });
    if (!organization)
      throw new BadRequestException('The organization is no longer available.');
    const token = await this.exchangeCode(provider, code);
    const identity = await this.fetchIdentity(
      provider,
      token.access_token as string,
    );
    const key = this.config.get<string>('DEVELOPER_TOKEN_ENCRYPTION_KEY');
    const encryptedAccess = encryptDeveloperToken(
      token.access_token as string,
      key,
    );
    const encryptedRefresh =
      typeof token.refresh_token === 'string'
        ? encryptDeveloperToken(token.refresh_token, key)
        : null;
    const scopes =
      typeof token.scope === 'string'
        ? token.scope.split(/[ ,]+/).filter(Boolean)
        : this.scopesFor(provider);
    const expiresAt =
      typeof token.expires_in === 'number'
        ? new Date(Date.now() + token.expires_in * 1000)
        : null;
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(DeveloperIntegration);
      let row = await repository.findOne({
        where: {
          provider,
          userId: state.userId,
          organizationId: state.organizationId,
        },
      });
      if (!row)
        row = repository.create({
          provider,
          userId: state.userId,
          organizationId: state.organizationId,
        });
      Object.assign(row, {
        providerAccountId: identity.id,
        providerDisplayName: identity.displayName,
        accessTokenEncrypted: encryptedAccess,
        refreshTokenEncrypted: encryptedRefresh,
        accessExpiresAt: expiresAt,
        scopes,
      });
      await repository.save(row);
    });
    return this.frontendResultUrl(organization.slug, provider, 'connected');
  }

  async githubRepositories(organizationId: string, userId: string) {
    const connection = await this.findConnection(
      organizationId,
      userId,
      'github',
    );
    const token = await this.accessToken(connection);
    const response = await fetch(
      'https://api.github.com/user/repos?visibility=public&affiliation=owner&sort=updated&per_page=100',
      {
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/vnd.github+json',
          'x-github-api-version': '2022-11-28',
        },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (response.status === 403 || response.status === 429)
      throw new ServiceUnavailableException(
        'GitHub rate limit reached. Try again later.',
      );
    if (!response.ok)
      throw new ServiceUnavailableException(
        'GitHub repositories are unavailable.',
      );
    const payload: unknown = await response.json();
    if (!Array.isArray(payload))
      throw new ServiceUnavailableException(
        'GitHub returned an invalid repository list.',
      );
    return payload
      .filter(
        (item): item is GithubRepository =>
          typeof item === 'object' &&
          item !== null &&
          'private' in item &&
          item.private === false,
      )
      .map(
        ({
          id,
          name,
          full_name,
          description,
          html_url,
          homepage,
          language,
          topics,
          archived,
          updated_at,
        }) => ({
          id,
          name,
          fullName: full_name,
          description,
          repositoryUrl: html_url,
          homepage,
          language,
          topics: topics ?? [],
          archived,
          updatedAt: updated_at,
        }),
      );
  }

  async importGithubRepository(
    organizationId: string,
    userId: string,
    repositoryUrl: string,
  ) {
    const repositories = await this.githubRepositories(organizationId, userId);
    const repository = repositories.find(
      (item) => item.repositoryUrl === repositoryUrl,
    );
    if (!repository)
      throw new NotFoundException(
        'This public repository is unavailable or was not selected from your account.',
      );
    return {
      name: repository.name,
      description:
        repository.description ??
        `Public GitHub repository ${repository.fullName}`,
      technologies: [
        ...new Set(
          [repository.language, ...repository.topics].filter(
            (value): value is string => Boolean(value),
          ),
        ),
      ],
      repositoryUrl: repository.repositoryUrl,
      liveUrl: repository.homepage,
      status: repository.archived ? 'archived' : 'in_progress',
      projectType: 'individual',
    };
  }

  async googleEvents(
    organizationId: string,
    userId: string,
    timeMin?: string,
    timeMax?: string,
  ) {
    if (
      (timeMin && !Number.isFinite(Date.parse(timeMin))) ||
      (timeMax && !Number.isFinite(Date.parse(timeMax)))
    )
      throw new BadRequestException('Invalid calendar time range.');
    const row = await this.findConnection(
      organizationId,
      userId,
      'google_calendar',
    );
    const token = await this.accessToken(row);
    const url = new URL(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    );
    if (timeMin && Number.isFinite(Date.parse(timeMin)))
      url.searchParams.set('timeMin', timeMin);
    if (timeMax && Number.isFinite(Date.parse(timeMax)))
      url.searchParams.set('timeMax', timeMax);
    url.searchParams.set('maxResults', '100');
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok)
      throw new ServiceUnavailableException(
        'Google Calendar events are unavailable.',
      );
    const value: unknown = await response.json();
    if (
      typeof value !== 'object' ||
      value === null ||
      !('items' in value) ||
      !Array.isArray(value.items)
    )
      throw new ServiceUnavailableException(
        'Google Calendar returned an invalid event list.',
      );
    return value.items;
  }

  async createGoogleEvent(
    organizationId: string,
    userId: string,
    input: {
      summary: unknown;
      description?: unknown;
      start?: unknown;
      end?: unknown;
      timeZone?: unknown;
      idempotencyKey: string;
    },
  ) {
    if (
      typeof input.summary !== 'string' ||
      !input.summary.trim() ||
      input.summary.length > 200 ||
      typeof input.start !== 'string' ||
      !Number.isFinite(Date.parse(input.start)) ||
      typeof input.end !== 'string' ||
      !Number.isFinite(Date.parse(input.end)) ||
      Date.parse(input.end) <= Date.parse(input.start)
    )
      throw new BadRequestException(
        'A valid title, start and end time are required.',
      );
    if (
      input.description !== undefined &&
      (typeof input.description !== 'string' || input.description.length > 2000)
    )
      throw new BadRequestException('Invalid event description.');
    const timeZone =
      typeof input.timeZone === 'string' &&
      /^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)+$/.test(input.timeZone)
        ? input.timeZone
        : 'UTC';
    const row = await this.findConnection(
      organizationId,
      userId,
      'google_calendar',
    );
    const token = await this.accessToken(row);
    const id = createHash('sha256')
      .update(`${row.id}:${input.idempotencyKey}`)
      .digest('hex');
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          id,
          summary: input.summary.trim(),
          description: input.description,
          start: { dateTime: input.start, timeZone },
          end: { dateTime: input.end, timeZone },
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (response.status === 409) return { id, duplicate: true };
    if (!response.ok)
      throw new ServiceUnavailableException(
        'Google Calendar event could not be created.',
      );
    return response.json();
  }

  async updateGoogleEvent(
    organizationId: string,
    userId: string,
    eventId: string,
    input: { summary: unknown; description?: unknown },
  ) {
    if (
      !/^[A-Za-z0-9_@.-]{1,1024}$/.test(eventId) ||
      typeof input.summary !== 'string' ||
      !input.summary.trim() ||
      input.summary.length > 200 ||
      (input.description !== undefined &&
        (typeof input.description !== 'string' ||
          input.description.length > 2000))
    )
      throw new BadRequestException('Invalid event update.');
    const row = await this.findConnection(
      organizationId,
      userId,
      'google_calendar',
    );
    const token = await this.accessToken(row);
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
      {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          summary: input.summary.trim(),
          description: input.description,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok)
      throw new ServiceUnavailableException(
        'Google Calendar event could not be updated.',
      );
    return response.json();
  }

  async deleteGoogleEvent(
    organizationId: string,
    userId: string,
    eventId: string,
  ) {
    if (!/^[A-Za-z0-9_@.-]{1,1024}$/.test(eventId))
      throw new BadRequestException('Invalid calendar event ID.');
    const row = await this.findConnection(
      organizationId,
      userId,
      'google_calendar',
    );
    const token = await this.accessToken(row);
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok && response.status !== 404)
      throw new ServiceUnavailableException(
        'Google Calendar event could not be deleted.',
      );
    return { success: true };
  }

  async disconnect(
    organizationId: string,
    userId: string,
    provider: DeveloperIntegrationProvider,
  ) {
    const row = await this.findConnection(organizationId, userId, provider);
    try {
      await this.revokeRemotelyIfSupported(provider, row);
    } catch {
      // Local disconnect remains available when a token expired or a provider is offline.
    }
    await this.integrations.delete({ id: row.id });
    return { success: true };
  }

  async frontendFailureUrl(
    provider: DeveloperIntegrationProvider,
    rawState?: string,
  ) {
    if (rawState && /^[A-Za-z0-9_-]{40,100}$/.test(rawState)) {
      const stateHash = createHash('sha256').update(rawState).digest('hex');
      const row = await this.states.findOne({ where: { stateHash, provider } });
      if (row) {
        await this.states.delete({ id: row.id });
        const organization = await this.organizations.findOne({
          where: { id: row.organizationId },
        });
        if (organization) {
          const url = new URL(
            `/workspace/${encodeURIComponent(organization.slug)}/developer/integrations`,
            this.config.getOrThrow<string>('FRONTEND_BASE_URL'),
          );
          url.searchParams.set('result', 'failed');
          return url.toString();
        }
      }
    }
    const url = new URL(
      '/',
      this.config.getOrThrow<string>('FRONTEND_BASE_URL'),
    );
    url.searchParams.set('integration', `${provider}-failed`);
    return url.toString();
  }

  private async findConnection(
    organizationId: string,
    userId: string,
    provider: DeveloperIntegrationProvider,
  ) {
    const row = await this.integrations.findOne({
      where: { organizationId, userId, provider },
      select: {
        id: true,
        provider: true,
        providerAccountId: true,
        accessTokenEncrypted: true,
        refreshTokenEncrypted: true,
        accessExpiresAt: true,
        scopes: true,
      },
    });
    if (!row) throw new NotFoundException(`${provider} is not connected.`);
    return row;
  }

  private async accessToken(row: DeveloperIntegration): Promise<string> {
    const key = this.config.get<string>('DEVELOPER_TOKEN_ENCRYPTION_KEY');
    if (
      !row.accessExpiresAt ||
      row.accessExpiresAt.getTime() > Date.now() + 60_000
    ) {
      return decryptDeveloperToken(row.accessTokenEncrypted, key);
    }
    if (!row.refreshTokenEncrypted) {
      throw new ServiceUnavailableException(
        'The integration token expired. Reconnect the provider.',
      );
    }
    const refreshToken = decryptDeveloperToken(row.refreshTokenEncrypted, key);
    const body = new URLSearchParams({
      client_id: this.config.getOrThrow<string>(this.clientIdKey(row.provider)),
      client_secret: this.config.getOrThrow<string>(
        this.clientSecretKey(row.provider),
      ),
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    let payload: Record<string, unknown>;
    try {
      payload = await this.consumeJson(
        await fetch(this.tokenEndpoint(row.provider), {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/x-www-form-urlencoded',
          },
          body,
          signal: AbortSignal.timeout(10_000),
        }),
      );
    } catch {
      throw new ServiceUnavailableException(
        'The integration token could not be refreshed. Reconnect the provider.',
      );
    }
    if (typeof payload.access_token !== 'string') {
      throw new ServiceUnavailableException(
        'The integration token could not be refreshed. Reconnect the provider.',
      );
    }
    row.accessTokenEncrypted = encryptDeveloperToken(payload.access_token, key);
    if (typeof payload.refresh_token === 'string') {
      row.refreshTokenEncrypted = encryptDeveloperToken(
        payload.refresh_token,
        key,
      );
    }
    if (typeof payload.expires_in === 'number') {
      row.accessExpiresAt = new Date(Date.now() + payload.expires_in * 1000);
    }
    if (typeof payload.scope === 'string')
      row.scopes = payload.scope.split(/[ ,]+/).filter(Boolean);
    await this.integrations.save(row);
    return payload.access_token;
  }

  private async consumeJson(
    response: Response,
  ): Promise<Record<string, unknown>> {
    if (!response.ok)
      throw new ServiceUnavailableException(
        'The external provider is unavailable.',
      );
    const value: unknown = await response.json();
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      throw new ServiceUnavailableException(
        'The external provider returned an invalid response.',
      );
    return value as Record<string, unknown>;
  }

  private async exchangeCode(
    provider: DeveloperIntegrationProvider,
    code: string,
  ): Promise<OAuthTokenResponse> {
    const body = new URLSearchParams({
      client_id: this.config.getOrThrow<string>(this.clientIdKey(provider)),
      client_secret: this.config.getOrThrow<string>(
        this.clientSecretKey(provider),
      ),
      code,
      redirect_uri: this.callbackUri(provider),
    });
    const response = await fetch(this.tokenEndpoint(provider), {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await this.consumeJson(response);
    if (typeof payload.access_token !== 'string')
      throw new ServiceUnavailableException(
        'The external provider did not return an access token.',
      );
    return payload as OAuthTokenResponse;
  }

  private async fetchIdentity(
    provider: DeveloperIntegrationProvider,
    token: string,
  ): Promise<ProviderIdentity> {
    const endpoint =
      provider === 'github'
        ? 'https://api.github.com/user'
        : provider === 'linkedin'
          ? 'https://api.linkedin.com/v2/userinfo'
          : 'https://openidconnect.googleapis.com/v1/userinfo';
    const headers: Record<string, string> = {
      authorization: `Bearer ${token}`,
      accept: 'application/json',
    };
    if (provider === 'github') headers['x-github-api-version'] = '2022-11-28';
    const payload = await this.consumeJson(
      await fetch(endpoint, { headers, signal: AbortSignal.timeout(10_000) }),
    );
    const id = provider === 'github' ? payload.id : payload.sub;
    if (typeof id !== 'string' && typeof id !== 'number')
      throw new ServiceUnavailableException(
        'The provider identity is invalid.',
      );
    const displayName =
      provider === 'github'
        ? typeof payload.name === 'string'
          ? payload.name
          : typeof payload.login === 'string'
            ? payload.login
            : null
        : typeof payload.name === 'string'
          ? payload.name
          : null;
    return { id: String(id), displayName };
  }

  private async revokeRemotelyIfSupported(
    provider: DeveloperIntegrationProvider,
    row: DeveloperIntegration,
  ) {
    try {
      const token = await this.accessToken(row);
      if (provider === 'google_calendar') {
        await fetch('https://oauth2.googleapis.com/revoke', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token }),
          signal: AbortSignal.timeout(5_000),
        });
      } else if (
        provider === 'github' &&
        this.config.get<string>('GITHUB_CLIENT_SECRET')
      ) {
        const clientId = this.config.get<string>('GITHUB_CLIENT_ID') ?? '';
        await fetch(
          `https://api.github.com/applications/${encodeURIComponent(clientId)}/grant`,
          {
            method: 'DELETE',
            headers: {
              authorization: `Basic ${Buffer.from(`${clientId}:${this.config.get<string>('GITHUB_CLIENT_SECRET')}`).toString('base64')}`,
              accept: 'application/vnd.github+json',
              'content-type': 'application/json',
            },
            body: JSON.stringify({ access_token: token }),
            signal: AbortSignal.timeout(5_000),
          },
        );
      }
    } catch {
      // Local credential deletion still disconnects the account; providers may require manual revocation if offline.
    }
  }

  private assertProviderConfigured(provider: DeveloperIntegrationProvider) {
    this.config.getOrThrow<string>(this.clientIdKey(provider));
    this.config.getOrThrow<string>(this.clientSecretKey(provider));
    encryptDeveloperToken(
      'configuration-check',
      this.config.get<string>('DEVELOPER_TOKEN_ENCRYPTION_KEY'),
    );
    this.config.getOrThrow<string>('API_PUBLIC_BASE_URL');
  }

  private clientIdKey(provider: DeveloperIntegrationProvider) {
    return provider === 'github'
      ? 'GITHUB_CLIENT_ID'
      : provider === 'google_calendar'
        ? 'GOOGLE_CLIENT_ID'
        : 'LINKEDIN_CLIENT_ID';
  }

  private clientSecretKey(provider: DeveloperIntegrationProvider) {
    return provider === 'github'
      ? 'GITHUB_CLIENT_SECRET'
      : provider === 'google_calendar'
        ? 'GOOGLE_CLIENT_SECRET'
        : 'LINKEDIN_CLIENT_SECRET';
  }

  private authorizationEndpoint(provider: DeveloperIntegrationProvider) {
    return provider === 'github'
      ? 'https://github.com/login/oauth/authorize'
      : provider === 'google_calendar'
        ? 'https://accounts.google.com/o/oauth2/v2/auth'
        : 'https://www.linkedin.com/oauth/v2/authorization';
  }

  private tokenEndpoint(provider: DeveloperIntegrationProvider) {
    return provider === 'github'
      ? 'https://github.com/login/oauth/access_token'
      : provider === 'google_calendar'
        ? 'https://oauth2.googleapis.com/token'
        : 'https://www.linkedin.com/oauth/v2/accessToken';
  }

  private callbackUri(provider: DeveloperIntegrationProvider) {
    const url = new URL(
      `/integrations/oauth/${provider}/callback`,
      this.config.getOrThrow<string>('API_PUBLIC_BASE_URL'),
    );
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')
    ) {
      throw new ServiceUnavailableException(
        'The OAuth callback URL is not configured securely.',
      );
    }
    return url.toString();
  }

  private scopesFor(provider: DeveloperIntegrationProvider) {
    return provider === 'github'
      ? ['read:user']
      : provider === 'google_calendar'
        ? [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/calendar.events.owned',
          ]
        : ['openid', 'profile', 'email'];
  }

  private frontendResultUrl(
    slug: string,
    provider: DeveloperIntegrationProvider,
    result: string,
  ) {
    const url = new URL(
      `/workspace/${encodeURIComponent(slug)}/developer/integrations`,
      this.config.getOrThrow<string>('FRONTEND_BASE_URL'),
    );
    url.searchParams.set('provider', provider);
    url.searchParams.set('result', result);
    return url.toString();
  }
}
