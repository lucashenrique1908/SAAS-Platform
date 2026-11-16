import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type DeveloperAvailability =
  'available' | 'open_to_offers' | 'not_looking';

@Entity({ name: 'developer_profiles' })
@Index('uq_developer_profiles_org_user', ['organizationId', 'userId'], {
  unique: true,
})
@Index('uq_developer_profiles_public_id', ['publicId'], { unique: true })
@Index('ix_developer_profiles_org_visibility', [
  'organizationId',
  'isPublic',
  'displayName',
])
export class DeveloperProfile {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_developer_profiles',
  })
  id!: string;

  @Column({
    name: 'public_id',
    type: 'uuid',
    default: () => 'gen_random_uuid()',
  })
  publicId!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 120 })
  displayName!: string;

  @Column({ name: 'photo_file_id', type: 'uuid', nullable: true })
  photoFileId!: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  title!: string | null;

  @Column({ type: 'text', nullable: true })
  biography!: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  location!: string | null;

  @Column({ name: 'years_experience', type: 'integer', nullable: true })
  yearsExperience!: number | null;

  @Column({ type: 'varchar', length: 24, default: 'open_to_offers' })
  availability!: DeveloperAvailability;

  @Column({ name: 'github_url', type: 'varchar', length: 2048, nullable: true })
  githubUrl!: string | null;

  @Column({
    name: 'linkedin_url',
    type: 'varchar',
    length: 2048,
    nullable: true,
  })
  linkedinUrl!: string | null;

  @Column({
    name: 'website_url',
    type: 'varchar',
    length: 2048,
    nullable: true,
  })
  websiteUrl!: string | null;

  @Column({ name: 'is_public', type: 'boolean', default: true })
  isPublic!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
