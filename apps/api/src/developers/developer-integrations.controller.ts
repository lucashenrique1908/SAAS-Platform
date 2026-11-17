import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { RequireModulePermissions } from '../auth/decorators/authorization.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { OrganizationAccessGuard } from '../auth/guards/organization-access.guard.js';
import { DeveloperModuleAccessGuard } from './guards/developer-module-access.guard.js';
import type { DeveloperIntegrationProvider } from './developer-integration.entity.js';
import { RepositoryImportDto } from './dto/repository-import.dto.js';
import { DeveloperIntegrationsService } from './developer-integrations.service.js';

function integrationProvider(value: string): DeveloperIntegrationProvider {
  if (value === 'github' || value === 'linkedin' || value === 'google_calendar')
    return value;
  throw new BadRequestException('Unknown integration provider.');
}

@Controller('organizations/:slug/developer/integrations')
@UseGuards(OrganizationAccessGuard, DeveloperModuleAccessGuard)
export class DeveloperIntegrationsController {
  constructor(private readonly integrations: DeveloperIntegrationsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.integrations.list(
      request.organization!.id,
      request.authUser!.id,
    );
  }

  @Post(':provider/connect')
  @RequireModulePermissions('developer:write')
  connect(
    @Req() request: AuthenticatedRequest,
    @Param('provider') provider: string,
  ) {
    return this.integrations.startOAuth(
      integrationProvider(provider),
      request.organization!.id,
      request.authUser!.id,
    );
  }

  @Delete(':provider')
  @RequireModulePermissions('developer:write')
  disconnect(
    @Req() request: AuthenticatedRequest,
    @Param('provider') provider: string,
  ) {
    return this.integrations.disconnect(
      request.organization!.id,
      request.authUser!.id,
      integrationProvider(provider),
    );
  }

  @Get('github/repositories')
  repositories(@Req() request: AuthenticatedRequest) {
    return this.integrations.githubRepositories(
      request.organization!.id,
      request.authUser!.id,
    );
  }

  @Get('google_calendar/events')
  events(
    @Req() request: AuthenticatedRequest,
    @Query('timeMin') timeMin?: string,
    @Query('timeMax') timeMax?: string,
  ) {
    return this.integrations.googleEvents(
      request.organization!.id,
      request.authUser!.id,
      timeMin,
      timeMax,
    );
  }

  @Post('google_calendar/events')
  @RequireModulePermissions('developer:write')
  createEvent(
    @Req() request: AuthenticatedRequest,
    @Body()
    body: {
      summary: unknown;
      description?: unknown;
      start?: unknown;
      end?: unknown;
      timeZone?: unknown;
      idempotencyKey?: unknown;
    },
  ) {
    const idempotencyKey =
      typeof body.idempotencyKey === 'string' &&
      /^[A-Za-z0-9_-]{1,120}$/.test(body.idempotencyKey)
        ? body.idempotencyKey
        : '';
    if (!idempotencyKey)
      throw new BadRequestException('A valid idempotencyKey is required.');
    return this.integrations.createGoogleEvent(
      request.organization!.id,
      request.authUser!.id,
      { ...body, idempotencyKey },
    );
  }

  @Patch('google_calendar/events/:eventId')
  @RequireModulePermissions('developer:write')
  updateEvent(
    @Req() request: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Body() body: { summary: unknown; description?: unknown },
  ) {
    return this.integrations.updateGoogleEvent(
      request.organization!.id,
      request.authUser!.id,
      eventId,
      body,
    );
  }

  @Delete('google_calendar/events/:eventId')
  @RequireModulePermissions('developer:write')
  deleteEvent(
    @Req() request: AuthenticatedRequest,
    @Param('eventId') eventId: string,
  ) {
    return this.integrations.deleteGoogleEvent(
      request.organization!.id,
      request.authUser!.id,
      eventId,
    );
  }

  @Post('github/import-preview')
  @RequireModulePermissions('developer:write')
  importPreview(
    @Req() request: AuthenticatedRequest,
    @Body() body: RepositoryImportDto,
  ) {
    return this.integrations.importGithubRepository(
      request.organization!.id,
      request.authUser!.id,
      body.repositoryUrl,
    );
  }
}

@Controller('integrations/oauth')
export class DeveloperOAuthCallbackController {
  constructor(private readonly integrations: DeveloperIntegrationsService) {}

  @Get(':provider/callback')
  @Public()
  async callback(
    @Param('provider') rawProvider: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') providerError: string | undefined,
    @Res() response: Response,
  ) {
    const provider = integrationProvider(rawProvider);
    if (providerError || !code || !state) {
      return response.redirect(
        303,
        await this.integrations.frontendFailureUrl(provider, state),
      );
    }
    try {
      const destination = await this.integrations.completeOAuth(
        provider,
        code,
        state,
      );
      return response.redirect(303, destination);
    } catch {
      return response.redirect(
        303,
        await this.integrations.frontendFailureUrl(provider, state),
      );
    }
  }
}
