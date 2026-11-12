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
import { Organization } from './organization.entity.js';

export type OrganizationRole = 'owner' | 'admin' | 'member';

@Entity({ name: 'organization_memberships' })
@Check(
  'ck_organization_memberships_role',
  `"role" IN ('owner', 'admin', 'member')`,
)
@Index('uq_organization_memberships_user_org', ['userId', 'organizationId'], {
  unique: true,
})
@Index('ix_organization_memberships_org_role', ['organizationId', 'role'])
export class OrganizationMembership {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_organization_memberships',
  })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_organization_memberships_user',
  })
  user!: Relation<User>;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => Organization, (organization) => organization.memberships, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'organization_id',
    foreignKeyConstraintName: 'fk_organization_memberships_organization',
  })
  organization!: Relation<Organization>;

  @Column({ type: 'varchar', length: 16, default: 'member' })
  role!: OrganizationRole;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  permissions!: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
