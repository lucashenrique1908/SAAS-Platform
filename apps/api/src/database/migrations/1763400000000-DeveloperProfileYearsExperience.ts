import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DeveloperProfileYearsExperience1763400000000 implements MigrationInterface {
  name = 'DeveloperProfileYearsExperience1763400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "developer_profiles"
      ADD COLUMN "years_experience" integer,
      ADD CONSTRAINT "ck_developer_profiles_years_experience"
        CHECK ("years_experience" IS NULL OR "years_experience" BETWEEN 0 AND 80)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "developer_profiles"
      DROP CONSTRAINT "ck_developer_profiles_years_experience",
      DROP COLUMN "years_experience"
    `);
  }
}
