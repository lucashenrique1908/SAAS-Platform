import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'developer_projects' })
@Index('ix_developer_projects_profile_featured_order', [
  'profileId',
  'isFeatured',
  'displayOrder',
])
@Index('ix_developer_projects_profile_status', ['profileId', 'status'])
@Index(
  'uq_developer_projects_profile_repository',
  ['profileId', 'repositoryUrl'],
  {
    unique: true,
    where: '"repository_url" IS NOT NULL',
  },
)
export class DeveloperProject {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_developer_projects',
  })
  id!: string;

  @Column({ name: 'profile_id', type: 'uuid' })
  profileId!: string;

  @Column({ type: 'varchar', length: 180 })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'problem_solved', type: 'text', nullable: true })
  problemSolved!: string | null;

  @Column({ name: 'cover_file_id', type: 'uuid', nullable: true })
  coverFileId!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  technologies!: string[];

  @Column({ name: 'live_url', type: 'varchar', length: 2048, nullable: true })
  liveUrl!: string | null;

  @Column({
    name: 'repository_url',
    type: 'varchar',
    length: 2048,
    nullable: true,
  })
  repositoryUrl!: string | null;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate!: string | null;

  @Column({ name: 'completion_date', type: 'date', nullable: true })
  completionDate!: string | null;

  @Column({ type: 'varchar', length: 24, default: 'in_progress' })
  status!: 'in_progress' | 'completed' | 'archived';

  @Column({ name: 'member_role', type: 'varchar', length: 160, nullable: true })
  memberRole!: string | null;

  @Column({
    name: 'project_type',
    type: 'varchar',
    length: 16,
    default: 'individual',
  })
  projectType!: 'individual' | 'team';

  @Column({
    name: 'main_features',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  mainFeatures!: string[];

  @Column({ name: 'is_featured', type: 'boolean', default: false })
  isFeatured!: boolean;

  @Column({ name: 'is_public', type: 'boolean', default: false })
  isPublic!: boolean;

  @Column({ name: 'display_order', type: 'integer', default: 0 })
  displayOrder!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
