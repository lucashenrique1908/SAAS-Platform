import type { Request } from 'express';
import type { AuthSession } from '../sessions/auth-session.entity.js';
import type { User } from '../users/user.entity.js';
import type { OrganizationMembership } from '../organizations/organization-membership.entity.js';
import type { Organization } from '../organizations/organization.entity.js';

export type AuthenticatedRequest = Request & {
  authSession?: AuthSession;
  authUser?: User;
  organizationMembership?: OrganizationMembership;
  organization?: Organization;
};
