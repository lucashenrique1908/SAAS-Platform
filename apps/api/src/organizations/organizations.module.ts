import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationAccessGuard } from '../auth/guards/organization-access.guard.js';
import { Organization } from './organization.entity.js';
import { OrganizationMembership } from './organization-membership.entity.js';
import { OrganizationInvitation } from './organization-invitation.entity.js';
import { OrganizationModule } from './organization-module.entity.js';
import { OrganizationActivity } from './organization-activity.entity.js';
import { OrganizationsController } from './organizations.controller.js';
import { OrganizationsService } from './organizations.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { User } from '../users/user.entity.js';
import { AuthSession } from '../sessions/auth-session.entity.js';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      Organization,
      OrganizationMembership,
      OrganizationInvitation,
      OrganizationModule,
      OrganizationActivity,
      User,
      AuthSession,
    ]),
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationAccessGuard, OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
