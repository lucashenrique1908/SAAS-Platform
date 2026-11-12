import { SetMetadata } from '@nestjs/common';
import type { OrganizationRole } from '../../organizations/organization-membership.entity.js';

export const ORGANIZATION_ROLES_KEY = 'organizationRoles';
export const MODULE_PERMISSIONS_KEY = 'modulePermissions';

export type ModulePermission = `${string}:${string}`;

export const RequireOrganizationRoles = (...roles: OrganizationRole[]) =>
  SetMetadata(ORGANIZATION_ROLES_KEY, roles);

export const RequireModulePermissions = (...permissions: ModulePermission[]) =>
  SetMetadata(MODULE_PERMISSIONS_KEY, permissions);
