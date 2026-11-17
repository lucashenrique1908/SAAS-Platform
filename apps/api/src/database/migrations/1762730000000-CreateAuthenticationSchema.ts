import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthenticationSchema1762730000000 implements MigrationInterface {
  name = 'CreateAuthenticationSchema1762730000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" varchar(320) NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "email_verified_at" timestamptz,
        "platform_role" varchar(32) NOT NULL DEFAULT 'none',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_users" PRIMARY KEY ("id"),
        CONSTRAINT "uq_users_email" UNIQUE ("email"),
        CONSTRAINT "ck_users_platform_role" CHECK ("platform_role" IN ('none', 'platform_admin'))
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "organizations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(120) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_organizations" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "organization_memberships" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "role" varchar(16) NOT NULL DEFAULT 'member',
        "permissions" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_organization_memberships" PRIMARY KEY ("id"),
        CONSTRAINT "uq_organization_memberships_user_org" UNIQUE ("user_id", "organization_id"),
        CONSTRAINT "ck_organization_memberships_role" CHECK ("role" IN ('owner', 'admin', 'member')),
        CONSTRAINT "fk_organization_memberships_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_organization_memberships_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "ix_organization_memberships_org_role"
      ON "organization_memberships" ("organization_id", "role")
    `);
    await queryRunner.query(`
      CREATE TABLE "auth_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "token_hash" char(64) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "last_seen_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_auth_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "uq_auth_sessions_token_hash" UNIQUE ("token_hash"),
        CONSTRAINT "fk_auth_sessions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "ix_auth_sessions_user_expiry"
      ON "auth_sessions" ("user_id", "expires_at")
    `);
    await queryRunner.query(`
      CREATE TABLE "auth_action_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "token_hash" char(64) NOT NULL,
        "purpose" varchar(32) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "consumed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_auth_action_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "uq_auth_action_tokens_hash" UNIQUE ("token_hash"),
        CONSTRAINT "ck_auth_action_tokens_purpose" CHECK ("purpose" IN ('email_verification', 'password_reset')),
        CONSTRAINT "fk_auth_action_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "ix_auth_action_tokens_user_purpose"
      ON "auth_action_tokens" ("user_id", "purpose")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "auth_action_tokens"');
    await queryRunner.query('DROP TABLE "auth_sessions"');
    await queryRunner.query('DROP TABLE "organization_memberships"');
    await queryRunner.query('DROP TABLE "organizations"');
    await queryRunner.query('DROP TABLE "users"');
  }
}
