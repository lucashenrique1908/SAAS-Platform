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
import type { OrganizationRole } from './organization-membership.entity.js';
import { Organization } from './organization.entity.js';

@Entity({ name: 'organization_invitations' })
@Index('uq_organization_invitations_token_hash', ['tokenHash'], {
  unique: true,
})
@Index('ix_organization_invitations_org_email', ['organizationId', 'email'])
export class OrganizationInvitation {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_organization_invitations',
  })
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => Organization, (organization) => organization.invitations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'organization_id',
    foreignKeyConstraintName: 'fk_organization_invitations_organization',
  })
  organization!: Relation<Organization>;

  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ name: 'token_hash', type: 'char', length: 64, select: false })
  tokenHash!: string;

  @Column({ type: 'varchar', length: 16, default: 'member' })
  role!: OrganizationRole;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  permissions!: string[];

  @Column({ name: 'invited_by_user_id', type: 'uuid', nullable: true })
  invitedByUserId!: string | null;

  @Column({ name: 'accepted_by_user_id', type: 'uuid', nullable: true })
  acceptedByUserId!: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
