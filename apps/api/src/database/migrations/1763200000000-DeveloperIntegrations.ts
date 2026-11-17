import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DeveloperIntegrations1763200000000 implements MigrationInterface {
  name = 'DeveloperIntegrations1763200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "developer_integrations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL, "provider" varchar(32) NOT NULL,
        "provider_account_id" varchar(180) NOT NULL, "provider_display_name" varchar(180),
        "access_token_encrypted" text NOT NULL, "refresh_token_encrypted" text,
        "access_expires_at" timestamptz, "scopes" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_developer_integrations" PRIMARY KEY ("id"),
        CONSTRAINT "ck_developer_integrations_provider" CHECK ("provider" IN ('github', 'google_calendar', 'linkedin')),
        CONSTRAINT "fk_developer_integrations_membership" FOREIGN KEY ("user_id", "organization_id") REFERENCES "organization_memberships"("user_id", "organization_id") ON DELETE CASCADE
      );
      CREATE UNIQUE INDEX "uq_developer_integrations_user_org_provider" ON "developer_integrations" ("user_id", "organization_id", "provider");
      CREATE TABLE "developer_oauth_states" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(), "state_hash" char(64) NOT NULL,
        "provider" varchar(32) NOT NULL, "user_id" uuid NOT NULL, "organization_id" uuid NOT NULL,
        "expires_at" timestamptz NOT NULL, "consumed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_developer_oauth_states" PRIMARY KEY ("id"),
        CONSTRAINT "ck_developer_oauth_states_provider" CHECK ("provider" IN ('github', 'google_calendar', 'linkedin')),
        CONSTRAINT "fk_developer_oauth_states_membership" FOREIGN KEY ("user_id", "organization_id") REFERENCES "organization_memberships"("user_id", "organization_id") ON DELETE CASCADE
      );
      CREATE UNIQUE INDEX "uq_developer_oauth_states_hash" ON "developer_oauth_states" ("state_hash");
      CREATE INDEX "ix_developer_oauth_states_expiry" ON "developer_oauth_states" ("expires_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TABLE "developer_oauth_states"; DROP TABLE "developer_integrations";',
    );
  }
}
