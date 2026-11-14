import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { User } from '../users/user.entity.js';
import { Organization } from '../organizations/organization.entity.js';

@Entity({ name: 'auth_sessions' })
@Index('uq_auth_sessions_token_hash', ['tokenHash'], { unique: true })
@Index('ix_auth_sessions_user_expiry', ['userId', 'expiresAt'])
@Index('ix_auth_sessions_active_organization', ['activeOrganizationId'])
export class AuthSession {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_auth_sessions',
  })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_auth_sessions_user',
  })
  user!: Relation<User>;

  @Column({ name: 'active_organization_id', type: 'uuid', nullable: true })
  activeOrganizationId!: string | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'active_organization_id',
    foreignKeyConstraintName: 'fk_auth_sessions_active_organization',
  })
  activeOrganization!: Relation<Organization | null>;

  @Column({ name: 'token_hash', type: 'char', length: 64, select: false })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'last_seen_at', type: 'timestamptz' })
  lastSeenAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
