import type { MigrationInterface, QueryRunner } from 'typeorm';

export class OrganizationWorkspace1762900000000 implements MigrationInterface {
  name = 'OrganizationWorkspace1762900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organizations"
        ADD COLUMN "slug" varchar(100),
        ADD COLUMN "description" text,
        ADD COLUMN "logo_url" varchar(2048),
        ADD COLUMN "contact_email" varchar(320),
        ADD COLUMN "phone" varchar(40),
        ADD COLUMN "website" varchar(2048),
        ADD COLUMN "country" varchar(120),
        ADD COLUMN "industry" varchar(120),
        ADD COLUMN "tax_id" varchar(80),
        ADD COLUMN "is_active" boolean NOT NULL DEFAULT true,
        ADD COLUMN "deactivated_at" timestamptz
    `);
    await queryRunner.query(`
      DO $$
      DECLARE item record; base_slug text; candidate text; suffix integer;
      BEGIN
        FOR item IN SELECT "id", "name" FROM "organizations" ORDER BY "created_at", "id" LOOP
          base_slug := lower(item."name");
          base_slug := replace(replace(replace(replace(replace(base_slug, 'ß', 'ss'), 'æ', 'ae'), 'œ', 'oe'), 'ø', 'o'), 'ł', 'l');
          base_slug := translate(base_slug,
            'áàãâäåāăąçćčďđéèêëēėęěíìîïīįñńňóòõôöōŕřśšşťţúùûüūůűųýÿžźż',
            'aaaaaaaaacccddeeeeeeeeiiiiiinnnoooooorrsssttuuuuuuuuyyzzz');
          base_slug := trim(both '-' from regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g'));
          IF base_slug = '' THEN base_slug := 'workspace'; END IF;
          base_slug := left(base_slug, 100);
          candidate := base_slug;
          suffix := 2;
          WHILE EXISTS (SELECT 1 FROM "organizations" WHERE "slug" = candidate) LOOP
            candidate := left(base_slug, 100 - length(suffix::text) - 1) || '-' || suffix::text;
            suffix := suffix + 1;
          END LOOP;
          UPDATE "organizations" SET "slug" = candidate WHERE "id" = item."id";
        END LOOP;
      END $$
    `);
    await queryRunner.query(`
      ALTER TABLE "organizations" ALTER COLUMN "slug" SET NOT NULL;
      CREATE UNIQUE INDEX "uq_organizations_slug" ON "organizations" ("slug");
    `);
    await queryRunner.query(`
      CREATE TABLE "organization_invitations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "email" varchar(320) NOT NULL,
        "token_hash" char(64) NOT NULL,
        "role" varchar(16) NOT NULL DEFAULT 'member',
        "permissions" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "invited_by_user_id" uuid,
        "accepted_by_user_id" uuid,
        "expires_at" timestamptz NOT NULL,
        "accepted_at" timestamptz,
        "revoked_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_organization_invitations" PRIMARY KEY ("id"),
        CONSTRAINT "ck_organization_invitations_role" CHECK ("role" IN ('owner', 'admin', 'member')),
        CONSTRAINT "fk_organization_invitations_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_organization_invitations_inviter" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_organization_invitations_acceptor" FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL
      );
      CREATE UNIQUE INDEX "uq_organization_invitations_token_hash" ON "organization_invitations" ("token_hash");
      CREATE INDEX "ix_organization_invitations_org_email" ON "organization_invitations" ("organization_id", "email");
    `);
    await queryRunner.query(`
      CREATE TABLE "organization_activity" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "actor_user_id" uuid,
        "type" varchar(64) NOT NULL,
        "details" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_organization_activity" PRIMARY KEY ("id"),
        CONSTRAINT "fk_organization_activity_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_organization_activity_actor" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL
      );
      CREATE INDEX "ix_organization_activity_org_created" ON "organization_activity" ("organization_id", "created_at" DESC);
    `);
    await queryRunner.query(`
      CREATE TABLE "organization_modules" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "key" varchar(32) NOT NULL,
        "enabled" boolean NOT NULL DEFAULT false,
        "updated_by_user_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_organization_modules" PRIMARY KEY ("id"),
        CONSTRAINT "ck_organization_modules_key" CHECK ("key" IN ('developer', 'barber', 'hairdresser', 'dentist')),
        CONSTRAINT "fk_organization_modules_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_organization_modules_updated_by" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL
      );
      CREATE UNIQUE INDEX "uq_organization_modules_org_key" ON "organization_modules" ("organization_id", "key");
      INSERT INTO "organization_modules" ("organization_id", "key", "enabled")
        SELECT "id", 'developer', true FROM "organizations";
      INSERT INTO "organization_modules" ("organization_id", "key", "enabled")
        SELECT org."id", module."key", false
        FROM "organizations" org
        CROSS JOIN (VALUES ('barber'), ('hairdresser'), ('dentist')) AS module("key");
    `);
    await queryRunner.query(`
      ALTER TABLE "auth_sessions" ADD COLUMN "active_organization_id" uuid;
      ALTER TABLE "auth_sessions"
        ADD CONSTRAINT "fk_auth_sessions_active_organization"
        FOREIGN KEY ("active_organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL;
      CREATE INDEX "ix_auth_sessions_active_organization" ON "auth_sessions" ("active_organization_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "ix_auth_sessions_active_organization"',
    );
    await queryRunner.query(
      'ALTER TABLE "auth_sessions" DROP CONSTRAINT "fk_auth_sessions_active_organization"',
    );
    await queryRunner.query(
      'ALTER TABLE "auth_sessions" DROP COLUMN "active_organization_id"',
    );
    await queryRunner.query('DROP TABLE "organization_modules"');
    await queryRunner.query('DROP TABLE "organization_activity"');
    await queryRunner.query('DROP TABLE "organization_invitations"');
    await queryRunner.query('DROP INDEX "uq_organizations_slug"');
    await queryRunner.query(`
      ALTER TABLE "organizations"
        DROP COLUMN "slug", DROP COLUMN "description", DROP COLUMN "logo_url",
        DROP COLUMN "contact_email", DROP COLUMN "phone", DROP COLUMN "website",
        DROP COLUMN "country", DROP COLUMN "industry", DROP COLUMN "tax_id",
        DROP COLUMN "is_active", DROP COLUMN "deactivated_at"
    `);
  }
}
