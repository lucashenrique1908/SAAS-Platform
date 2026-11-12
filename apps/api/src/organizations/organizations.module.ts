import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationAccessGuard } from '../auth/guards/organization-access.guard.js';
import { Organization } from './organization.entity.js';
import { OrganizationMembership } from './organization-membership.entity.js';
import { OrganizationsController } from './organizations.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Organization, OrganizationMembership])],
  controllers: [OrganizationsController],
  providers: [OrganizationAccessGuard],
})
export class OrganizationsModule {}
