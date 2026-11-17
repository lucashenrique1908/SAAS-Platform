import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'developer_certifications' })
@Index('ix_developer_certifications_profile_issue', ['profileId', 'issueDate'])
export class DeveloperCertification {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_developer_certifications',
  })
  id!: string;

  @Column({ name: 'profile_id', type: 'uuid' })
  profileId!: string;

  @Column({ type: 'varchar', length: 180 })
  name!: string;

  @Column({ name: 'issuing_institution', type: 'varchar', length: 180 })
  issuingInstitution!: string;

  @Column({ name: 'issue_date', type: 'date', nullable: true })
  issueDate!: string | null;

  @Column({ name: 'expiration_date', type: 'date', nullable: true })
  expirationDate!: string | null;

  @Column({
    name: 'credential_url',
    type: 'varchar',
    length: 2048,
    nullable: true,
  })
  credentialUrl!: string | null;

  @Column({ name: 'certificate_file_id', type: 'uuid', nullable: true })
  certificateFileId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
