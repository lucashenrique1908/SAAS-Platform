import {
  Column,
  Check,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { AuthSession } from '../sessions/auth-session.entity.js';
import { AuthActionToken } from '../auth/auth-action-token.entity.js';
import { OrganizationMembership } from '../organizations/organization-membership.entity.js';

export type PlatformRole = 'none' | 'platform_admin';

@Entity({ name: 'users' })
@Check(
  'ck_users_platform_role',
  `"platform_role" IN ('none', 'platform_admin')`,
)
@Index('uq_users_email', ['email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_users',
  })
  id!: string;

  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    select: false,
  })
  passwordHash!: string;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null;

  @Column({
    name: 'platform_role',
    type: 'varchar',
    length: 32,
    default: 'none',
  })
  platformRole!: PlatformRole;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => AuthSession, (session) => session.user)
  sessions!: Relation<AuthSession[]>;

  @OneToMany(() => OrganizationMembership, (membership) => membership.user)
  memberships!: Relation<OrganizationMembership[]>;

  @OneToMany(() => AuthActionToken, (token) => token.user)
  actionTokens!: Relation<AuthActionToken[]>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
