import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedRequest } from '../auth.types.js';
import {
  MODULE_PERMISSIONS_KEY,
  ORGANIZATION_ROLES_KEY,
  type ModulePermission,
} from '../decorators/authorization.decorator.js';
import type { OrganizationRole } from '../../organizations/organization-membership.entity.js';
import { OrganizationMembership } from '../../organizations/organization-membership.entity.js';
import { Organization } from '../../organizations/organization.entity.js';

@Injectable()
export class OrganizationAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(OrganizationMembership)
    private readonly memberships: Repository<OrganizationMembership>,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.authUser;
    const organizationRef =
      request.params.organizationId ?? request.params.slug;
    if (!user || typeof organizationRef !== 'string') {
      throw new NotFoundException('Organization not found.');
    }

    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        organizationRef,
      );
    const organization = await this.organizations.findOne({
      where: isUuid
        ? { id: organizationRef, isActive: true }
        : { slug: organizationRef, isActive: true },
    });
    if (!organization) throw new NotFoundException('Organization not found.');

    const membership = await this.memberships.findOne({
      where: { userId: user.id, organizationId: organization.id },
    });
    if (!membership) {
      throw new NotFoundException('Organization not found.');
    }

    const roles = this.reflector.getAllAndOverride<OrganizationRole[]>(
      ORGANIZATION_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (roles?.length && !roles.includes(membership.role)) {
      throw new ForbiddenException('Insufficient organization role.');
    }

    const permissions = this.reflector.getAllAndOverride<ModulePermission[]>(
      MODULE_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (
      permissions?.length &&
      !['owner', 'admin'].includes(membership.role) &&
      !permissions.every((permission) =>
        membership.permissions.includes(permission),
      )
    ) {
      throw new ForbiddenException('Insufficient module permission.');
    }

    request.organizationMembership = membership;
    request.organization = organization;
    return true;
  }
}
