import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { OrganizationAccessGuard } from '../auth/guards/organization-access.guard.js';
import { OrganizationModule } from '../organizations/organization-module.entity.js';
import { OrganizationMembership } from '../organizations/organization-membership.entity.js';
import { Organization } from '../organizations/organization.entity.js';
import { DeveloperProfile } from './developer-profile.entity.js';
import { DeveloperSkill } from './developer-skill.entity.js';
import { DeveloperExperience } from './developer-experience.entity.js';
import { DeveloperEducation } from './developer-education.entity.js';
import { DeveloperCertification } from './developer-certification.entity.js';
import { DeveloperProject } from './developer-project.entity.js';
import { DeveloperFile } from './developer-file.entity.js';
import { DeveloperModuleAccessGuard } from './guards/developer-module-access.guard.js';
import {
  DevelopersController,
  PublicDevelopersController,
} from './developers.controller.js';
import { DevelopersService } from './developers.service.js';
import { DeveloperFilesService } from './developer-files.service.js';
import { DeveloperIntegration } from './developer-integration.entity.js';
import { DeveloperOAuthState } from './developer-oauth-state.entity.js';
import { DeveloperRoadmap } from './developer-roadmap.entity.js';
import { DeveloperRoadmapsService } from './developer-roadmaps.service.js';
import { DeveloperJobsService } from './developer-jobs.service.js';
import { DeveloperIntegrationsService } from './developer-integrations.service.js';
import { DeveloperAiService } from './developer-ai.service.js';
import {
  DeveloperIntegrationsController,
  DeveloperOAuthCallbackController,
} from './developer-integrations.controller.js';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      DeveloperProfile,
      DeveloperSkill,
      DeveloperExperience,
      DeveloperEducation,
      DeveloperCertification,
      DeveloperProject,
      DeveloperFile,
      DeveloperIntegration,
      DeveloperOAuthState,
      DeveloperRoadmap,
      Organization,
      OrganizationMembership,
      OrganizationModule,
    ]),
  ],
  controllers: [
    DevelopersController,
    PublicDevelopersController,
    DeveloperIntegrationsController,
    DeveloperOAuthCallbackController,
  ],
  providers: [
    DevelopersService,
    DeveloperFilesService,
    DeveloperIntegrationsService,
    DeveloperAiService,
    DeveloperRoadmapsService,
    DeveloperJobsService,
    OrganizationAccessGuard,
    DeveloperModuleAccessGuard,
  ],
})
export class DevelopersModule {}
