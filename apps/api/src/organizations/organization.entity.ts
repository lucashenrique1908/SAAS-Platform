import {
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { OrganizationMembership } from './organization-membership.entity.js';

@Entity({ name: 'organizations' })
export class Organization {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_organizations',
  })
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @OneToMany(
    () => OrganizationMembership,
    (membership) => membership.organization,
  )
  memberships!: Relation<OrganizationMembership[]>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
