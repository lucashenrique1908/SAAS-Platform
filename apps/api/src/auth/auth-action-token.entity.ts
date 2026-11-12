import {
  Column,
  Check,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { User } from '../users/user.entity.js';

export type AuthActionTokenPurpose = 'email_verification' | 'password_reset';

@Entity({ name: 'auth_action_tokens' })
@Check(
  'ck_auth_action_tokens_purpose',
  `"purpose" IN ('email_verification', 'password_reset')`,
)
@Index('uq_auth_action_tokens_hash', ['tokenHash'], { unique: true })
@Index('ix_auth_action_tokens_user_purpose', ['userId', 'purpose'])
export class AuthActionToken {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_auth_action_tokens',
  })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.actionTokens, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_auth_action_tokens_user',
  })
  user!: Relation<User>;

  @Column({ name: 'token_hash', type: 'char', length: 64, select: false })
  tokenHash!: string;

  @Column({ type: 'varchar', length: 32 })
  purpose!: AuthActionTokenPurpose;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
