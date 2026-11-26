import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { OrganizationModule } from '../organizations/organization-module.entity.js';

@Injectable()
export class BarberAccessGuard implements CanActivate {
  constructor(
    @InjectRepository(OrganizationModule)
    private readonly modules: Repository<OrganizationModule>,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const organizationId = request.organization?.id;
    const membership = request.organizationMembership;
    if (!organizationId || !membership)
      throw new ForbiddenException('Barber module access is unavailable.');
    const enabled = await this.modules.exists({
      where: { organizationId, key: 'barber', enabled: true },
    });
    if (!enabled) throw new ForbiddenException('Barber module is disabled.');
    if (
      !['owner', 'admin'].includes(membership.role) &&
      !membership.permissions.some(
        (p) => p === 'barber:read' || p === 'barber:write',
      )
    ) {
      throw new ForbiddenException('Barber module access is unavailable.');
    }
    return true;
  }
}
