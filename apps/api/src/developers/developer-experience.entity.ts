import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'developer_experiences' })
@Index('ix_developer_experiences_profile_dates', [
  'profileId',
  'startDate',
  'endDate',
])
export class DeveloperExperience {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_developer_experiences',
  })
  id!: string;

  @Column({ name: 'profile_id', type: 'uuid' })
  profileId!: string;

  @Column({ name: 'job_title', type: 'varchar', length: 160 })
  jobTitle!: string;

  @Column({ type: 'varchar', length: 160 })
  company!: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  location!: string | null;

  @Column({
    name: 'employment_type',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  employmentType!: string | null;

  @Column({
    name: 'work_modality',
    type: 'varchar',
    length: 24,
    nullable: true,
  })
  workModality!: string | null;

  @Column({ name: 'start_date', type: 'date' })
  startDate!: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate!: string | null;

  @Column({ name: 'is_current', type: 'boolean', default: false })
  isCurrent!: boolean;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  responsibilities!: string[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  achievements!: string[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  technologies!: string[];

  @Column({
    name: 'company_url',
    type: 'varchar',
    length: 2048,
    nullable: true,
  })
  companyUrl!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
