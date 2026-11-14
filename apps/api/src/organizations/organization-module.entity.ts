import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Organization } from './organization.entity.js';

export const ORGANIZATION_MODULES = [
  'developer',
  'barber',
  'hairdresser',
  'dentist',
] as const;
export type OrganizationModuleKey = (typeof ORGANIZATION_MODULES)[number];

@Entity({ name: 'organization_modules' })
@Index('uq_organization_modules_org_key', ['organizationId', 'key'], {
  unique: true,
})
export class OrganizationModule {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_organization_modules',
  })
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => Organization, (organization) => organization.modules, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'organization_id',
    foreignKeyConstraintName: 'fk_organization_modules_organization',
  })
  organization!: Relation<Organization>;

  @Column({ type: 'varchar', length: 32 })
  key!: OrganizationModuleKey;

  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  @Column({ name: 'updated_by_user_id', type: 'uuid', nullable: true })
  updatedByUserId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
