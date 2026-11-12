import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import {
  MODULE_PERMISSIONS_KEY,
  ORGANIZATION_ROLES_KEY,
} from '../decorators/authorization.decorator.js';
import { OrganizationAccessGuard } from './organization-access.guard.js';
import { PlatformAdminGuard } from './platform-admin.guard.js';
import { OrganizationMembership } from '../../organizations/organization-membership.entity.js';

type GuardRequest = {
  params?: { organizationId: string };
  authUser?: { id: string; platformRole?: 'none' | 'platform_admin' };
  organizationMembership?: Pick<OrganizationMembership, 'role'>;
};

describe('authorization guards', () => {
  let moduleFixture: TestingModule;
  let organizationGuard: OrganizationAccessGuard;
  let platformAdminGuard: PlatformAdminGuard;
  const membershipRepository = { findOne: vi.fn() };
  const handler = () => undefined;

  beforeEach(async () => {
    membershipRepository.findOne.mockReset();
    moduleFixture = await Test.createTestingModule({
      providers: [
        OrganizationAccessGuard,
        PlatformAdminGuard,
        {
          provide: getRepositoryToken(OrganizationMembership),
          useValue: membershipRepository,
        },
      ],
    }).compile();
    organizationGuard = moduleFixture.get(OrganizationAccessGuard);
    platformAdminGuard = moduleFixture.get(PlatformAdminGuard);
  });

  afterEach(async () => {
    await moduleFixture.close();
    Reflect.deleteMetadata(ORGANIZATION_ROLES_KEY, handler);
    Reflect.deleteMetadata(MODULE_PERMISSIONS_KEY, handler);
  });

  function executionContext(request: GuardRequest) {
    return new ExecutionContextHost([request], Object, handler);
  }

  function organizationRequest(
    role: 'owner' | 'admin' | 'member' = 'member',
    permissions: string[] = [],
  ): GuardRequest {
    const request: GuardRequest = {
      params: { organizationId: 'organization-a' },
      authUser: { id: 'user-a' },
    };
    membershipRepository.findOne.mockResolvedValue({
      userId: 'user-a',
      organizationId: 'organization-a',
      role,
      permissions,
    });
    return request;
  }

  it('checks both the authenticated user and organization membership role', async () => {
    const request = organizationRequest('owner');
    Reflect.defineMetadata(ORGANIZATION_ROLES_KEY, ['owner', 'admin'], handler);
    const context = executionContext(request);

    await expect(organizationGuard.canActivate(context)).resolves.toBe(true);
    expect(request.organizationMembership?.role).toBe('owner');
    expect(membershipRepository.findOne).toHaveBeenCalledWith({
      where: { userId: 'user-a', organizationId: 'organization-a' },
    });

    membershipRepository.findOne.mockResolvedValue({
      userId: 'user-a',
      organizationId: 'organization-a',
      role: 'member',
      permissions: [],
    });
    await expect(organizationGuard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('does not disclose organizations without a matching membership', async () => {
    const request = organizationRequest();
    membershipRepository.findOne.mockResolvedValue(null);
    await expect(
      organizationGuard.canActivate(executionContext(request)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('keeps module permissions separate from organization roles', async () => {
    Reflect.defineMetadata(MODULE_PERMISSIONS_KEY, ['reports:read'], handler);
    const context = executionContext(
      organizationRequest('member', ['reports:read']),
    );
    await expect(organizationGuard.canActivate(context)).resolves.toBe(true);

    membershipRepository.findOne.mockResolvedValue({
      userId: 'user-a',
      organizationId: 'organization-a',
      role: 'owner',
      permissions: [],
    });
    await expect(organizationGuard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('grants platform routes only to the independent platform administrator role', () => {
    const memberRequest: GuardRequest = {
      authUser: { id: 'user-a', platformRole: 'none' },
    };
    expect(() =>
      platformAdminGuard.canActivate(executionContext(memberRequest)),
    ).toThrow(ForbiddenException);

    const administratorRequest: GuardRequest = {
      authUser: { id: 'user-b', platformRole: 'platform_admin' },
    };
    expect(
      platformAdminGuard.canActivate(executionContext(administratorRequest)),
    ).toBe(true);
  });
});
