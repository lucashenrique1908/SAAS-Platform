import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository, SelectQueryBuilder } from 'typeorm';
import type { OrganizationMembership } from '../organizations/organization-membership.entity.js';
import {
  BarberAppointment,
  BarberAvailabilityException,
  BarberBusinessProfile,
  BarberClient,
  BarberProfessional,
  BarberProfessionalManager,
  BarberProfessionalService,
  BarberService,
  BarberWorkingHours,
} from './barber.entities.js';
import {
  instantToLocalDateTime,
  localDateTimeToInstant,
  weekday,
} from './barber-time.utils.js';

const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED'];
const SLOT_MINUTES = 15;

@Injectable()
export class BarberSchedulingService {
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
    @InjectRepository(BarberWorkingHours)
    private readonly hours: Repository<BarberWorkingHours>,
    @InjectRepository(BarberAvailabilityException)
    private readonly exceptions: Repository<BarberAvailabilityException>,
    @InjectRepository(BarberAppointment)
    private readonly appointments: Repository<BarberAppointment>,
  ) {}

  private admin(membership: OrganizationMembership) {
    return membership.role === 'owner' || membership.role === 'admin';
  }

  private async lockOrganizationSchedule(
    manager: import('typeorm').EntityManager,
    organizationId: string,
  ) {
    await manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`barber-scheduling:${organizationId}`],
    );
  }

  private async timezone(organizationId: string) {
    return (
      (await this.profiles.findOne({ where: { organizationId } }))?.timezone ||
      'Europe/Lisbon'
    );
  }

  private async isResponsible(
    organizationId: string,
    professionalId: string,
    userId: string,
  ) {
    const [direct, assigned] = await Promise.all([
      this.professionals.exists({
        where: { organizationId, id: professionalId, userId },
      }),
      this.managers.exists({
        where: { organizationId, professionalId, userId },
      }),
    ]);
    return direct || assigned;
  }

  private async readableProfessionalIds(
    organizationId: string,
    userId: string,
    membership: OrganizationMembership,
  ): Promise<string[] | null> {
    if (this.admin(membership)) return null;
    const [direct, assigned] = await Promise.all([
      this.professionals.find({
        where: { organizationId, userId },
        select: { id: true },
      }),
      this.managers.find({
        where: { organizationId, userId },
        select: { professionalId: true },
      }),
    ]);
    return [
      ...new Set([
        ...direct.map((item) => item.id),
        ...assigned.map((item) => item.professionalId),
      ]),
    ];
  }

  private restrictAppointmentQuery(
    query: SelectQueryBuilder<BarberAppointment>,
    professionalIds: string[] | null,
  ) {
    if (professionalIds === null) return;
    if (!professionalIds.length) {
      query.andWhere('1 = 0');
      return;
    }
    query.andWhere('appointment.professional_id IN (:...professionalIds)', {
      professionalIds,
    });
  }

  private async requireProfessionalWrite(
    organizationId: string,
    professionalId: string | null,
    userId: string,
    membership: OrganizationMembership,
  ) {
    if (this.admin(membership)) return;
    if (!membership.permissions.includes('barber:write'))
      throw new ForbiddenException('Barber write permission required.');
    if (
      !professionalId ||
      !(await this.isResponsible(organizationId, professionalId, userId))
    ) {
      throw new ForbiddenException(
        'You may only manage your own or assigned professional schedule.',
      );
    }
  }

  async getWorkingHours(organizationId: string, professionalId?: string) {
    return this.hours.find({
      where: professionalId
        ? [
            { organizationId, professionalId },
            { organizationId, professionalId: IsNull() },
          ]
        : { organizationId, professionalId: IsNull() },
      order: { weekday: 'ASC', startTime: 'ASC' },
    });
  }

  async replaceWorkingHours(
    organizationId: string,
    userId: string,
    membership: OrganizationMembership,
    professionalId: string | null,
    periods: Array<{ weekday: number; startTime: string; endTime: string }>,
  ) {
    await this.requireProfessionalWrite(
      organizationId,
      professionalId,
      userId,
      membership,
    );
    if (
      professionalId &&
      !(await this.professionals.exists({
        where: { id: professionalId, organizationId },
      }))
    ) {
      throw new NotFoundException('Professional not found.');
    }
    const byDay = new Map<
      number,
      Array<{ startTime: string; endTime: string }>
    >();
    for (const period of periods) {
      if (
        !Number.isInteger(period.weekday) ||
        period.weekday < 0 ||
        period.weekday > 6 ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(period.startTime) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(period.endTime) ||
        period.startTime >= period.endTime
      ) {
        throw new BadRequestException(
          'Working periods require a weekday and a valid start before end time.',
        );
      }
      const intervals = byDay.get(period.weekday) ?? [];
      intervals.push({ startTime: period.startTime, endTime: period.endTime });
      byDay.set(period.weekday, intervals);
    }
    for (const intervals of byDay.values()) {
      intervals.sort((a, b) => a.startTime.localeCompare(b.startTime));
      for (let index = 1; index < intervals.length; index++) {
        if (intervals[index].startTime < intervals[index - 1].endTime) {
          throw new BadRequestException(
            'Working periods on the same weekday may not overlap.',
          );
        }
      }
    }
    return this.dataSource.transaction(async (manager) => {
      await this.lockOrganizationSchedule(manager, organizationId);
      const repository = manager.getRepository(BarberWorkingHours);
      await repository.delete({
        organizationId,
        professionalId: professionalId ?? IsNull(),
      });
      if (!periods.length) return [];
      return repository.save(
        periods.map((period) =>
          repository.create({ ...period, organizationId, professionalId }),
        ),
      );
    });
  }

  async listExceptions(
    organizationId: string,
    query: { from?: string; to?: string; professionalId?: string },
  ) {
    const qb = this.exceptions
      .createQueryBuilder('exception')
      .where('exception.organization_id = :organizationId', { organizationId });
    if (query.from)
      qb.andWhere('exception.ends_at > :from', { from: new Date(query.from) });
    if (query.to)
      qb.andWhere('exception.starts_at < :to', { to: new Date(query.to) });
    if (query.professionalId)
      qb.andWhere(
        '(exception.professional_id = :professionalId OR exception.professional_id IS NULL)',
        { professionalId: query.professionalId },
      );
    return qb.orderBy('exception.starts_at', 'ASC').getMany();
  }

  async getException(organizationId: string, id: string) {
    const item = await this.exceptions.findOne({
      where: { id, organizationId },
    });
    if (!item) throw new NotFoundException('Availability exception not found.');
    return item;
  }

  async createException(
    organizationId: string,
    userId: string,
    membership: OrganizationMembership,
    input: {
      professionalId?: string | null;
      type: string;
      reason?: string | null;
      date: string;
      startTime: string;
      endDate: string;
      endTime: string;
    },
  ) {
    const professionalId = input.professionalId ?? null;
    await this.requireProfessionalWrite(
      organizationId,
      professionalId,
      userId,
      membership,
    );
    if (
      professionalId &&
      !(await this.professionals.exists({
        where: { id: professionalId, organizationId },
      }))
    )
      throw new NotFoundException('Professional not found.');
    const timeZone = await this.timezone(organizationId);
    const startsAt = localDateTimeToInstant(
      input.date,
      input.startTime,
      timeZone,
    );
    const endsAt = localDateTimeToInstant(
      input.endDate,
      input.endTime,
      timeZone,
    );
    if (startsAt >= endsAt)
      throw new BadRequestException(
        'The end of an availability exception must be after its start.',
      );
    return this.dataSource.transaction(async (manager) => {
      await this.lockOrganizationSchedule(manager, organizationId);
      const repository = manager.getRepository(BarberAppointment);
      const affected = await repository
        .createQueryBuilder('appointment')
        .where('appointment.organization_id = :organizationId', {
          organizationId,
        })
        .andWhere('appointment.status IN (:...statuses)', {
          statuses: ACTIVE_STATUSES,
        })
        .andWhere(
          'appointment.starts_at < :endsAt AND appointment.ends_at > :startsAt',
          { startsAt, endsAt },
        )
        .andWhere(
          professionalId
            ? 'appointment.professional_id = :professionalId'
            : '1=1',
          { professionalId },
        )
        .select([
          'appointment.id',
          'appointment.startsAt',
          'appointment.endsAt',
          'appointment.clientNameSnapshot',
        ])
        .getMany();
      if (affected.length) {
        throw new ConflictException({
          message:
            'This absence overlaps existing appointments. Review and reschedule or cancel them before adding the block.',
          conflicts: affected.map((item) => ({
            id: item.id,
            startsAt: item.startsAt,
            endsAt: item.endsAt,
            clientName: item.clientNameSnapshot,
          })),
        });
      }
      return manager.getRepository(BarberAvailabilityException).save({
        organizationId,
        professionalId,
        type: input.type,
        reason: input.reason ?? null,
        startsAt,
        endsAt,
        createdByUserId: userId,
      });
    });
  }

  async updateException(
    organizationId: string,
    id: string,
    userId: string,
    membership: OrganizationMembership,
    input: Parameters<BarberSchedulingService['createException']>[3],
  ) {
    const existing = await this.exceptions.findOne({
      where: { id, organizationId },
    });
    if (!existing)
      throw new NotFoundException('Availability exception not found.');
    await this.requireProfessionalWrite(
      organizationId,
      existing.professionalId,
      userId,
      membership,
    );
    const professionalId = input.professionalId ?? null;
    await this.requireProfessionalWrite(
      organizationId,
      professionalId,
      userId,
      membership,
    );
    if (
      professionalId &&
      !(await this.professionals.exists({
        where: { id: professionalId, organizationId },
      }))
    )
      throw new NotFoundException('Professional not found.');
    const timeZone = await this.timezone(organizationId);
    const startsAt = localDateTimeToInstant(
      input.date,
      input.startTime,
      timeZone,
    );
    const endsAt = localDateTimeToInstant(
      input.endDate,
      input.endTime,
      timeZone,
    );
    if (startsAt >= endsAt)
      throw new BadRequestException(
        'The end of an availability exception must be after its start.',
      );
    return this.dataSource.transaction(async (manager) => {
      await this.lockOrganizationSchedule(manager, organizationId);
      const latest = await manager
        .getRepository(BarberAvailabilityException)
        .findOne({ where: { id, organizationId } });
      if (!latest)
        throw new NotFoundException('Availability exception not found.');
      await this.requireProfessionalWrite(
        organizationId,
        latest.professionalId,
        userId,
        membership,
      );
      const appointmentRepository = manager.getRepository(BarberAppointment);
      const affected = await appointmentRepository
        .createQueryBuilder('appointment')
        .where('appointment.organization_id = :organizationId', {
          organizationId,
        })
        .andWhere('appointment.status IN (:...statuses)', {
          statuses: ACTIVE_STATUSES,
        })
        .andWhere(
          'appointment.starts_at < :endsAt AND appointment.ends_at > :startsAt',
          { startsAt, endsAt },
        )
        .andWhere(
          professionalId
            ? 'appointment.professional_id = :professionalId'
            : '1=1',
          { professionalId },
        )
        .select([
          'appointment.id',
          'appointment.startsAt',
          'appointment.endsAt',
          'appointment.clientNameSnapshot',
        ])
        .getMany();
      if (affected.length)
        throw new ConflictException({
          message: 'This absence overlaps existing appointments.',
          conflicts: affected.map((item) => ({
            id: item.id,
            startsAt: item.startsAt,
            endsAt: item.endsAt,
            clientName: item.clientNameSnapshot,
          })),
        });
      Object.assign(latest, {
        professionalId,
        type: input.type,
        reason: input.reason ?? null,
        startsAt,
        endsAt,
      });
      return manager.getRepository(BarberAvailabilityException).save(latest);
    });
  }

  async removeException(
    organizationId: string,
    id: string,
    userId: string,
    membership: OrganizationMembership,
  ) {
    const item = await this.exceptions.findOne({
      where: { id, organizationId },
    });
    if (!item) throw new NotFoundException('Availability exception not found.');
    await this.requireProfessionalWrite(
      organizationId,
      item.professionalId,
      userId,
      membership,
    );
    return this.dataSource.transaction(async (manager) => {
      await this.lockOrganizationSchedule(manager, organizationId);
      const latest = await manager
        .getRepository(BarberAvailabilityException)
        .findOne({ where: { id, organizationId } });
      if (!latest)
        throw new NotFoundException('Availability exception not found.');
      await this.requireProfessionalWrite(
        organizationId,
        latest.professionalId,
        userId,
        membership,
      );
      await manager.getRepository(BarberAvailabilityException).remove(latest);
      return { deleted: true };
    });
  }

  async availability(
    organizationId: string,
    query: {
      serviceId: string;
      date: string;
      professionalId?: string;
      excludingAppointmentId?: string;
    },
  ) {
    const timeZone = await this.timezone(organizationId);
    const service = await this.services.findOne({
      where: { id: query.serviceId, organizationId, isActive: true },
    });
    if (!service) throw new NotFoundException('Active service not found.');
    const associations = await this.professionalServices.find({
      where: { organizationId, serviceId: service.id },
    });
    const candidates = await this.professionals.find({
      where: {
        organizationId,
        isActive: true,
        ...(query.professionalId ? { id: query.professionalId } : {}),
      },
      order: { displayName: 'ASC' },
    });
    const associated = new Set(associations.map((row) => row.professionalId));
    const localWeekday = weekday(query.date);
    const dayStart = localDateTimeToInstant(query.date, '00:00', timeZone);
    const nextDate = new Date(
      Date.UTC(
        Number(query.date.slice(0, 4)),
        Number(query.date.slice(5, 7)) - 1,
        Number(query.date.slice(8, 10)) + 1,
      ),
    );
    const nextLocalDate = `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, '0')}-${String(nextDate.getUTCDate()).padStart(2, '0')}`;
    const dayEnd = localDateTimeToInstant(nextLocalDate, '00:00', timeZone);
    const businessPeriods = await this.hours.find({
      where: {
        organizationId,
        professionalId: IsNull(),
        weekday: localWeekday,
      },
      order: { startTime: 'ASC' },
    });
    const results: Array<{
      professionalId: string;
      professionalName: string;
      startsAt: string;
      endsAt: string;
      startTime: string;
      endTime: string;
    }> = [];
    for (const professional of candidates.filter((item) =>
      associated.has(item.id),
    )) {
      const workingPeriods = await this.hours.find({
        where: {
          organizationId,
          professionalId: professional.id,
          weekday: localWeekday,
        },
        order: { startTime: 'ASC' },
      });
      const exceptions = await this.exceptions
        .createQueryBuilder('exception')
        .where('exception.organization_id = :organizationId', {
          organizationId,
        })
        .andWhere(
          '(exception.professional_id = :professionalId OR exception.professional_id IS NULL)',
          { professionalId: professional.id },
        )
        .andWhere(
          'exception.starts_at < :dayEnd AND exception.ends_at > :dayStart',
          { dayStart, dayEnd },
        )
        .getMany();
      const busyQuery = this.appointments
        .createQueryBuilder('appointment')
        .where(
          'appointment.organization_id = :organizationId AND appointment.professional_id = :professionalId',
          { organizationId, professionalId: professional.id },
        )
        .andWhere('appointment.status IN (:...statuses)', {
          statuses: ACTIVE_STATUSES,
        })
        .andWhere(
          'appointment.starts_at < :dayEnd AND appointment.ends_at > :dayStart',
          { dayStart, dayEnd },
        );
      if (query.excludingAppointmentId)
        busyQuery.andWhere('appointment.id != :excludingAppointmentId', {
          excludingAppointmentId: query.excludingAppointmentId,
        });
      const busy = await busyQuery.getMany();
      for (const work of workingPeriods) {
        for (const business of businessPeriods) {
          const from = Math.max(
            this.minutes(work.startTime),
            this.minutes(business.startTime),
          );
          const to = Math.min(
            this.minutes(work.endTime),
            this.minutes(business.endTime),
          );
          for (
            let minute = from;
            minute + service.durationMinutes <= to;
            minute += SLOT_MINUTES
          ) {
            const startTime = this.clock(minute);
            let startsAt: Date;
            try {
              startsAt = localDateTimeToInstant(
                query.date,
                startTime,
                timeZone,
              );
            } catch {
              continue;
            }
            const endsAt = new Date(
              startsAt.getTime() + service.durationMinutes * 60_000,
            );
            const localEnd = instantToLocalDateTime(endsAt, timeZone);
            if (
              localEnd.date !== query.date ||
              this.minutes(localEnd.time) > to
            )
              continue;
            if (
              exceptions.some(
                (item) => item.startsAt < endsAt && item.endsAt > startsAt,
              )
            )
              continue;
            if (
              busy.some(
                (item) => item.startsAt < endsAt && item.endsAt > startsAt,
              )
            )
              continue;
            results.push({
              professionalId: professional.id,
              professionalName: professional.displayName,
              startsAt: startsAt.toISOString(),
              endsAt: endsAt.toISOString(),
              startTime,
              endTime: localEnd.time,
            });
          }
        }
      }
    }
    return results.sort(
      (a, b) =>
        a.startsAt.localeCompare(b.startsAt) ||
        a.professionalName.localeCompare(b.professionalName),
    );
  }

  private minutes(time: string) {
    const [hour, minute] = time.slice(0, 5).split(':').map(Number);
    return hour * 60 + minute;
  }
  private clock(minutes: number) {
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }

  private async buildAppointment(
    manager: import('typeorm').EntityManager,
    organizationId: string,
    userId: string,
    input: {
      clientId: string;
      professionalId: string;
      serviceId: string;
      date: string;
      startTime: string;
      notes?: string | null;
    },
    existingId?: string,
  ) {
    const service = await manager.getRepository(BarberService).findOne({
      where: { id: input.serviceId, organizationId, isActive: true },
    });
    const professional = await manager
      .getRepository(BarberProfessional)
      .findOne({
        where: { id: input.professionalId, organizationId, isActive: true },
      });
    const client = await manager
      .getRepository(BarberClient)
      .findOne({ where: { id: input.clientId, organizationId } });
    if (!service) throw new NotFoundException('Active service not found.');
    if (!professional)
      throw new NotFoundException('Active professional not found.');
    if (!client) throw new NotFoundException('Client not found.');
    const associated = await manager
      .getRepository(BarberProfessionalService)
      .exists({
        where: {
          organizationId,
          serviceId: service.id,
          professionalId: professional.id,
        },
      });
    if (!associated)
      throw new BadRequestException(
        'This service is not available for the selected professional.',
      );
    const timeZone =
      (
        await manager
          .getRepository(BarberBusinessProfile)
          .findOne({ where: { organizationId } })
      )?.timezone || 'Europe/Lisbon';
    const startsAt = localDateTimeToInstant(
      input.date,
      input.startTime,
      timeZone,
    );
    const endsAt = new Date(
      startsAt.getTime() + service.durationMinutes * 60_000,
    );
    const localEnd = instantToLocalDateTime(endsAt, timeZone);
    if (localEnd.date !== input.date)
      throw new BadRequestException(
        'Appointments may not cross the local day boundary.',
      );
    const day = weekday(input.date);
    const [business, professionalHours] = await Promise.all([
      manager.getRepository(BarberWorkingHours).find({
        where: { organizationId, professionalId: IsNull(), weekday: day },
      }),
      manager.getRepository(BarberWorkingHours).find({
        where: {
          organizationId,
          professionalId: professional.id,
          weekday: day,
        },
      }),
    ]);
    const fits = (periods: BarberWorkingHours[]) =>
      periods.some(
        (period) =>
          input.startTime >= period.startTime.slice(0, 5) &&
          localEnd.time <= period.endTime.slice(0, 5),
      );
    if (!fits(business) || !fits(professionalHours))
      throw new ConflictException(
        'The professional is not working during this period.',
      );
    const exception = await manager
      .getRepository(BarberAvailabilityException)
      .createQueryBuilder('exception')
      .where('exception.organization_id = :organizationId', { organizationId })
      .andWhere(
        '(exception.professional_id = :professionalId OR exception.professional_id IS NULL)',
        { professionalId: professional.id },
      )
      .andWhere(
        'exception.starts_at < :endsAt AND exception.ends_at > :startsAt',
        { startsAt, endsAt },
      )
      .getOne();
    if (exception)
      throw new ConflictException(
        'An availability block overlaps this appointment.',
      );
    const conflicts = manager
      .getRepository(BarberAppointment)
      .createQueryBuilder('appointment')
      .where(
        'appointment.organization_id = :organizationId AND appointment.professional_id = :professionalId',
        { organizationId, professionalId: professional.id },
      )
      .andWhere('appointment.status IN (:...statuses)', {
        statuses: ACTIVE_STATUSES,
      })
      .andWhere(
        'appointment.starts_at < :endsAt AND appointment.ends_at > :startsAt',
        { startsAt, endsAt },
      )
      .setParameters({ statuses: ACTIVE_STATUSES });
    if (existingId)
      conflicts.andWhere('appointment.id != :existingId', { existingId });
    if (await conflicts.getExists())
      throw new ConflictException(
        'The professional already has an appointment during this period.',
      );
    const repository = manager.getRepository(BarberAppointment);
    return repository.create({
      ...(existingId ? { id: existingId } : {}),
      organizationId,
      createdByUserId: userId,
      professionalId: professional.id,
      clientId: client.id,
      serviceId: service.id,
      startsAt,
      endsAt,
      notes: input.notes ?? null,
      serviceNameSnapshot: service.name,
      priceCentsSnapshot: service.priceCents,
      durationMinutesSnapshot: service.durationMinutes,
      professionalNameSnapshot: professional.displayName,
      clientNameSnapshot: client.fullName,
      clientPhoneSnapshot: client.phone,
      clientEmailSnapshot: client.email,
    });
  }

  async createAppointment(
    organizationId: string,
    userId: string,
    membership: OrganizationMembership,
    input: Parameters<BarberSchedulingService['buildAppointment']>[3],
  ) {
    if (
      !this.admin(membership) &&
      !membership.permissions.includes('barber:write')
    )
      throw new ForbiddenException('Barber write permission required.');
    if (!this.admin(membership)) {
      const client = await this.clients.findOne({
        where: { id: input.clientId, organizationId },
      });
      if (
        !client ||
        !client.responsibleProfessionalId ||
        !(await this.isResponsible(
          organizationId,
          client.responsibleProfessionalId,
          userId,
        ))
      ) {
        throw new NotFoundException('Client not found.');
      }
    }
    return this.dataSource.transaction(async (manager) => {
      await this.lockOrganizationSchedule(manager, organizationId);
      const item = await this.buildAppointment(
        manager,
        organizationId,
        userId,
        input,
      );
      return manager.getRepository(BarberAppointment).save(item);
    });
  }

  async listAppointments(
    organizationId: string,
    userId: string,
    membership: OrganizationMembership,
    query: {
      from?: string;
      to?: string;
      date?: string;
      professionalId?: string;
      clientId?: string;
      status?: string;
    },
  ) {
    const readableProfessionalIds = await this.readableProfessionalIds(
      organizationId,
      userId,
      membership,
    );
    const qb = this.appointments
      .createQueryBuilder('appointment')
      .where('appointment.organization_id = :organizationId', {
        organizationId,
      });
    this.restrictAppointmentQuery(qb, readableProfessionalIds);
    if (query.date) {
      const timeZone = await this.timezone(organizationId);
      const start = localDateTimeToInstant(query.date, '00:00', timeZone);
      const next = new Date(
        Date.UTC(
          Number(query.date.slice(0, 4)),
          Number(query.date.slice(5, 7)) - 1,
          Number(query.date.slice(8, 10)) + 1,
        ),
      );
      const nextDate = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
      const end = localDateTimeToInstant(nextDate, '00:00', timeZone);
      qb.andWhere(
        'appointment.starts_at >= :dayStart AND appointment.starts_at < :dayEnd',
        { dayStart: start, dayEnd: end },
      );
    }
    if (query.from)
      qb.andWhere('appointment.starts_at >= :from', {
        from: new Date(query.from),
      });
    if (query.to)
      qb.andWhere('appointment.starts_at < :to', { to: new Date(query.to) });
    if (query.professionalId)
      qb.andWhere('appointment.professional_id = :professionalId', {
        professionalId: query.professionalId,
      });
    if (query.clientId)
      qb.andWhere('appointment.client_id = :clientId', {
        clientId: query.clientId,
      });
    if (query.status) {
      if (
        !['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].includes(
          query.status,
        )
      )
        throw new BadRequestException('Appointment status is invalid.');
      qb.andWhere('appointment.status = :status', { status: query.status });
    }
    const rows = await qb.orderBy('appointment.starts_at', 'ASC').getMany();
    return Promise.all(
      rows.map(async (item) => {
        const canManage =
          this.admin(membership) ||
          (membership.permissions.includes('barber:write') &&
            (item.createdByUserId === userId ||
              (await this.isResponsible(
                organizationId,
                item.professionalId,
                userId,
              ))));
        return Object.assign(item, { canManage });
      }),
    );
  }

  private async findAppointment(organizationId: string, id: string) {
    const item = await this.appointments.findOne({
      where: { id, organizationId },
    });
    if (!item) throw new NotFoundException('Appointment not found.');
    return item;
  }

  async getAppointment(
    organizationId: string,
    id: string,
    userId: string,
    membership: OrganizationMembership,
  ) {
    const item = await this.findAppointment(organizationId, id);
    if (
      !this.admin(membership) &&
      !(await this.isResponsible(organizationId, item.professionalId, userId))
    ) {
      throw new NotFoundException('Appointment not found.');
    }
    return item;
  }

  private async requireAppointmentWrite(
    item: BarberAppointment,
    userId: string,
    membership: OrganizationMembership,
  ) {
    if (this.admin(membership)) return;
    if (!membership.permissions.includes('barber:write'))
      throw new ForbiddenException('Barber write permission required.');
    if (
      item.createdByUserId !== userId &&
      !(await this.isResponsible(
        item.organizationId,
        item.professionalId,
        userId,
      ))
    )
      throw new NotFoundException('Appointment not found.');
  }

  async updateAppointment(
    organizationId: string,
    id: string,
    userId: string,
    membership: OrganizationMembership,
    input: Parameters<BarberSchedulingService['buildAppointment']>[3],
  ) {
    const current = await this.findAppointment(organizationId, id);
    await this.requireAppointmentWrite(current, userId, membership);
    if (!ACTIVE_STATUSES.includes(current.status))
      throw new ConflictException(
        'Only pending or confirmed appointments may be changed.',
      );
    if (
      !this.admin(membership) &&
      input.professionalId !== current.professionalId
    )
      throw new ForbiddenException(
        'Members cannot reassign an appointment to another professional.',
      );
    if (!this.admin(membership) && input.clientId !== current.clientId) {
      const client = await this.clients.findOne({
        where: { id: input.clientId, organizationId },
      });
      if (
        !client ||
        !client.responsibleProfessionalId ||
        !(await this.isResponsible(
          organizationId,
          client.responsibleProfessionalId,
          userId,
        ))
      )
        throw new NotFoundException('Client not found.');
    }
    return this.dataSource.transaction(async (manager) => {
      await this.lockOrganizationSchedule(manager, organizationId);
      const latest = await manager
        .getRepository(BarberAppointment)
        .findOne({ where: { id, organizationId } });
      if (!latest) throw new NotFoundException('Appointment not found.');
      await this.requireAppointmentWrite(latest, userId, membership);
      if (!ACTIVE_STATUSES.includes(latest.status))
        throw new ConflictException(
          'Only pending or confirmed appointments may be changed.',
        );
      if (
        !this.admin(membership) &&
        input.professionalId !== latest.professionalId
      )
        throw new ForbiddenException(
          'Members cannot reassign an appointment to another professional.',
        );
      const item = await this.buildAppointment(
        manager,
        organizationId,
        latest.createdByUserId,
        input,
        id,
      );
      item.status = latest.status;
      return manager.getRepository(BarberAppointment).save(item);
    });
  }

  async changeAppointmentStatus(
    organizationId: string,
    id: string,
    userId: string,
    membership: OrganizationMembership,
    status: string,
  ) {
    const item = await this.findAppointment(organizationId, id);
    await this.requireAppointmentWrite(item, userId, membership);
    const allowed: Record<string, string[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['COMPLETED', 'CANCELLED'],
    };
    if (!allowed[item.status]?.includes(status))
      throw new ConflictException(
        `Appointment cannot transition from ${item.status} to ${status}.`,
      );
    return this.dataSource.transaction(async (manager) => {
      await this.lockOrganizationSchedule(manager, organizationId);
      const latest = await manager
        .getRepository(BarberAppointment)
        .findOne({ where: { id, organizationId } });
      if (!latest) throw new NotFoundException('Appointment not found.');
      await this.requireAppointmentWrite(latest, userId, membership);
      if (!allowed[latest.status]?.includes(status))
        throw new ConflictException(
          `Appointment cannot transition from ${latest.status} to ${status}.`,
        );
      latest.status = status;
      return manager.getRepository(BarberAppointment).save(latest);
    });
  }

  async dashboard(
    organizationId: string,
    userId: string,
    membership: OrganizationMembership,
  ) {
    const readableProfessionalIds = await this.readableProfessionalIds(
      organizationId,
      userId,
      membership,
    );
    const timeZone = await this.timezone(organizationId);
    const now = new Date();
    const local = instantToLocalDateTime(now, timeZone);
    const start = localDateTimeToInstant(local.date, '00:00', timeZone);
    const next = new Date(
      Date.UTC(
        Number(local.date.slice(0, 4)),
        Number(local.date.slice(5, 7)) - 1,
        Number(local.date.slice(8, 10)) + 1,
      ),
    );
    const nextDate = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
    const end = localDateTimeToInstant(nextDate, '00:00', timeZone);
    const countToday = (status?: string) => {
      const query = this.appointments
        .createQueryBuilder('appointment')
        .where('appointment.organization_id = :organizationId', {
          organizationId,
        })
        .andWhere(
          'appointment.starts_at >= :start AND appointment.starts_at < :end',
          { start, end },
        );
      this.restrictAppointmentQuery(query, readableProfessionalIds);
      if (status) query.andWhere('appointment.status = :status', { status });
      return query.getCount();
    };
    const upcomingQuery = this.appointments
      .createQueryBuilder('appointment')
      .where('appointment.organization_id = :organizationId', {
        organizationId,
      })
      .andWhere('appointment.starts_at > :end', { end })
      .andWhere('appointment.status != :cancelled', { cancelled: 'CANCELLED' })
      .orderBy('appointment.starts_at', 'ASC')
      .take(8);
    this.restrictAppointmentQuery(upcomingQuery, readableProfessionalIds);
    const [today, upcoming, pending, confirmed, completed, cancelled] =
      await Promise.all([
        countToday(),
        upcomingQuery.getMany(),
        countToday('PENDING'),
        countToday('CONFIRMED'),
        countToday('COMPLETED'),
        countToday('CANCELLED'),
      ]);
    return {
      date: local.date,
      timeZone,
      today,
      upcoming,
      counts: { pending, confirmed, completed, cancelled },
    };
  }
}
