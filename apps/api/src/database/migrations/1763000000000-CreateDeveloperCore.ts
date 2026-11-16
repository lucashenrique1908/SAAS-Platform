import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDeveloperCore1763000000000 implements MigrationInterface {
  name = 'CreateDeveloperCore1763000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "developer_profiles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "public_id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "display_name" varchar(120) NOT NULL,
        "photo_file_id" uuid,
        "title" varchar(160),
        "biography" text,
        "location" varchar(160),
        "availability" varchar(24) NOT NULL DEFAULT 'open_to_offers',
        "github_url" varchar(2048),
        "linkedin_url" varchar(2048),
        "website_url" varchar(2048),
        "is_public" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_developer_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "ck_developer_profiles_availability" CHECK ("availability" IN ('available', 'open_to_offers', 'not_looking')),
        CONSTRAINT "fk_developer_profiles_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_developer_profiles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
      CREATE UNIQUE INDEX "uq_developer_profiles_org_user" ON "developer_profiles" ("organization_id", "user_id");
      CREATE UNIQUE INDEX "uq_developer_profiles_public_id" ON "developer_profiles" ("public_id");
      CREATE INDEX "ix_developer_profiles_org_visibility" ON "developer_profiles" ("organization_id", "is_public", "display_name");
    `);
    await queryRunner.query(`
      CREATE TABLE "developer_skills" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "profile_id" uuid NOT NULL,
        "kind" varchar(24) NOT NULL,
        "name" varchar(120) NOT NULL,
        "category" varchar(80),
        "proficiency" varchar(24),
        "years_experience" numeric(4,1),
        "description" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_developer_skills" PRIMARY KEY ("id"),
        CONSTRAINT "ck_developer_skills_kind" CHECK ("kind" IN ('technical', 'soft', 'language')),
        CONSTRAINT "ck_developer_skills_proficiency" CHECK ("proficiency" IS NULL OR "proficiency" IN ('beginner', 'intermediate', 'advanced', 'expert', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native')),
        CONSTRAINT "ck_developer_skills_years" CHECK ("years_experience" IS NULL OR "years_experience" BETWEEN 0 AND 80),
        CONSTRAINT "fk_developer_skills_profile" FOREIGN KEY ("profile_id") REFERENCES "developer_profiles"("id") ON DELETE CASCADE
      );
      CREATE UNIQUE INDEX "uq_developer_skills_profile_kind_name" ON "developer_skills" ("profile_id", "kind", "name");
      CREATE INDEX "ix_developer_skills_kind_name" ON "developer_skills" ("kind", "name");
    `);
    await queryRunner.query(`
      CREATE TABLE "developer_experiences" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(), "profile_id" uuid NOT NULL,
        "job_title" varchar(160) NOT NULL, "company" varchar(160) NOT NULL,
        "location" varchar(160), "employment_type" varchar(32), "work_modality" varchar(24),
        "start_date" date NOT NULL, "end_date" date, "is_current" boolean NOT NULL DEFAULT false,
        "description" text, "responsibilities" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "achievements" jsonb NOT NULL DEFAULT '[]'::jsonb, "technologies" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "company_url" varchar(2048), "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_developer_experiences" PRIMARY KEY ("id"),
        CONSTRAINT "ck_developer_experiences_dates" CHECK ("end_date" IS NULL OR "end_date" >= "start_date"),
        CONSTRAINT "ck_developer_experiences_current" CHECK (NOT "is_current" OR "end_date" IS NULL),
        CONSTRAINT "fk_developer_experiences_profile" FOREIGN KEY ("profile_id") REFERENCES "developer_profiles"("id") ON DELETE CASCADE
      );
      CREATE INDEX "ix_developer_experiences_profile_dates" ON "developer_experiences" ("profile_id", "start_date", "end_date");
      CREATE TABLE "developer_education" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(), "profile_id" uuid NOT NULL,
        "institution" varchar(180) NOT NULL, "course" varchar(180) NOT NULL, "degree" varchar(120),
        "start_date" date, "end_date" date, "is_in_progress" boolean NOT NULL DEFAULT false,
        "description" text, "institution_url" varchar(2048),
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_developer_education" PRIMARY KEY ("id"),
        CONSTRAINT "ck_developer_education_dates" CHECK ("start_date" IS NULL OR "end_date" IS NULL OR "end_date" >= "start_date"),
        CONSTRAINT "ck_developer_education_progress" CHECK (NOT "is_in_progress" OR "end_date" IS NULL),
        CONSTRAINT "fk_developer_education_profile" FOREIGN KEY ("profile_id") REFERENCES "developer_profiles"("id") ON DELETE CASCADE
      );
      CREATE INDEX "ix_developer_education_profile_dates" ON "developer_education" ("profile_id", "start_date", "end_date");
      CREATE TABLE "developer_certifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(), "profile_id" uuid NOT NULL,
        "name" varchar(180) NOT NULL, "issuing_institution" varchar(180) NOT NULL,
        "issue_date" date, "expiration_date" date, "credential_url" varchar(2048), "certificate_file_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_developer_certifications" PRIMARY KEY ("id"),
        CONSTRAINT "ck_developer_certifications_dates" CHECK ("issue_date" IS NULL OR "expiration_date" IS NULL OR "expiration_date" >= "issue_date"),
        CONSTRAINT "fk_developer_certifications_profile" FOREIGN KEY ("profile_id") REFERENCES "developer_profiles"("id") ON DELETE CASCADE
      );
      CREATE INDEX "ix_developer_certifications_profile_issue" ON "developer_certifications" ("profile_id", "issue_date");
      CREATE TABLE "developer_projects" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(), "profile_id" uuid NOT NULL,
        "name" varchar(180) NOT NULL, "description" text NOT NULL, "problem_solved" text,
        "cover_file_id" uuid, "technologies" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "live_url" varchar(2048), "repository_url" varchar(2048), "start_date" date, "completion_date" date,
        "status" varchar(24) NOT NULL DEFAULT 'in_progress', "member_role" varchar(160),
        "project_type" varchar(16) NOT NULL DEFAULT 'individual', "main_features" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "is_featured" boolean NOT NULL DEFAULT false, "display_order" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_developer_projects" PRIMARY KEY ("id"),
        CONSTRAINT "ck_developer_projects_status" CHECK ("status" IN ('in_progress', 'completed', 'archived')),
        CONSTRAINT "ck_developer_projects_type" CHECK ("project_type" IN ('individual', 'team')),
        CONSTRAINT "ck_developer_projects_dates" CHECK ("start_date" IS NULL OR "completion_date" IS NULL OR "completion_date" >= "start_date"),
        CONSTRAINT "fk_developer_projects_profile" FOREIGN KEY ("profile_id") REFERENCES "developer_profiles"("id") ON DELETE CASCADE
      );
      CREATE INDEX "ix_developer_projects_profile_featured_order" ON "developer_projects" ("profile_id", "is_featured", "display_order");
      CREATE INDEX "ix_developer_projects_profile_status" ON "developer_projects" ("profile_id", "status");
      CREATE UNIQUE INDEX "uq_developer_projects_profile_repository" ON "developer_projects" ("profile_id", "repository_url") WHERE "repository_url" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "developer_projects";
      DROP TABLE "developer_certifications";
      DROP TABLE "developer_education";
      DROP TABLE "developer_experiences";
      DROP TABLE "developer_skills";
      DROP TABLE "developer_profiles";
    `);
  }
}
