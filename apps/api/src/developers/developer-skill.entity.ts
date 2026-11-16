import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type DeveloperSkillKind = 'technical' | 'soft' | 'language';

@Entity({ name: 'developer_skills' })
@Index('uq_developer_skills_profile_kind_name', ['profileId', 'kind', 'name'], {
  unique: true,
})
@Index('ix_developer_skills_kind_name', ['kind', 'name'])
export class DeveloperSkill {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_developer_skills',
  })
  id!: string;

  @Column({ name: 'profile_id', type: 'uuid' })
  profileId!: string;

  @Column({ type: 'varchar', length: 24 })
  kind!: DeveloperSkillKind;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  category!: string | null;

  @Column({ type: 'varchar', length: 24, nullable: true })
  proficiency!: string | null;

  @Column({
    name: 'years_experience',
    type: 'numeric',
    precision: 4,
    scale: 1,
    nullable: true,
  })
  yearsExperience!: number | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
