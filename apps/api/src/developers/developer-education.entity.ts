import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'developer_education' })
@Index('ix_developer_education_profile_dates', [
  'profileId',
  'startDate',
  'endDate',
])
export class DeveloperEducation {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_developer_education',
  })
  id!: string;

  @Column({ name: 'profile_id', type: 'uuid' })
  profileId!: string;

  @Column({ type: 'varchar', length: 180 })
  institution!: string;

  @Column({ type: 'varchar', length: 180 })
  course!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  degree!: string | null;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate!: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate!: string | null;

  @Column({ name: 'is_in_progress', type: 'boolean', default: false })
  isInProgress!: boolean;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    name: 'institution_url',
    type: 'varchar',
    length: 2048,
    nullable: true,
  })
  institutionUrl!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
