import { afterEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DeveloperRoadmapsService } from './developer-roadmaps.service.js';
import {
  decryptDeveloperToken,
  encryptDeveloperToken,
} from './developer-token-crypto.js';
import { DeveloperRoadmaps1763300000000 } from '../database/migrations/1763300000000-DeveloperRoadmaps.js';
import { DeveloperModuleAccessGuard } from './guards/developer-module-access.guard.js';
import { ForbiddenException } from '@nestjs/common';
import { DeveloperJobsService } from './developer-jobs.service.js';
import { DeveloperIntegrationsService } from './developer-integrations.service.js';
import { DevelopersService } from './developers.service.js';
import { DeveloperPrivacyControls1763500000000 } from '../database/migrations/1763500000000-DeveloperPrivacyControls.js';

const key = Buffer.alloc(32, 7).toString('base64');

describe('developer token encryption', () => {
  it('encrypts tokens with authenticated encryption and round-trips them', () => {
    const encrypted = encryptDeveloperToken('provider-token', key);
    expect(encrypted).not.toContain('provider-token');
    expect(decryptDeveloperToken(encrypted, key)).toBe('provider-token');
  });

  it('rejects ciphertext tampering and invalid key sizes', () => {
    const encrypted = encryptDeveloperToken('provider-token', key);
    expect(() =>
      decryptDeveloperToken(`${encrypted.slice(0, -2)}aa`, key),
    ).toThrow();
    expect(() => encryptDeveloperToken('provider-token', 'short')).toThrow();
  });
});

describe('developer roadmap ownership and validation', () => {
  const ownProfile = {
    findOne: vi.fn().mockResolvedValue({ id: 'profile-a' }),
  };
  const rows = {
    find: vi.fn().mockResolvedValue([]),
    create: vi.fn((value) => value),
    save: vi.fn(async (value) => ({ id: 'roadmap-a', ...value })),
    findOne: vi.fn(),
    delete: vi.fn(),
  };
  const service = new DeveloperRoadmapsService(
    ownProfile as never,
    rows as never,
  );

  it('creates a manual roadmap scoped to the caller profile', async () => {
    await service.create('org-a', 'user-a', 'Learn TypeScript');
    expect(rows.create).toHaveBeenCalledWith({
      profileId: 'profile-a',
      goal: 'Learn TypeScript',
      items: [],
    });
  });

  it('rejects updates to a roadmap outside the caller profile', async () => {
    rows.findOne.mockResolvedValueOnce(null);
    await expect(
      service.update('org-a', 'user-a', 'foreign-id', 'Goal', []),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(rows.findOne).toHaveBeenCalledWith({
      where: { id: 'foreign-id', profileId: 'profile-a' },
    });
  });

  it('rejects unsafe AI/manual resource links', async () => {
    rows.findOne.mockResolvedValueOnce({
      id: 'roadmap-a',
      profileId: 'profile-a',
      goal: 'Goal',
      items: [],
    });
    await expect(
      service.update('org-a', 'user-a', 'roadmap-a', 'Goal', [
        {
          id: 'i',
          title: 'Task',
          description: '',
          completed: false,
          resourceUrl: 'javascript:alert(1)',
        },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not expose a profile when no organization-owned profile exists', async () => {
    ownProfile.findOne.mockResolvedValueOnce(null);
    await expect(service.list('org-b', 'user-b')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(ownProfile.findOne).toHaveBeenLastCalledWith({
      where: { organizationId: 'org-b', userId: 'user-b' },
      select: { id: true },
    });
  });
});

describe('developer roadmap migration', () => {
  it('creates organization-owned roadmap storage and drops only its own structures on rollback', async () => {
    const sql: string[] = [];
    const runner = {
      query: vi.fn(async (statement: string) => {
        sql.push(statement);
      }),
    };
    const migration = new DeveloperRoadmaps1763300000000();
    await migration.up(runner as never);
    expect(sql.join('\n')).toContain(
      'REFERENCES "developer_profiles"("id") ON DELETE CASCADE',
    );
    expect(sql.join('\n')).toContain('"items" jsonb NOT NULL DEFAULT');
    sql.length = 0;
    await migration.down(runner as never);
    expect(sql.join('\n')).toContain('DROP TABLE "developer_roadmaps"');
    expect(sql.join('\n')).not.toContain('DROP TABLE "developer_profiles"');
  });
});

describe('developer module access guard', () => {
  function context(role: string, permissions: string[]) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          organization: { id: 'org-a' },
          organizationMembership: { role, permissions },
        }),
      }),
    } as never;
  }

  it('denies access when the organization module is disabled', async () => {
    const modules = { findOne: vi.fn().mockResolvedValue(null) };
    const guard = new DeveloperModuleAccessGuard(modules as never);
    await expect(
      guard.canActivate(context('owner', [])),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires a developer permission for members but allows organization admins', async () => {
    const modules = { findOne: vi.fn().mockResolvedValue({ id: 'module-a' }) };
    const guard = new DeveloperModuleAccessGuard(modules as never);
    await expect(
      guard.canActivate(context('member', ['projects:read'])),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      guard.canActivate(context('member', ['developer:read'])),
    ).resolves.toBe(true);
    await expect(guard.canActivate(context('admin', []))).resolves.toBe(true);
  });
});

describe('developer public profile privacy', () => {
  it('returns only selected fields and projects explicitly marked public', async () => {
    const profiles = {
      findOne: vi.fn().mockResolvedValue({
        id: 'profile-a',
        publicId: 'public-a',
        organizationId: 'org-a',
        userId: 'user-a',
        displayName: 'Developer',
        title: 'Private title',
        biography: 'Private biography',
        location: 'Private location',
        yearsExperience: 8,
        availability: 'available',
        githubUrl: 'https://github.com/example',
        linkedinUrl: null,
        websiteUrl: null,
        photoFileId: null,
        publicFields: ['projects'],
      }),
    };
    const skills = { find: vi.fn().mockResolvedValue([]) };
    const experiences = { find: vi.fn().mockResolvedValue([]) };
    const education = { find: vi.fn().mockResolvedValue([]) };
    const certifications = { find: vi.fn().mockResolvedValue([]) };
    const projects = {
      find: vi
        .fn()
        .mockResolvedValue([
          { name: 'Public project', isPublic: true, technologies: [] },
        ]),
    };
    const organizations = {
      findOne: vi.fn().mockResolvedValue({ id: 'org-a' }),
    };
    const memberships = {
      findOne: vi.fn().mockResolvedValue({ id: 'membership-a' }),
    };
    const service = new DevelopersService(
      profiles as never,
      skills as never,
      experiences as never,
      education as never,
      certifications as never,
      projects as never,
      organizations as never,
      memberships as never,
    );

    const result = await service.getPublicProfile('public-a');

    expect(result).toMatchObject({
      displayName: 'Developer',
      title: null,
      biography: null,
      location: null,
      yearsExperience: null,
      availability: null,
      githubUrl: null,
      skills: [],
      experiences: [],
      education: [],
      certifications: [],
      projects: [{ name: 'Public project' }],
    });
    expect(projects.find).toHaveBeenCalledWith({
      where: { profileId: 'profile-a', isPublic: true },
      order: { isFeatured: 'DESC', displayOrder: 'ASC' },
    });
    expect(skills.find).not.toHaveBeenCalled();
    expect(experiences.find).not.toHaveBeenCalled();
    expect(education.find).not.toHaveBeenCalled();
    expect(certifications.find).not.toHaveBeenCalled();
  });
});

describe('developer discovery filters', () => {
  it('filters within the requested organization by language, location and experience', async () => {
    const builder = {
      select: vi.fn(),
      where: vi.fn(),
      andWhere: vi.fn(),
      orderBy: vi.fn(),
      skip: vi.fn(),
      take: vi.fn(),
      getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
    };
    builder.select.mockReturnValue(builder);
    builder.where.mockReturnValue(builder);
    builder.andWhere.mockReturnValue(builder);
    builder.orderBy.mockReturnValue(builder);
    builder.skip.mockReturnValue(builder);
    builder.take.mockReturnValue(builder);
    const profiles = {
      createQueryBuilder: vi.fn().mockReturnValue(builder),
    };
    const service = new DevelopersService(
      profiles as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.searchMembers('org-a', {
      language: 'Portuguese',
      location: 'Lisbon',
      minYearsExperience: 3,
      maxYearsExperience: 12,
    });

    expect(builder.where).toHaveBeenCalledWith(
      'profile.organizationId = :organizationId',
      { organizationId: 'org-a' },
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining("language.kind = 'language'"),
      { language: '%Portuguese%' },
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      'profile.location ILIKE :location',
      { location: '%Lisbon%' },
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      'profile.yearsExperience >= :minYearsExperience',
      { minYearsExperience: 3 },
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      'profile.yearsExperience <= :maxYearsExperience',
      { maxYearsExperience: 12 },
    );
  });

  it('rejects an inverted experience range before querying', async () => {
    const profiles = { createQueryBuilder: vi.fn() };
    const service = new DevelopersService(
      profiles as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.searchMembers('org-a', {
        minYearsExperience: 10,
        maxYearsExperience: 2,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(profiles.createQueryBuilder).not.toHaveBeenCalled();
  });
});

describe('developer privacy migration', () => {
  it('adds private-by-default profile and project visibility fields reversibly', async () => {
    const statements: string[] = [];
    const runner = {
      query: vi.fn(async (statement: string) => {
        statements.push(statement);
      }),
    };
    const migration = new DeveloperPrivacyControls1763500000000();

    await migration.up(runner as never);
    expect(statements.join('\n')).toContain('"public_fields" jsonb NOT NULL');
    expect(statements.join('\n')).toContain(
      '"is_public" boolean NOT NULL DEFAULT false',
    );

    statements.length = 0;
    await migration.down(runner as never);
    expect(statements.join('\n')).toContain('DROP COLUMN "public_fields"');
    expect(statements.join('\n')).toContain('DROP COLUMN "is_public"');
  });
});

describe('Adzuna job search adapter', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns a safe unavailable response when provider credentials are missing', async () => {
    const service = new DeveloperJobsService({ get: () => undefined } as never);
    await expect(service.search({ query: 'typescript' })).rejects.toMatchObject(
      {
        status: 503,
      },
    );
  });

  it('validates provider listings, applies workplace text matching and paginates', async () => {
    const config = {
      get: (key: string) =>
        ({
          ADZUNA_APP_ID: 'test-id',
          ADZUNA_APP_KEY: 'test-key',
          ADZUNA_ATTRIBUTION_LOGO_URL: 'https://assets.example/adzuna.png',
        })[key],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          count: 3,
          results: [
            {
              id: 'remote-id',
              title: 'Remote Engineer',
              redirect_url: 'https://jobs.example/1',
              description: 'Build web products remotely.',
              company: { display_name: 'Remote Co' },
              location: { display_name: 'UK' },
              created: '2026-01-01T00:00:00Z',
            },
            {
              id: 42,
              title: 'Developer',
              redirect_url: 'https://jobs.example/2',
              description: 'Hybrid role with office days.',
              company: { display_name: 'Hybrid Co' },
              location: { display_name: 'London' },
            },
            {
              id: 43,
              title: 'Bad URL',
              redirect_url: 'javascript:alert(1)',
              description: 'Remote',
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const service = new DeveloperJobsService(config as never);
    const result = await service.search({
      query: 'typescript',
      page: 2,
      workplace: 'hybrid',
    });
    expect(result.page).toBe(2);
    expect(result.attributionLogoUrl).toBe('https://assets.example/adzuna.png');
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]).toMatchObject({
      id: '42',
      workplace: 'hybrid',
      workplaceClassification: 'text_match',
      source: 'Adzuna',
    });
    const requested = new URL(fetchMock.mock.calls[0]![0] as URL);
    expect(requested.pathname).toContain('/search/2');
    expect(requested.searchParams.get('what')).toBe('typescript');
    expect(requested.searchParams.get('app_key')).toBe('test-key');
  });

  it('rejects an invalid workplace filter before calling the provider', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const service = new DeveloperJobsService({
      get: (key: string) =>
        ({
          ADZUNA_APP_ID: 'id',
          ADZUNA_APP_KEY: 'key',
          ADZUNA_ATTRIBUTION_LOGO_URL: 'https://assets.example/logo.png',
        })[key],
    } as never);
    await expect(
      service.search({ workplace: 'remote-ish' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not return provider listings without the required attribution asset', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const service = new DeveloperJobsService({
      get: (key: string) =>
        ({ ADZUNA_APP_ID: 'id', ADZUNA_APP_KEY: 'key' })[key],
    } as never);
    await expect(service.search({ query: 'developer' })).rejects.toMatchObject({
      status: 503,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('developer OAuth integration safety', () => {
  const encryptionKey = Buffer.alloc(32, 3).toString('base64');
  const getConfigValue = (key: string) =>
    ({
      GITHUB_CLIENT_ID: 'github-client-id',
      GITHUB_CLIENT_SECRET: 'github-client-secret',
      API_PUBLIC_BASE_URL: 'https://api.example.test',
      FRONTEND_BASE_URL: 'https://app.example.test',
      DEVELOPER_TOKEN_ENCRYPTION_KEY: encryptionKey,
    })[key];
  const config = {
    get: getConfigValue,
    getOrThrow: (key: string) => {
      const value = getConfigValue(key);
      if (!value) throw new Error(`Missing ${key}`);
      return value;
    },
  };

  it('creates a one-time OAuth state and requests only GitHub identity scope', async () => {
    const states = {
      delete: vi.fn(),
      create: vi.fn((value) => value),
      save: vi.fn(async (value) => value),
    };
    const service = new DeveloperIntegrationsService(
      config as never,
      {} as never,
      {} as never,
      states as never,
      {} as never,
    );
    const result = await service.startOAuth('github', 'org-a', 'user-a');
    const authorization = new URL(result.authorizationUrl);
    const savedState = states.save.mock.calls[0]![0] as {
      stateHash: string;
      provider: string;
      organizationId: string;
      userId: string;
    };
    const rawState = authorization.searchParams.get('state');
    expect(rawState).toBeTruthy();
    expect(savedState.stateHash).not.toBe(rawState);
    expect(savedState.stateHash).toHaveLength(64);
    expect(savedState).toMatchObject({
      provider: 'github',
      organizationId: 'org-a',
      userId: 'user-a',
    });
    expect(authorization.searchParams.get('scope')).toBe('read:user');
    expect(authorization.searchParams.get('client_secret')).toBeNull();
  });

  it('rejects a malformed OAuth state before touching the persistence layer', async () => {
    const dataSource = { transaction: vi.fn() };
    const service = new DeveloperIntegrationsService(
      config as never,
      dataSource as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.completeOAuth('github', 'code', 'bad-state'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('deletes local credentials even when remote revocation cannot decrypt an expired token', async () => {
    const integrations = {
      findOne: vi.fn().mockResolvedValue({
        id: 'integration-a',
        provider: 'github',
        providerAccountId: 'provider-user',
        accessTokenEncrypted: 'invalid-ciphertext',
        refreshTokenEncrypted: null,
        accessExpiresAt: null,
        scopes: ['read:user'],
      }),
      delete: vi.fn().mockResolvedValue({ affected: 1 }),
    };
    const service = new DeveloperIntegrationsService(
      config as never,
      {} as never,
      integrations as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.disconnect('org-a', 'user-a', 'github'),
    ).resolves.toEqual({ success: true });
    expect(integrations.delete).toHaveBeenCalledWith({ id: 'integration-a' });
  });
});
