import {
  Controller,
  Get,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './organization.entity.js';
import { OrganizationAccessGuard } from '../auth/guards/organization-access.guard.js';

@Controller('organizations')
@UseGuards(OrganizationAccessGuard)
export class OrganizationsController {
  constructor(
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
  ) {}

  @Get(':organizationId')
  async getOrganization(@Param('organizationId') organizationId: string) {
    const organization = await this.organizations.findOne({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found.');
    }
    return {
      id: organization.id,
      name: organization.name,
      createdAt: organization.createdAt,
    };
  }
}
