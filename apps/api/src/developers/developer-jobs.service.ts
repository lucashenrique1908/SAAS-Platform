import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DeveloperJobsService {
  constructor(private readonly config: ConfigService) {}
  async search(input: {
    query?: string;
    location?: string;
    country?: string;
    page?: number;
    remote?: string;
    workplace?: string;
  }) {
    const appId = this.config.get<string>('ADZUNA_APP_ID');
    const appKey = this.config.get<string>('ADZUNA_APP_KEY');
    const commercialLicenseConfirmed = this.config.get<string>(
      'ADZUNA_COMMERCIAL_LICENSE_CONFIRMED',
    );
    const attributionLogoUrl = this.config.get<string>(
      'ADZUNA_ATTRIBUTION_LOGO_URL',
    );
    const country = (input.country || 'gb').toLowerCase();
    if (
      process.env.NODE_ENV === 'production' &&
      (commercialLicenseConfirmed !== 'true' || !attributionLogoUrl)
    )
      throw new ServiceUnavailableException(
        'Live job search requires an Adzuna commercial licence and attribution logo configuration.',
      );
    if (!attributionLogoUrl) {
      throw new ServiceUnavailableException(
        'Adzuna attribution logo is not configured.',
      );
    }
    try {
      if (new URL(attributionLogoUrl).protocol !== 'https:') throw new Error();
    } catch {
      throw new ServiceUnavailableException(
        'Adzuna attribution logo must use HTTPS.',
      );
    }
    if (!appId || !appKey)
      throw new ServiceUnavailableException(
        'Live job search is not configured. Configure Adzuna credentials.',
      );
    if (!/^[a-z]{2}$/.test(country))
      throw new BadRequestException('Country must be an ISO two-letter code.');
    if (
      input.query !== undefined &&
      (typeof input.query !== 'string' || input.query.length > 120)
    )
      throw new BadRequestException(
        'Keyword search is limited to 120 characters.',
      );
    if (
      input.location !== undefined &&
      (typeof input.location !== 'string' || input.location.length > 120)
    )
      throw new BadRequestException('Location is limited to 120 characters.');
    if (
      input.workplace !== undefined &&
      !['remote', 'hybrid', 'onsite'].includes(input.workplace)
    )
      throw new BadRequestException('Unknown workplace filter.');
    const page = Math.min(
      50,
      Math.max(1, Number.isInteger(input.page) ? input.page! : 1),
    );
    const url = new URL(
      `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`,
    );
    url.searchParams.set('app_id', appId);
    url.searchParams.set('app_key', appKey);
    url.searchParams.set('content-type', 'application/json');
    url.searchParams.set('results_per_page', '20');
    if (input.query) url.searchParams.set('what', input.query.slice(0, 120));
    if (input.location)
      url.searchParams.set('where', input.location.slice(0, 120));
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ServiceUnavailableException(
        'Adzuna job search is temporarily unavailable.',
      );
    }
    if (!response.ok)
      throw new ServiceUnavailableException(
        'Adzuna job search is temporarily unavailable.',
      );
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ServiceUnavailableException(
        'Adzuna returned an invalid response.',
      );
    }
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('results' in payload) ||
      !Array.isArray(payload.results)
    )
      throw new ServiceUnavailableException(
        'Adzuna returned an invalid response.',
      );
    const resultPayload = payload as Record<string, unknown>;
    const jobs = (resultPayload.results as unknown[])
      .flatMap((value) => {
        if (typeof value !== 'object' || value === null) return [];
        const item = value as Record<string, unknown>;
        const company = item.company as Record<string, unknown> | undefined;
        const location = item.location as Record<string, unknown> | undefined;
        if (
          typeof item.title !== 'string' ||
          typeof item.redirect_url !== 'string' ||
          typeof item.description !== 'string' ||
          (typeof item.id !== 'string' && typeof item.id !== 'number')
        )
          return [];
        try {
          if (new URL(item.redirect_url).protocol !== 'https:') return [];
        } catch {
          return [];
        }
        const description = item.description;
        const workplaceText = `${item.title} ${description} ${typeof location?.display_name === 'string' ? location.display_name : ''}`;
        const workplaceType =
          /\b(remote|work from home|home based|telecommut(?:e|ing))\b/i.test(
            workplaceText,
          )
            ? 'remote'
            : /\b(hybrid|partly remote|part[- ]time office)\b/i.test(
                  workplaceText,
                )
              ? 'hybrid'
              : /\b(on[- ]?site|office based|in[- ]person)\b/i.test(
                    workplaceText,
                  )
                ? 'onsite'
                : 'unknown';
        return [
          {
            id: String(item.id),
            title: item.title,
            company:
              typeof company?.display_name === 'string'
                ? company.display_name
                : 'Company not provided',
            location:
              typeof location?.display_name === 'string'
                ? location.display_name
                : '',
            description,
            url: item.redirect_url,
            createdAt: typeof item.created === 'string' ? item.created : null,
            source: 'Adzuna',
            workplace: workplaceType,
            workplaceClassification: 'text_match',
          },
        ];
      })
      .filter((job) => {
        const workplace =
          input.workplace ?? (input.remote === 'true' ? 'remote' : undefined);
        return !workplace || job.workplace === workplace;
      });
    return {
      page,
      total:
        typeof resultPayload.count === 'number'
          ? resultPayload.count
          : jobs.length,
      source: 'Adzuna',
      sourceUrl:
        country === 'gb'
          ? 'https://www.adzuna.co.uk/'
          : country === 'au'
            ? 'https://www.adzuna.com.au/'
            : 'https://www.adzuna.com/',
      attributionLogoUrl: attributionLogoUrl ?? null,
      retrievedAt: new Date().toISOString(),
      jobs,
    };
  }
}
