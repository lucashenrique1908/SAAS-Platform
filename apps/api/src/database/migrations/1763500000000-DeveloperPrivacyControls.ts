import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DeveloperPrivacyControls1763500000000 implements MigrationInterface {
  name = 'DeveloperPrivacyControls1763500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "developer_profiles"
        ALTER COLUMN "is_public" SET DEFAULT false,
        ADD COLUMN "public_fields" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "developer_projects"
        ADD COLUMN "is_public" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "developer_projects" DROP COLUMN "is_public"',
    );
    await queryRunner.query(`
      ALTER TABLE "developer_profiles"
        DROP COLUMN "public_fields",
        ALTER COLUMN "is_public" SET DEFAULT true
    `);
  }
}
