import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { OrganizationMembership } from '../organizations/organization-membership.entity.js';
import { User } from '../users/user.entity.js';
import {
  BarberBusinessProfile,
  BarberClient,
  BarberProfessional,
  BarberProfessionalManager,
  BarberProfessionalService,
  BarberService,
} from './barber.entities.js';

@Injectable()
export class BarberServiceLayer {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(BarberBusinessProfile)
    private readonly profiles: Repository<BarberBusinessProfile>,
    @InjectRepository(BarberProfessional)
    private readonly professionals: Repository<BarberProfessional>,
    @InjectRepository(BarberProfessionalManager)
    private readonly managers: Repository<BarberProfessionalManager>,
    @InjectRepository(BarberService)
    private readonly services: Repository<BarberService>,
    @InjectRepository(BarberProfessionalService)
    private readonly professionalServices: Repository<BarberProfessionalService>,
    @InjectRepository(BarberClient)
    private readonly clients: Repository<BarberClient>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  private admin(m: OrganizationMembership) {
    return m.role === 'owner' || m.role === 'admin';
  }
  private async ownProfessional(
    orgId: string,
    userId: string,
    membership: OrganizationMembership,
  ) {
    const linked = await this.professionals.findOne({
      where: { organizationId: orgId, userId },
    });
    if (linked) return linked;
    const managed = await this.managers.findOne({
      where: { organizationId: orgId, userId },
    });
    if (managed)
      return this.professionals.findOne({
        where: { id: managed.professionalId, organizationId: orgId },
      });
    if (membership.role !== 'member') return null;
    return null;
  }
  private canWrite(m: OrganizationMembership) {
    return this.admin(m) || m.permissions.includes('barber:write');
  }
  private requireWrite(m: OrganizationMembership) {
    if (!this.canWrite(m))
      throw new ForbiddenException('Barber write permission required.');
  }
  private async assertProfessional(orgId: string, id: string) {
    const item = await this.professionals.findOne({
      where: { id, organizationId: orgId },
    });
    if (!item) throw new NotFoundException('Professional not found.');
    return item;
  }

  getProfile(orgId: string) {
    return this.profiles.findOne({ where: { organizationId: orgId } });
  }
  async saveProfile(orgId: string, data: Partial<BarberBusinessProfile>) {
    let item = await this.getProfile(orgId);
    item ??= this.profiles.create({
      organizationId: orgId,
      businessName: data.businessName ?? '',
    });
    Object.assign(item, data);
    return this.profiles.save(item);
  }
  listProfessionals(orgId: string) {
    return this.professionals.find({
      where: { organizationId: orgId },
      order: { displayName: 'ASC' },
    });
  }
  async listEditableProfessionalIds(orgId: string, userId: string) {
    const [direct, managed] = await Promise.all([
      this.professionals.find({
        where: { organizationId: orgId, userId },
        select: { id: true },
      }),
      this.managers.find({
        where: { organizationId: orgId, userId },
        select: { professionalId: true },
      }),
    ]);
    return [
      ...new Set([
        ...direct.map((item) => item.id),
        ...managed.map((item) => item.professionalId),
      ]),
    ];
  }
  async saveProfessional(
    orgId: string,
    userId: string,
    membership: OrganizationMembership,
    id: string | undefined,
    data: Partial<BarberProfessional>,
  ) {
    this.requireWrite(membership);
    let item: BarberProfessional;
    if (id) {
      item = await this.assertProfessional(orgId, id);
      if (!this.admin(membership)) {
        const own = await this.ownProfessional(orgId, userId, membership);
        const manager = await this.managers.exists({
          where: { organizationId: orgId, professionalId: id, userId },
        });
        if (own?.id !== id && !manager)
          throw new ForbiddenException(
            'You may only edit your own or assigned professional profile.',
          );
        if (data.userId !== undefined)
          throw new ForbiddenException(
            'Only Owner or Admin can link platform accounts.',
          );
      }
      Object.assign(item, data);
    } else {
      if (!this.admin(membership))
        throw new ForbiddenException(
          'Only Owner or Admin can create professionals.',
        );
      item = this.professionals.create({
        ...data,
        organizationId: orgId,
        createdByUserId: userId,
      });
    }
    if (data.userId) {
      const member = await this.users
        .createQueryBuilder('u')
        .innerJoin('u.memberships', 'm')
        .where(
          'u.id = :userId AND m.organization_id = :orgId AND m.role = :role',
          { userId: data.userId, orgId, role: 'member' },
        )
        .getOne();
      if (!member)
        throw new NotFoundException('Organization member not found.');
    }
    return this.professionals.save(item);
  }
  async removeProfessional(
    orgId: string,
    id: string,
    membership: OrganizationMembership,
  ) {
    if (membership.role !== 'owner')
      throw new ForbiddenException(
        'Only the organization Owner can delete professionals.',
      );
    await this.assertProfessional(orgId, id);
    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(BarberClient)
        .update(
          { organizationId: orgId, responsibleProfessionalId: id },
          { responsibleProfessionalId: null },
        );
      await manager
        .getRepository(BarberProfessionalManager)
        .delete({ organizationId: orgId, professionalId: id });
      await manager
        .getRepository(BarberProfessionalService)
        .delete({ organizationId: orgId, professionalId: id });
      await manager
        .getRepository(BarberProfessional)
        .delete({ organizationId: orgId, id });
    });
    return { deleted: true };
  }
  listServices(orgId: string) {
    return this.services.find({
      where: { organizationId: orgId },
      order: { name: 'ASC' },
    });
  }
  listProfessionalServices(orgId: string) {
    return this.professionalServices.find({ where: { organizationId: orgId } });
  }
  listProfessionalManagers(orgId: string) {
    return this.managers.find({ where: { organizationId: orgId } });
  }
  async saveService(
    orgId: string,
    userId: string,
    membership: OrganizationMembership,
    id: string | undefined,
    data: Partial<BarberService>,
  ) {
    this.requireWrite(membership);
    if (!this.admin(membership))
      throw new ForbiddenException('Only Owner or Admin can manage services.');
    let item = id
      ? await this.services.findOne({ where: { id, organizationId: orgId } })
      : null;
    if (id && !item) throw new NotFoundException('Service not found.');
    item ??= this.services.create({
      organizationId: orgId,
      createdByUserId: userId,
      name: data.name ?? '',
      priceCents: data.priceCents ?? 0,
      durationMinutes: data.durationMinutes ?? 1,
    });
    Object.assign(item, data);
    return this.services.save(item);
  }
  async setProfessionalService(
    orgId: string,
    membership: OrganizationMembership,
    professionalId: string,
    serviceId: string,
    enabled: boolean,
  ) {
    if (!this.admin(membership))
      throw new ForbiddenException(
        'Only Owner or Admin can manage professional-service associations.',
      );
    await this.assertProfessional(orgId, professionalId);
    const service = await this.services.findOne({
      where: { id: serviceId, organizationId: orgId },
    });
    if (!service) throw new NotFoundException('Service not found.');
    if (enabled)
      await this.professionalServices.upsert(
        { organizationId: orgId, professionalId, serviceId },
        ['organizationId', 'professionalId', 'serviceId'],
      );
    else
      await this.professionalServices.delete({
        organizationId: orgId,
        professionalId,
        serviceId,
      });
    return { enabled };
  }
  async listClients(
    orgId: string,
    userId: string,
    membership: OrganizationMembership,
  ) {
    if (this.admin(membership))
      return this.clients.find({
        where: { organizationId: orgId },
        order: { fullName: 'ASC' },
      });
    const professional = await this.ownProfessional(orgId, userId, membership);
    if (!professional) return [];
    return this.clients.find({
      where: {
        organizationId: orgId,
        responsibleProfessionalId: professional.id,
      },
      order: { fullName: 'ASC' },
    });
  }
  async saveClient(
    orgId: string,
    userId: string,
    membership: OrganizationMembership,
    id: string | undefined,
    data: Partial<BarberClient>,
  ) {
    this.requireWrite(membership);
    const own = await this.ownProfessional(orgId, userId, membership);
    if (!this.admin(membership) && !own)
      throw new ForbiddenException(
        'A Member must be linked to a professional before managing clients.',
      );
    let item = id
      ? await this.clients.findOne({ where: { id, organizationId: orgId } })
      : null;
    if (id && !item) throw new NotFoundException('Client not found.');
    if (
      item &&
      !this.admin(membership) &&
      item.responsibleProfessionalId !== own?.id
    )
      throw new NotFoundException('Client not found.');
    if (data.responsibleProfessionalId)
      await this.assertProfessional(orgId, data.responsibleProfessionalId);
    item ??= this.clients.create({
      organizationId: orgId,
      createdByUserId: userId,
      fullName: data.fullName ?? '',
      phone: data.phone ?? '',
      responsibleProfessionalId: this.admin(membership)
        ? (data.responsibleProfessionalId ?? null)
        : (own?.id ?? null),
    });
    const { responsibleProfessionalId, ...fields } = data;
    Object.assign(item, fields);
    if (this.admin(membership) && responsibleProfessionalId !== undefined)
      item.responsibleProfessionalId = responsibleProfessionalId;
    return this.clients.save(item);
  }
  async assignManager(
    orgId: string,
    assignedByUserId: string,
    membership: OrganizationMembership,
    professionalId: string,
    userId: string,
    enabled: boolean,
  ) {
    if (!this.admin(membership))
      throw new ForbiddenException(
        'Only Owner or Admin can manage professional assignments.',
      );
    await this.assertProfessional(orgId, professionalId);
    const member = await this.users
      .createQueryBuilder('u')
      .innerJoin('u.memberships', 'm')
      .where(
        'u.id = :userId AND m.organization_id = :orgId AND m.role = :role',
        { userId, orgId, role: 'member' },
      )
      .getOne();
    if (!member) throw new NotFoundException('Organization Member not found.');
    if (enabled)
      await this.managers.upsert(
        { organizationId: orgId, professionalId, userId, assignedByUserId },
        ['organizationId', 'professionalId', 'userId'],
      );
    else
      await this.managers.delete({
        organizationId: orgId,
        professionalId,
        userId,
      });
    return { enabled };
  }
  async getOwnCustomer(userId: string) {
    const client = await this.clients.findOne({
      where: { userId },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        organizationId: true,
        createdAt: true,
      },
    });
    if (!client) throw new NotFoundException('Customer profile not found.');
    return client;
  }
}
