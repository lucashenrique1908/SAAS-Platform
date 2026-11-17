import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { DeveloperIntegrationProvider } from './developer-integration.entity.js';

@Entity({ name: 'developer_oauth_states' })
@Index('uq_developer_oauth_states_hash', ['stateHash'], { unique: true })
@Index('ix_developer_oauth_states_expiry', ['expiresAt'])
export class DeveloperOAuthState {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_developer_oauth_states',
  })
  id!: string;
  @Column({ name: 'state_hash', type: 'char', length: 64 }) stateHash!: string;
  @Column({ type: 'varchar', length: 32 })
  provider!: DeveloperIntegrationProvider;
  @Column({ name: 'user_id', type: 'uuid' }) userId!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt!: Date;
  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt!: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
