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
import { Organization } from './organization.entity.js';
import { User } from '../users/user.entity.js';

@Entity({ name: 'organization_activity' })
@Index('ix_organization_activity_org_created', ['organizationId', 'createdAt'])
export class OrganizationActivity {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_organization_activity',
  })
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => Organization, (organization) => organization.activities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'organization_id',
    foreignKeyConstraintName: 'fk_organization_activity_organization',
  })
  organization!: Relation<Organization>;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'actor_user_id',
    foreignKeyConstraintName: 'fk_organization_activity_actor',
  })
  actor!: Relation<User | null>;

  @Column({ type: 'varchar', length: 64 })
  type!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  details!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
