import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationAccessGuard } from '../auth/guards/organization-access.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { Organization } from '../organizations/organization.entity.js';
import { OrganizationMembership } from '../organizations/organization-membership.entity.js';
import { OrganizationModule } from '../organizations/organization-module.entity.js';
import { User } from '../users/user.entity.js';
import { BarberAccessGuard } from './barber-access.guard.js';
import {
  BarberBusinessProfile,
  BarberClient,
  BarberProfessional,
  BarberProfessionalManager,
  BarberProfessionalService,
  BarberService,
} from './barber.entities.js';
import { BarberController } from './barber.controller.js';
import { BarberCustomerController } from './barber-customer.controller.js';
import { BarberServiceLayer } from './barber.service.js';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      Organization,
      OrganizationMembership,
      OrganizationModule,
      User,
      BarberBusinessProfile,
      BarberProfessional,
      BarberProfessionalManager,
      BarberService,
      BarberProfessionalService,
      BarberClient,
    ]),
  ],
  controllers: [BarberController, BarberCustomerController],
  providers: [OrganizationAccessGuard, BarberAccessGuard, BarberServiceLayer],
})
export class BarberModule {}
