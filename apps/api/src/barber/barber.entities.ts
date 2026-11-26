import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('barber_business_profiles')
@Index('uq_barber_business_profiles_org', ['organizationId'], { unique: true })
export class BarberBusinessProfile {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @Column({ name: 'business_name', type: 'varchar', length: 160 })
  businessName!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ type: 'varchar', length: 320, nullable: true }) email!:
    string | null;
  @Column({ type: 'varchar', length: 40, nullable: true }) phone!:
    string | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) address!:
    string | null;
  @Column({
    name: 'timezone',
    type: 'varchar',
    length: 64,
    default: 'Europe/Lisbon',
  })
  timezone!: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity('barber_professionals')
@Index('ix_barber_professionals_org', ['organizationId'])
export class BarberProfessional {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @Column({ name: 'user_id', type: 'uuid', nullable: true }) userId!:
    string | null;
  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId!: string | null;
  @Column({ name: 'display_name', type: 'varchar', length: 160 })
  displayName!: string;
  @Column({ type: 'text', nullable: true }) bio!: string | null;
  @Column({ type: 'varchar', length: 40, nullable: true }) phone!:
    string | null;
  @Column({ type: 'varchar', length: 320, nullable: true }) email!:
    string | null;
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity('barber_professional_managers')
@Index(
  'uq_barber_professional_managers',
  ['organizationId', 'professionalId', 'userId'],
  { unique: true },
)
export class BarberProfessionalManager {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @Column({ name: 'professional_id', type: 'uuid' }) professionalId!: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId!: string;
  @Column({ name: 'assigned_by_user_id', type: 'uuid', nullable: true })
  assignedByUserId!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity('barber_services')
@Index('ix_barber_services_org', ['organizationId'])
export class BarberService {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId!: string | null;
  @Column({ type: 'varchar', length: 160 }) name!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ name: 'price_cents', type: 'integer' }) priceCents!: number;
  @Column({ name: 'duration_minutes', type: 'integer' })
  durationMinutes!: number;
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity('barber_professional_services')
@Index(
  'uq_barber_professional_services',
  ['organizationId', 'professionalId', 'serviceId'],
  { unique: true },
)
export class BarberProfessionalService {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @Column({ name: 'professional_id', type: 'uuid' }) professionalId!: string;
  @Column({ name: 'service_id', type: 'uuid' }) serviceId!: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity('barber_clients')
@Index('ix_barber_clients_org_responsible', [
  'organizationId',
  'responsibleProfessionalId',
])
export class BarberClient {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId!: string | null;
  @Column({ name: 'user_id', type: 'uuid', nullable: true }) userId!:
    string | null;
  @Column({ name: 'responsible_professional_id', type: 'uuid', nullable: true })
  responsibleProfessionalId!: string | null;
  @Column({ name: 'full_name', type: 'varchar', length: 160 })
  fullName!: string;
  @Column({ type: 'varchar', length: 40 }) phone!: string;
  @Column({ type: 'varchar', length: 320, nullable: true }) email!:
    string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity('barber_working_hours')
@Index('ix_barber_working_hours_org_prof_day', [
  'organizationId',
  'professionalId',
  'weekday',
])
export class BarberWorkingHours {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @Column({ name: 'professional_id', type: 'uuid', nullable: true })
  professionalId!: string | null;
  @Column({ type: 'smallint' }) weekday!: number;
  @Column({ name: 'start_time', type: 'time' }) startTime!: string;
  @Column({ name: 'end_time', type: 'time' }) endTime!: string;
}

@Entity('barber_availability_exceptions')
@Index('ix_barber_availability_exceptions_org_period', [
  'organizationId',
  'startsAt',
  'endsAt',
])
export class BarberAvailabilityException {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @Column({ name: 'professional_id', type: 'uuid', nullable: true })
  professionalId!: string | null;
  @Column({ type: 'varchar', length: 24 }) type!: string;
  @Column({ type: 'text', nullable: true }) reason!: string | null;
  @Column({ name: 'starts_at', type: 'timestamptz' }) startsAt!: Date;
  @Column({ name: 'ends_at', type: 'timestamptz' }) endsAt!: Date;
  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId!: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity('barber_appointments')
@Index('ix_barber_appointments_org_prof_start', [
  'organizationId',
  'professionalId',
  'startsAt',
])
@Index('ix_barber_appointments_org_client_start', [
  'organizationId',
  'clientId',
  'startsAt',
])
export class BarberAppointment {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId!: string;
  @Column({ name: 'professional_id', type: 'uuid' }) professionalId!: string;
  @Column({ name: 'client_id', type: 'uuid' }) clientId!: string;
  @Column({ name: 'service_id', type: 'uuid' }) serviceId!: string;
  @Column({ name: 'starts_at', type: 'timestamptz' }) startsAt!: Date;
  @Column({ name: 'ends_at', type: 'timestamptz' }) endsAt!: Date;
  @Column({ type: 'varchar', length: 16, default: 'PENDING' }) status!: string;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @Column({ name: 'service_name_snapshot', type: 'varchar', length: 160 })
  serviceNameSnapshot!: string;
  @Column({ name: 'price_cents_snapshot', type: 'integer' })
  priceCentsSnapshot!: number;
  @Column({ name: 'duration_minutes_snapshot', type: 'integer' })
  durationMinutesSnapshot!: number;
  @Column({ name: 'professional_name_snapshot', type: 'varchar', length: 160 })
  professionalNameSnapshot!: string;
  @Column({ name: 'client_name_snapshot', type: 'varchar', length: 160 })
  clientNameSnapshot!: string;
  @Column({ name: 'client_phone_snapshot', type: 'varchar', length: 40 })
  clientPhoneSnapshot!: string;
  @Column({
    name: 'client_email_snapshot',
    type: 'varchar',
    length: 320,
    nullable: true,
  })
  clientEmailSnapshot!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
