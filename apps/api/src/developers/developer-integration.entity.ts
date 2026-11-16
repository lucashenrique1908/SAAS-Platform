import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type DeveloperIntegrationProvider =
  'github' | 'google_calendar' | 'linkedin';

@Entity({ name: 'developer_integrations' })
@Index(
  'uq_developer_integrations_user_org_provider',
  ['userId', 'organizationId', 'provider'],
  { unique: true },
)
export class DeveloperIntegration {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_developer_integrations',
  })
  id!: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @Column({ type: 'varchar', length: 32 })
  provider!: DeveloperIntegrationProvider;
  @Column({ name: 'provider_account_id', type: 'varchar', length: 180 })
  providerAccountId!: string;
  @Column({
    name: 'provider_display_name',
    type: 'varchar',
    length: 180,
    nullable: true,
  })
  providerDisplayName!: string | null;
  @Column({ name: 'access_token_encrypted', type: 'text', select: false })
  accessTokenEncrypted!: string;
  @Column({
    name: 'refresh_token_encrypted',
    type: 'text',
    nullable: true,
    select: false,
  })
  refreshTokenEncrypted!: string | null;
  @Column({ name: 'access_expires_at', type: 'timestamptz', nullable: true })
  accessExpiresAt!: Date | null;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) scopes!: string[];
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
