import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedRequest } from '../../auth/auth.types.js';
import { OrganizationModule } from '../../organizations/organization-module.entity.js';

@Injectable()
export class DeveloperModuleAccessGuard implements CanActivate {
  constructor(
    @InjectRepository(OrganizationModule)
    private readonly modules: Repository<OrganizationModule>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const organizationId = request.organization?.id;
    const membership = request.organizationMembership;
    if (!organizationId || !membership) {
      throw new ForbiddenException('Developer module access is unavailable.');
    }
    const module = await this.modules.findOne({
      where: { organizationId, key: 'developer', enabled: true },
      select: { id: true },
    });
    if (!module) throw new ForbiddenException('Developer module is disabled.');
    if (
      !['owner', 'admin'].includes(membership.role) &&
      !membership.permissions.includes('developer:read') &&
      !membership.permissions.includes('developer:write')
    ) {
      throw new ForbiddenException('Developer module access is unavailable.');
    }
    return true;
  }
}
