import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DeveloperFiles1763100000000 implements MigrationInterface {
  name = 'DeveloperFiles1763100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "developer_files" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "profile_id" uuid NOT NULL,
        "owner_user_id" uuid NOT NULL,
        "purpose" varchar(24) NOT NULL,
        "storage_key" varchar(300) NOT NULL,
        "original_name" varchar(180) NOT NULL,
        "mime_type" varchar(80) NOT NULL,
        "size_bytes" integer NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_developer_files" PRIMARY KEY ("id"),
        CONSTRAINT "ck_developer_files_purpose" CHECK ("purpose" IN ('profile_photo', 'project_cover', 'certificate')),
        CONSTRAINT "ck_developer_files_size" CHECK ("size_bytes" > 0 AND "size_bytes" <= 10485760),
        CONSTRAINT "fk_developer_files_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_developer_files_profile" FOREIGN KEY ("profile_id") REFERENCES "developer_profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_developer_files_owner" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
      CREATE UNIQUE INDEX "uq_developer_files_storage_key" ON "developer_files" ("storage_key");
      CREATE INDEX "ix_developer_files_profile_purpose" ON "developer_files" ("profile_id", "purpose");
      ALTER TABLE "developer_profiles" ADD CONSTRAINT "fk_developer_profiles_photo_file" FOREIGN KEY ("photo_file_id") REFERENCES "developer_files"("id") ON DELETE SET NULL;
      ALTER TABLE "developer_projects" ADD CONSTRAINT "fk_developer_projects_cover_file" FOREIGN KEY ("cover_file_id") REFERENCES "developer_files"("id") ON DELETE SET NULL;
      ALTER TABLE "developer_certifications" ADD CONSTRAINT "fk_developer_certifications_file" FOREIGN KEY ("certificate_file_id") REFERENCES "developer_files"("id") ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "developer_certifications" DROP CONSTRAINT "fk_developer_certifications_file";
      ALTER TABLE "developer_projects" DROP CONSTRAINT "fk_developer_projects_cover_file";
      ALTER TABLE "developer_profiles" DROP CONSTRAINT "fk_developer_profiles_photo_file";
      DROP TABLE "developer_files";
    `);
  }
}
