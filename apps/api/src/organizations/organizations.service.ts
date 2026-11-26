import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';
import { hashOpaqueToken } from '../auth/auth-token.utils.js';
import { TransactionalEmailService } from '../auth/transactional-email.service.js';
import { AuthSession } from '../sessions/auth-session.entity.js';
import { User } from '../users/user.entity.js';
import {
  ORGANIZATION_MODULES,
  OrganizationModule,
  type OrganizationModuleKey,
} from './organization-module.entity.js';
import { OrganizationActivity } from './organization-activity.entity.js';
import { OrganizationInvitation } from './organization-invitation.entity.js';
import {
  OrganizationMembership,
  type OrganizationRole,
} from './organization-membership.entity.js';
import { Organization } from './organization.entity.js';
import {
  appendOrganizationSlugSuffix,
  isValidPortugueseTaxId,
  slugifyOrganizationName,
} from './organization-slug.utils.js';
import type { CreateOrganizationDto } from './dto/create-organization.dto.js';
import type { UpdateOrganizationDto } from './dto/update-organization.dto.js';

const INVITATION_DURATION_MS = 3 * 24 * 60 * 60 * 1000;
const MODULE_PERMISSIONS = new Set(
  ORGANIZATION_MODULES.flatMap((key) => [`${key}:read`, `${key}:write`]),
);
const EDITABLE_FIELDS = [
  'description',
  'logoUrl',
  'contactEmail',
  'phone',
  'website',
  'country',
  'industry',
  'taxId',
] as const;

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    @InjectRepository(OrganizationMembership)
    private readonly memberships: Repository<OrganizationMembership>,
    @InjectRepository(OrganizationInvitation)
    private readonly invitations: Repository<OrganizationInvitation>,
    @InjectRepository(OrganizationModule)
    private readonly modules: Repository<OrganizationModule>,
    @InjectRepository(OrganizationActivity)
    private readonly activities: Repository<OrganizationActivity>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(AuthSession)
    private readonly sessions: Repository<AuthSession>,
    private readonly emailService: TransactionalEmailService,
  ) {}

  async list(userId: string) {
    const memberships = await this.memberships.find({
      where: { userId },
      relations: { organization: true },
      order: { createdAt: 'ASC' },
    });
    return memberships
      .filter(({ organization }) => organization.isActive)
      .map(({ organization, role, permissions }) => ({
        ...this.serialize(organization),
        role,
        permissions,
      }));
  }

  async create(userId: string, input: CreateOrganizationDto) {
    this.validateTaxId(input.country, input.taxId);
    return this.dataSource.transaction(async (manager) => {
      const user = await manager
        .getRepository(User)
        .findOne({ where: { id: userId, isActive: true } });
      if (!user?.emailVerifiedAt)
        throw new ForbiddenException(
          'Verify your email before creating a workspace.',
        );
      const organization = manager.getRepository(Organization).create({
        ...this.normalizeOrganizationInput(input),
        name: input.name.trim(),
        slug: await this.uniqueSlug(
          manager.getRepository(Organization),
          input.name,
        ),
        isActive: true,
        deactivatedAt: null,
      });
      const saved = await manager
        .getRepository(Organization)
        .save(organization);
      await manager.getRepository(OrganizationMembership).save(
        manager.getRepository(OrganizationMembership).create({
          userId,
          organizationId: saved.id,
          role: 'owner',
          permissions: [],
        }),
      );
      await manager.getRepository(OrganizationModule).save(
        ORGANIZATION_MODULES.map((key) =>
          manager.getRepository(OrganizationModule).create({
            organizationId: saved.id,
            key,
            enabled: key === 'developer',
            updatedByUserId: userId,
          }),
        ),
      );
      await this.record(manager, saved.id, userId, 'organization.created', {
        name: saved.name,
      });
      return { ...this.serialize(saved), role: 'owner', permissions: [] };
    });
  }

  async getBySlug(userId: string, slug: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        slug,
      );
    const organization = await this.organizations.findOne({
      where: isUuid ? { id: slug, isActive: true } : { slug, isActive: true },
    });
    if (!organization) throw new NotFoundException('Organization not found.');
    const membership = await this.memberships.findOne({
      where: { organizationId: organization.id, userId },
    });
    if (!membership) throw new NotFoundException('Organization not found.');
    const [modules, membersCount, activity] = await Promise.all([
      this.modules.find({
        where: { organizationId: organization.id },
        order: { key: 'ASC' },
      }),
      this.memberships.count({ where: { organizationId: organization.id } }),
      this.activities.find({
        where: { organizationId: organization.id },
        order: { createdAt: 'DESC' },
        take: 8,
        relations: { actor: true },
      }),
    ]);
    return {
      organization: this.serialize(organization),
      role: membership.role,
      permissions: membership.permissions,
      membersCount,
      modules: modules.map(({ key, enabled }) => ({ key, enabled })),
      activity: activity.map(({ id, type, details, createdAt, actor }) => ({
        id,
        type,
        details,
        createdAt,
        actorEmail: actor?.email ?? null,
      })),
    };
  }

  async setActiveOrganization(userId: string, sessionId: string, slug: string) {
    const organization = await this.organizations.findOne({
      where: { slug, isActive: true },
    });
    if (!organization) throw new NotFoundException('Organization not found.');
    const membership = await this.memberships.findOne({
      where: { organizationId: organization.id, userId },
    });
    if (!membership) throw new NotFoundException('Organization not found.');
    await this.sessions.update(
      { id: sessionId, userId, revokedAt: IsNull() },
      { activeOrganizationId: organization.id },
    );
    return { slug: organization.slug };
  }

  async suggestSlug(input: string, excludeSlug?: string) {
    const base = slugifyOrganizationName(input);
    const rows = await this.organizations.find({
      select: { slug: true },
      where: { slug: base },
    });
    if (rows.length === 0 || base === excludeSlug)
      return { available: true, slug: base, suggestions: [] };
    const suggestions = await Promise.all(
      [2, 3, 4].map((n) => this.uniqueSuggestedSlug(base, n)),
    );
    return { available: false, slug: base, suggestions };
  }

  async update(userId: string, slug: string, input: UpdateOrganizationDto) {
    return this.dataSource.transaction(async (manager) => {
      const organization = await this.findLocked(manager, slug);
      const membership = await this.actorMembership(
        manager,
        organization.id,
        userId,
      );
      const changesNameOrSlug =
        input.name !== undefined || input.slug !== undefined;
      if (membership.role === 'member')
        throw new ForbiddenException('Insufficient organization role.');
      if (membership.role === 'admin' && changesNameOrSlug)
        throw new ForbiddenException(
          'Only an owner can change the name or slug.',
        );
      if (input.name !== undefined && input.name !== null)
        organization.name = input.name.trim();
      if (
        input.slug !== undefined &&
        input.slug !== null &&
        input.slug !== organization.slug
      ) {
        if (input.confirmSlugChange !== true)
          throw new BadRequestException('Confirm the slug change explicitly.');
        organization.slug = await this.uniqueSlug(
          manager.getRepository(Organization),
          input.slug,
          organization.id,
          true,
        );
      }
      this.validateTaxId(
        input.country ?? organization.country ?? undefined,
        input.taxId ?? organization.taxId ?? undefined,
      );
      for (const field of EDITABLE_FIELDS) {
        if (input[field] !== undefined)
          organization[field] = input[field] ?? null;
      }
      const saved = await manager
        .getRepository(Organization)
        .save(organization);
      await this.record(
        manager,
        organization.id,
        userId,
        'organization.updated',
        {
          fields: Object.keys(input).filter(
            (key) => key !== 'confirmSlugChange',
          ),
        },
      );
      return this.serialize(saved);
    });
  }

  async deactivate(userId: string, slug: string) {
    return this.dataSource.transaction(async (manager) => {
      const organization = await this.findLocked(manager, slug);
      const membership = await this.actorMembership(
        manager,
        organization.id,
        userId,
      );
      this.requireOwner(membership.role);
      organization.isActive = false;
      organization.deactivatedAt = new Date();
      await manager.getRepository(Organization).save(organization);
      await manager
        .getRepository(AuthSession)
        .update(
          { activeOrganizationId: organization.id },
          { activeOrganizationId: null },
        );
      await this.record(
        manager,
        organization.id,
        userId,
        'organization.deactivated',
        {},
      );
      return { success: true };
    });
  }

  async reactivate(userId: string, slug: string) {
    return this.dataSource.transaction(async (manager) => {
      const organization = await manager
        .getRepository(Organization)
        .findOne({ where: { slug }, lock: { mode: 'pessimistic_write' } });
      if (!organization) throw new NotFoundException('Organization not found.');
      this.requireOwner(
        (await this.actorMembership(manager, organization.id, userId)).role,
      );
      organization.isActive = true;
      organization.deactivatedAt = null;
      await manager.getRepository(Organization).save(organization);
      await this.record(
        manager,
        organization.id,
        userId,
        'organization.reactivated',
        {},
      );
      return this.serialize(organization);
    });
  }

  async removePermanently(userId: string, slug: string, confirmName: string) {
    await this.dataSource.transaction(async (manager) => {
      const organization = await manager
        .getRepository(Organization)
        .findOne({ where: { slug }, lock: { mode: 'pessimistic_write' } });
      if (!organization) throw new NotFoundException('Organization not found.');
      this.requireOwner(
        (await this.actorMembership(manager, organization.id, userId)).role,
      );
      if (confirmName !== organization.name)
        throw new BadRequestException(
          'Type the organization name to confirm permanent deletion.',
        );
      await manager.getRepository(Organization).delete({ id: organization.id });
    });
    return { success: true };
  }

  async listMembers(slug: string) {
    const organization = await this.activeOrganizationBySlug(slug);
    const memberships = await this.memberships.find({
      where: { organizationId: organization.id },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
    return memberships.map(
      ({ userId, role, permissions, createdAt, user }) => ({
        userId,
        email: user.email,
        role,
        permissions,
        joinedAt: createdAt,
      }),
    );
  }

  async addMember(
    actorId: string,
    slug: string,
    emailInput: string,
    role: OrganizationRole,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const organization = await this.findLocked(manager, slug);
      const actor = await this.actorMembership(
        manager,
        organization.id,
        actorId,
      );
      this.requireManager(actor.role);
      if (actor.role === 'admin' && role !== 'member')
        throw new ForbiddenException('Admins can directly add members only.');
      const email = this.normalizeEmail(emailInput);
      const user = await manager
        .getRepository(User)
        .findOne({ where: { email, isActive: true } });
      if (!user?.emailVerifiedAt)
        throw new BadRequestException(
          'A registered, verified account is required for direct addition.',
        );
      if (
        await manager.getRepository(OrganizationMembership).exists({
          where: { organizationId: organization.id, userId: user.id },
        })
      ) {
        throw new ConflictException('This user is already a member.');
      }
      const saved = await manager.getRepository(OrganizationMembership).save({
        organizationId: organization.id,
        userId: user.id,
        role,
        permissions: [],
      });
      await this.record(manager, organization.id, actorId, 'member.added', {
        email,
        role,
      });
      return {
        userId: user.id,
        email,
        role: saved.role,
        permissions: saved.permissions,
      };
    });
  }

  async changeRole(
    actorId: string,
    slug: string,
    targetUserId: string,
    role: OrganizationRole,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const organization = await this.findLocked(manager, slug);
      this.requireOwner(
        (await this.actorMembership(manager, organization.id, actorId)).role,
      );
      const target = await manager
        .getRepository(OrganizationMembership)
        .findOne({
          where: { organizationId: organization.id, userId: targetUserId },
          lock: { mode: 'pessimistic_write' },
        });
      if (!target) throw new NotFoundException('Member not found.');
      if (target.role === 'owner' && role !== 'owner')
        await this.assertAnotherOwner(manager, organization.id, targetUserId);
      const oldRole = target.role;
      target.role = role;
      await manager.getRepository(OrganizationMembership).save(target);
      await this.record(
        manager,
        organization.id,
        actorId,
        'member.role_changed',
        { userId: targetUserId, from: oldRole, to: role },
      );
      return {
        userId: target.userId,
        role: target.role,
        permissions: target.permissions,
      };
    });
  }

  async removeMember(actorId: string, slug: string, targetUserId: string) {
    return this.dataSource.transaction(async (manager) => {
      const organization = await this.findLocked(manager, slug);
      const actor = await this.actorMembership(
        manager,
        organization.id,
        actorId,
      );
      this.requireManager(actor.role);
      const target = await manager
        .getRepository(OrganizationMembership)
        .findOne({
          where: { organizationId: organization.id, userId: targetUserId },
          lock: { mode: 'pessimistic_write' },
        });
      if (!target) throw new NotFoundException('Member not found.');
      if (actor.role === 'admin' && target.role !== 'member')
        throw new ForbiddenException('Admins can remove members only.');
      if (target.role === 'owner')
        await this.assertAnotherOwner(manager, organization.id, targetUserId);
      await manager
        .getRepository(OrganizationMembership)
        .delete({ id: target.id });
      await manager.query(
        'DELETE FROM "barber_professional_managers" WHERE "organization_id" = $1 AND "user_id" = $2',
        [organization.id, targetUserId],
      );
      await manager.query(
        'UPDATE "barber_professionals" SET "user_id" = NULL WHERE "organization_id" = $1 AND "user_id" = $2',
        [organization.id, targetUserId],
      );
      await manager
        .getRepository(AuthSession)
        .update(
          { activeOrganizationId: organization.id, userId: targetUserId },
          { activeOrganizationId: null },
        );
      await this.record(manager, organization.id, actorId, 'member.removed', {
        userId: targetUserId,
        role: target.role,
      });
      return { success: true };
    });
  }

  async leave(actorId: string, slug: string) {
    return this.dataSource.transaction(async (manager) => {
      const organization = await this.findLocked(manager, slug);
      const membership = await this.actorMembership(
        manager,
        organization.id,
        actorId,
      );
      if (membership.role === 'owner')
        await this.assertAnotherOwner(manager, organization.id, actorId);
      await manager
        .getRepository(OrganizationMembership)
        .delete({ id: membership.id });
      await manager.query(
        'DELETE FROM "barber_professional_managers" WHERE "organization_id" = $1 AND "user_id" = $2',
        [organization.id, actorId],
      );
      await manager.query(
        'UPDATE "barber_professionals" SET "user_id" = NULL WHERE "organization_id" = $1 AND "user_id" = $2',
        [organization.id, actorId],
      );
      await manager
        .getRepository(AuthSession)
        .update(
          { activeOrganizationId: organization.id, userId: actorId },
          { activeOrganizationId: null },
        );
      await this.record(manager, organization.id, actorId, 'member.left', {
        role: membership.role,
      });
      return { success: true };
    });
  }

  async transferOwnership(actorId: string, slug: string, targetUserId: string) {
    return this.dataSource.transaction(async (manager) => {
      const organization = await this.findLocked(manager, slug);
      const owner = await this.actorMembership(
        manager,
        organization.id,
        actorId,
      );
      this.requireOwner(owner.role);
      if (actorId === targetUserId)
        throw new BadRequestException(
          'Choose another member to receive ownership.',
        );
      const target = await manager
        .getRepository(OrganizationMembership)
        .findOne({
          where: { organizationId: organization.id, userId: targetUserId },
          lock: { mode: 'pessimistic_write' },
        });
      if (!target) throw new NotFoundException('Member not found.');
      const previousRole = target.role;
      target.role = 'owner';
      owner.role = 'admin';
      await manager.getRepository(OrganizationMembership).save([target, owner]);
      await this.record(
        manager,
        organization.id,
        actorId,
        'organization.ownership_transferred',
        { fromUserId: actorId, toUserId: targetUserId, previousRole },
      );
      return { ownerUserId: targetUserId, previousOwnerRole: 'admin' };
    });
  }

  async setMemberPermissions(
    actorId: string,
    slug: string,
    targetUserId: string,
    permissions: string[],
  ) {
    if (permissions.some((permission) => !MODULE_PERMISSIONS.has(permission)))
      throw new BadRequestException('Unknown module permission.');
    return this.dataSource.transaction(async (manager) => {
      const organization = await this.findLocked(manager, slug);
      const actor = await this.actorMembership(
        manager,
        organization.id,
        actorId,
      );
      this.requireManager(actor.role);
      const target = await manager
        .getRepository(OrganizationMembership)
        .findOne({
          where: { organizationId: organization.id, userId: targetUserId },
          lock: { mode: 'pessimistic_write' },
        });
      if (!target) throw new NotFoundException('Member not found.');
      if (actor.role === 'admin' && target.role !== 'member')
        throw new ForbiddenException(
          'Admins can manage permissions for members only.',
        );
      target.permissions = [...new Set(permissions)];
      await manager.getRepository(OrganizationMembership).save(target);
      await this.record(
        manager,
        organization.id,
        actorId,
        'member.permissions_changed',
        { userId: targetUserId, permissions: target.permissions },
      );
      return { userId: targetUserId, permissions: target.permissions };
    });
  }

  async listInvitations(slug: string) {
    const organization = await this.activeOrganizationBySlug(slug);
    const rows = await this.invitations.find({
      where: {
        organizationId: organization.id,
        acceptedAt: IsNull(),
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });
    return rows.map(
      ({ id, email, role, permissions, expiresAt, createdAt }) => ({
        id,
        email,
        role,
        permissions,
        expiresAt,
        createdAt,
      }),
    );
  }

  async invite(
    actorId: string,
    slug: string,
    emailInput: string,
    role: OrganizationRole,
  ) {
    const email = this.normalizeEmail(emailInput);
    const token = randomBytes(32).toString('base64url');
    const invitation = await this.dataSource.transaction(async (manager) => {
      const organization = await this.findLocked(manager, slug);
      const actor = await this.actorMembership(
        manager,
        organization.id,
        actorId,
      );
      this.requireManager(actor.role);
      if (actor.role === 'admin' && role !== 'member')
        throw new ForbiddenException('Admins can invite members only.');
      const user = await manager
        .getRepository(User)
        .findOne({ where: { email } });
      if (
        user &&
        (await manager.getRepository(OrganizationMembership).exists({
          where: { organizationId: organization.id, userId: user.id },
        }))
      ) {
        throw new ConflictException('This user is already a member.');
      }
      const existing = await manager
        .getRepository(OrganizationInvitation)
        .findOne({
          where: {
            organizationId: organization.id,
            email,
            acceptedAt: IsNull(),
            revokedAt: IsNull(),
            expiresAt: MoreThan(new Date()),
          },
        });
      if (existing)
        throw new ConflictException(
          'A pending invitation already exists for this email.',
        );
      return manager.getRepository(OrganizationInvitation).save(
        manager.getRepository(OrganizationInvitation).create({
          organizationId: organization.id,
          email,
          tokenHash: hashOpaqueToken(token),
          role,
          permissions: [],
          invitedByUserId: actorId,
          acceptedByUserId: null,
          expiresAt: new Date(Date.now() + INVITATION_DURATION_MS),
          acceptedAt: null,
          revokedAt: null,
        }),
      );
    });
    try {
      const organization = await this.organizations.findOneByOrFail({
        id: invitation.organizationId,
      });
      await this.emailService.sendOrganizationInvitationEmail(
        email,
        token,
        organization.name,
      );
    } catch (error) {
      await this.invitations.update(
        { id: invitation.id },
        { revokedAt: new Date() },
      );
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(
        'The invitation email could not be sent.',
      );
    }
    await this.dataSource.transaction((manager) =>
      this.record(
        manager,
        invitation.organizationId,
        actorId,
        'invitation.sent',
        { email, role },
      ),
    );
    return { id: invitation.id, email, role, expiresAt: invitation.expiresAt };
  }

  async revokeInvitation(actorId: string, slug: string, invitationId: string) {
    return this.dataSource.transaction(async (manager) => {
      const organization = await this.findLocked(manager, slug);
      const actor = await this.actorMembership(
        manager,
        organization.id,
        actorId,
      );
      this.requireManager(actor.role);
      const invite = await manager
        .getRepository(OrganizationInvitation)
        .findOne({
          where: {
            id: invitationId,
            organizationId: organization.id,
            acceptedAt: IsNull(),
            revokedAt: IsNull(),
          },
          lock: { mode: 'pessimistic_write' },
        });
      if (!invite) throw new NotFoundException('Pending invitation not found.');
      invite.revokedAt = new Date();
      await manager.getRepository(OrganizationInvitation).save(invite);
      await this.record(
        manager,
        organization.id,
        actorId,
        'invitation.revoked',
        { email: invite.email },
      );
      return { success: true };
    });
  }

  async acceptInvitation(userId: string, rawToken: string) {
    return this.dataSource.transaction(async (manager) => {
      const invitationRepository = manager.getRepository(
        OrganizationInvitation,
      );
      const candidate = await invitationRepository.findOne({
        where: { tokenHash: hashOpaqueToken(rawToken) },
      });
      if (!candidate)
        throw new BadRequestException(
          'The invitation is invalid, expired, revoked, or already used.',
        );
      const organization = await manager.getRepository(Organization).findOne({
        where: { id: candidate.organizationId, isActive: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!organization) throw new NotFoundException('Organization not found.');
      const invite = await invitationRepository.findOne({
        where: {
          id: candidate.id,
          tokenHash: hashOpaqueToken(rawToken),
          acceptedAt: IsNull(),
          revokedAt: IsNull(),
          expiresAt: MoreThan(new Date()),
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!invite)
        throw new BadRequestException(
          'The invitation is invalid, expired, revoked, or already used.',
        );
      const user = await manager
        .getRepository(User)
        .findOne({ where: { id: userId, isActive: true } });
      if (!user?.emailVerifiedAt)
        throw new ForbiddenException(
          'Verify your email before accepting an invitation.',
        );
      if (this.normalizeEmail(user.email) !== invite.email)
        throw new ForbiddenException(
          'This invitation was sent to another email address.',
        );
      if (
        await manager
          .getRepository(OrganizationMembership)
          .exists({ where: { organizationId: organization.id, userId } })
      )
        throw new ConflictException('This user is already a member.');
      invite.acceptedAt = new Date();
      invite.acceptedByUserId = userId;
      await manager.getRepository(OrganizationInvitation).save(invite);
      const membership = await manager
        .getRepository(OrganizationMembership)
        .save({
          organizationId: organization.id,
          userId,
          role: invite.role,
          permissions: invite.permissions,
        });
      await this.record(
        manager,
        organization.id,
        userId,
        'invitation.accepted',
        { email: user.email, role: membership.role },
      );
      return {
        organization: this.serialize(organization),
        role: membership.role,
      };
    });
  }

  async setModuleEnabled(
    actorId: string,
    slug: string,
    key: OrganizationModuleKey,
    enabled: boolean,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const organization = await this.findLocked(manager, slug);
      const actor = await this.actorMembership(
        manager,
        organization.id,
        actorId,
      );
      this.requireManager(actor.role);
      let module = await manager.getRepository(OrganizationModule).findOne({
        where: { organizationId: organization.id, key },
        lock: { mode: 'pessimistic_write' },
      });
      if (!module)
        module = manager.getRepository(OrganizationModule).create({
          organizationId: organization.id,
          key,
          enabled: false,
          updatedByUserId: actorId,
        });
      module.enabled = enabled;
      module.updatedByUserId = actorId;
      await manager.getRepository(OrganizationModule).save(module);
      await this.record(
        manager,
        organization.id,
        actorId,
        'module.state_changed',
        { key, enabled },
      );
      return { key, enabled };
    });
  }

  async listModules(slug: string) {
    const organization = await this.activeOrganizationBySlug(slug);
    return this.modules.find({
      where: { organizationId: organization.id },
      order: { key: 'ASC' },
    });
  }

  getUnavailableModule(): never {
    throw new NotFoundException('Module is not available.');
  }

  async getModule(actorId: string, slug: string, key: OrganizationModuleKey) {
    const organization = await this.activeOrganizationBySlug(slug);
    const membership = await this.memberships.findOne({
      where: { organizationId: organization.id, userId: actorId },
    });
    if (!membership) throw new NotFoundException('Organization not found.');
    const module = await this.modules.findOne({
      where: { organizationId: organization.id, key },
    });
    if (!module?.enabled)
      throw new NotFoundException('Module is not available.');
    if (
      !['owner', 'admin'].includes(membership.role) &&
      !membership.permissions.includes(`${key}:read`)
    ) {
      throw new ForbiddenException('You do not have access to this module.');
    }
    return { key, enabled: true, organization: this.serialize(organization) };
  }

  private async activeOrganizationBySlug(slug: string) {
    const organization = await this.organizations.findOne({
      where: { slug, isActive: true },
    });
    if (!organization) throw new NotFoundException('Organization not found.');
    return organization;
  }

  private async findLocked(
    manager: import('typeorm').EntityManager,
    slug: string,
  ) {
    const organization = await manager.getRepository(Organization).findOne({
      where: { slug, isActive: true },
      lock: { mode: 'pessimistic_write' },
    });
    if (!organization) throw new NotFoundException('Organization not found.');
    return organization;
  }

  private async actorMembership(
    manager: import('typeorm').EntityManager,
    organizationId: string,
    userId: string,
  ) {
    const membership = await manager
      .getRepository(OrganizationMembership)
      .findOne({
        where: { organizationId, userId },
        lock: { mode: 'pessimistic_write' },
      });
    if (!membership) throw new NotFoundException('Organization not found.');
    return membership;
  }

  private async assertAnotherOwner(
    manager: import('typeorm').EntityManager,
    organizationId: string,
    excludedUserId: string,
  ) {
    const count = await manager
      .getRepository(OrganizationMembership)
      .count({ where: { organizationId, role: 'owner' } });
    if (count <= 1)
      throw new ConflictException(
        'Transfer ownership before removing the last Owner.',
      );
    const current = await manager.getRepository(OrganizationMembership).count({
      where: { organizationId, userId: excludedUserId, role: 'owner' },
    });
    if (current === 0)
      throw new ConflictException(
        'The owner membership changed. Retry the operation.',
      );
  }

  private async uniqueSlug(
    repository: Repository<Organization>,
    input: string,
    excludeId?: string,
    exact = false,
  ) {
    const base = slugifyOrganizationName(input);
    const existing = await repository.findOne({ where: { slug: base } });
    if (!existing || existing.id === excludeId) return base;
    if (exact) {
      const suggestions = await Promise.all(
        [2, 3, 4].map((n) => this.uniqueSuggestedSlug(base, n)),
      );
      throw new ConflictException({
        message: 'The slug is already in use.',
        suggestions,
      });
    }
    for (let suffix = 2; suffix < 1000; suffix += 1) {
      const candidate = appendOrganizationSlugSuffix(base, suffix);
      if (!(await repository.exists({ where: { slug: candidate } })))
        return candidate;
    }
    throw new ConflictException(
      'A unique organization slug could not be generated.',
    );
  }

  private async uniqueSuggestedSlug(base: string, suffix: number) {
    const candidate = appendOrganizationSlugSuffix(base, suffix);
    if (!(await this.organizations.exists({ where: { slug: candidate } })))
      return candidate;
    return this.uniqueSlug(this.organizations, candidate);
  }

  private async record(
    manager: import('typeorm').EntityManager,
    organizationId: string,
    actorUserId: string | null,
    type: string,
    details: Record<string, unknown>,
  ) {
    await manager
      .getRepository(OrganizationActivity)
      .save({ organizationId, actorUserId, type, details });
  }

  private serialize(organization: Organization) {
    const {
      id,
      name,
      slug,
      description,
      logoUrl,
      contactEmail,
      phone,
      website,
      country,
      industry,
      taxId,
      isActive,
      deactivatedAt,
      createdAt,
    } = organization;
    return {
      id,
      name,
      slug,
      description,
      logoUrl,
      contactEmail,
      phone,
      website,
      country,
      industry,
      taxId,
      isActive,
      deactivatedAt,
      createdAt,
    };
  }

  private normalizeOrganizationInput(input: CreateOrganizationDto) {
    return Object.fromEntries(
      Object.entries(input)
        .filter(([key]) => key !== 'name')
        .map(([key, value]) => [
          key,
          typeof value === 'string' ? value.trim() || null : (value ?? null),
        ]),
    );
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }
  private requireOwner(role: OrganizationRole) {
    if (role !== 'owner')
      throw new ForbiddenException('Only an Owner can perform this action.');
  }
  private requireManager(role: OrganizationRole) {
    if (role !== 'owner' && role !== 'admin')
      throw new ForbiddenException('Insufficient organization role.');
  }

  private validateTaxId(country?: string | null, taxId?: string | null) {
    if (!taxId) return;
    if (
      country?.trim().toLowerCase() === 'portugal' ||
      country?.trim().toUpperCase() === 'PT'
    ) {
      if (!isValidPortugueseTaxId(taxId))
        throw new BadRequestException(
          'Enter a valid Portuguese tax identification number (NIF).',
        );
    }
  }
}
