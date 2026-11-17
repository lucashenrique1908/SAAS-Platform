import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { OrganizationMembership } from './organization-membership.entity.js';
import { OrganizationInvitation } from './organization-invitation.entity.js';
import { OrganizationActivity } from './organization-activity.entity.js';
import { OrganizationModule } from './organization-module.entity.js';

@Entity({ name: 'organizations' })
@Index('uq_organizations_slug', ['slug'], { unique: true })
export class Organization {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_organizations',
  })
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 100 })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'logo_url', type: 'varchar', length: 2048, nullable: true })
  logoUrl!: string | null;

  @Column({
    name: 'contact_email',
    type: 'varchar',
    length: 320,
    nullable: true,
  })
  contactEmail!: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  website!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  country!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  industry!: string | null;

  @Column({ name: 'tax_id', type: 'varchar', length: 80, nullable: true })
  taxId!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'deactivated_at', type: 'timestamptz', nullable: true })
  deactivatedAt!: Date | null;

  @OneToMany(
    () => OrganizationMembership,
    (membership) => membership.organization,
  )
  memberships!: Relation<OrganizationMembership[]>;

  @OneToMany(
    () => OrganizationInvitation,
    (invitation) => invitation.organization,
  )
  invitations!: Relation<OrganizationInvitation[]>;

  @OneToMany(() => OrganizationActivity, (activity) => activity.organization)
  activities!: Relation<OrganizationActivity[]>;

  @OneToMany(() => OrganizationModule, (module) => module.organization)
  modules!: Relation<OrganizationModule[]>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
