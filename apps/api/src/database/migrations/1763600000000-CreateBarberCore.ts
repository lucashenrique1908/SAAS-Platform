import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBarberCore1763600000000 implements MigrationInterface {
  name = 'CreateBarberCore1763600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "barber_business_profiles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL UNIQUE,
        "business_name" varchar(160) NOT NULL, "description" text, "email" varchar(320),
        "phone" varchar(40), "address" varchar(500), "timezone" varchar(64) NOT NULL DEFAULT 'Europe/Lisbon',
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_barber_business_profiles_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
      );
      CREATE TABLE "barber_professionals" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL,
        "user_id" uuid, "created_by_user_id" uuid, "display_name" varchar(160) NOT NULL,
        "bio" text, "phone" varchar(40), "email" varchar(320), "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_barber_professionals_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_barber_professionals_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_barber_professionals_creator" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "uq_barber_professionals_org_id" UNIQUE ("organization_id", "id")
      );
      CREATE INDEX "ix_barber_professionals_org" ON "barber_professionals" ("organization_id");
      CREATE TABLE "barber_professional_managers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL,
        "professional_id" uuid NOT NULL, "user_id" uuid NOT NULL, "assigned_by_user_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_barber_professional_managers_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_barber_professional_managers_prof" FOREIGN KEY ("organization_id", "professional_id") REFERENCES "barber_professionals"("organization_id", "id") ON DELETE CASCADE,
        CONSTRAINT "fk_barber_professional_managers_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_barber_professional_managers_assigner" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "uq_barber_professional_managers" UNIQUE ("organization_id", "professional_id", "user_id")
      );
      CREATE TABLE "barber_services" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL,
        "created_by_user_id" uuid, "name" varchar(160) NOT NULL, "description" text,
        "price_cents" integer NOT NULL CHECK ("price_cents" >= 0),
        "duration_minutes" integer NOT NULL CHECK ("duration_minutes" BETWEEN 1 AND 1440),
        "is_active" boolean NOT NULL DEFAULT true, "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_barber_services_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_barber_services_creator" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "uq_barber_services_org_id" UNIQUE ("organization_id", "id")
      );
      CREATE INDEX "ix_barber_services_org" ON "barber_services" ("organization_id");
      CREATE TABLE "barber_professional_services" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL,
        "professional_id" uuid NOT NULL, "service_id" uuid NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_barber_professional_services_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_barber_professional_services_prof" FOREIGN KEY ("organization_id", "professional_id") REFERENCES "barber_professionals"("organization_id", "id") ON DELETE CASCADE,
        CONSTRAINT "fk_barber_professional_services_service" FOREIGN KEY ("organization_id", "service_id") REFERENCES "barber_services"("organization_id", "id") ON DELETE CASCADE,
        CONSTRAINT "uq_barber_professional_services" UNIQUE ("organization_id", "professional_id", "service_id")
      );
      CREATE TABLE "barber_clients" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL,
        "created_by_user_id" uuid, "user_id" uuid UNIQUE, "responsible_professional_id" uuid, "full_name" varchar(160) NOT NULL,
        "phone" varchar(40) NOT NULL, "email" varchar(320), "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_barber_clients_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_barber_clients_creator" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_barber_clients_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_barber_clients_prof" FOREIGN KEY ("organization_id", "responsible_professional_id") REFERENCES "barber_professionals"("organization_id", "id") ON DELETE SET NULL ("responsible_professional_id")
      );
      CREATE INDEX "ix_barber_clients_org_responsible" ON "barber_clients" ("organization_id", "responsible_professional_id");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "barber_clients"');
    await queryRunner.query('DROP TABLE "barber_professional_services"');
    await queryRunner.query('DROP TABLE "barber_services"');
    await queryRunner.query('DROP TABLE "barber_professional_managers"');
    await queryRunner.query('DROP TABLE "barber_professionals"');
    await queryRunner.query('DROP TABLE "barber_business_profiles"');
  }
}
