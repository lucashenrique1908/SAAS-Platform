import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'developer_roadmaps' })
@Index('ix_developer_roadmaps_profile_updated', ['profileId', 'updatedAt'])
export class DeveloperRoadmap {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'profile_id', type: 'uuid' }) profileId!: string;
  @Column({ type: 'varchar', length: 160 }) goal!: string;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) items!: Array<{
    id: string;
    title: string;
    description: string;
    completed: boolean;
    resourceUrl?: string;
  }>;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
