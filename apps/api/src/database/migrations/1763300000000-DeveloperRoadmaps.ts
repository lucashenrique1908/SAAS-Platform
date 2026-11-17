import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DeveloperRoadmaps1763300000000 implements MigrationInterface {
  name = 'DeveloperRoadmaps1763300000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "developer_roadmaps" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "profile_id" uuid NOT NULL,
      "goal" varchar(160) NOT NULL,
      "items" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "pk_developer_roadmaps" PRIMARY KEY ("id"),
      CONSTRAINT "fk_developer_roadmaps_profile" FOREIGN KEY ("profile_id") REFERENCES "developer_profiles"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(
      `CREATE INDEX "ix_developer_roadmaps_profile_updated" ON "developer_roadmaps" ("profile_id", "updated_at")`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "ix_developer_roadmaps_profile_updated"',
    );
    await queryRunner.query('DROP TABLE "developer_roadmaps"');
  }
}
