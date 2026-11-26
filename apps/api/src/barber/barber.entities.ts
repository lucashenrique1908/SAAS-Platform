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
