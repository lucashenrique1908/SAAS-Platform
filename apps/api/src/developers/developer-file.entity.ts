import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type DeveloperFilePurpose =
  'profile_photo' | 'project_cover' | 'certificate';

@Entity({ name: 'developer_files' })
@Index('ix_developer_files_profile_purpose', ['profileId', 'purpose'])
@Index('uq_developer_files_storage_key', ['storageKey'], { unique: true })
export class DeveloperFile {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_developer_files',
  })
  id!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @Column({ name: 'profile_id', type: 'uuid' }) profileId!: string;
  @Column({ name: 'owner_user_id', type: 'uuid' }) ownerUserId!: string;
  @Column({ type: 'varchar', length: 24 }) purpose!: DeveloperFilePurpose;
  @Column({ name: 'storage_key', type: 'varchar', length: 300 })
  storageKey!: string;
  @Column({ name: 'original_name', type: 'varchar', length: 180 })
  originalName!: string;
  @Column({ name: 'mime_type', type: 'varchar', length: 80 }) mimeType!: string;
  @Column({ name: 'size_bytes', type: 'integer' }) sizeBytes!: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
