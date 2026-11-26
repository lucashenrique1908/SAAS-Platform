import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBarberScheduling1763800000000 implements MigrationInterface {
  name = 'CreateBarberScheduling1763800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "barber_clients" ADD CONSTRAINT "uq_barber_clients_org_id" UNIQUE ("organization_id", "id");
      CREATE TABLE "barber_working_hours" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "professional_id" uuid NULL,
        "weekday" smallint NOT NULL CHECK ("weekday" BETWEEN 0 AND 6),
        "start_time" time NOT NULL,
        "end_time" time NOT NULL,
        CONSTRAINT "ck_barber_working_hours_order" CHECK ("start_time" < "end_time"),
        CONSTRAINT "fk_barber_working_hours_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_barber_working_hours_prof" FOREIGN KEY ("organization_id", "professional_id") REFERENCES "barber_professionals"("organization_id", "id") ON DELETE CASCADE
      );
      CREATE INDEX "ix_barber_working_hours_org_prof_day" ON "barber_working_hours" ("organization_id", "professional_id", "weekday");
      CREATE TABLE "barber_availability_exceptions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "professional_id" uuid NULL,
        "type" varchar(24) NOT NULL CHECK ("type" IN ('DAY_OFF','VACATION','ABSENCE','APPOINTMENT','BLOCK')),
        "reason" text NULL,
        "starts_at" timestamptz NOT NULL,
        "ends_at" timestamptz NOT NULL,
        "created_by_user_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_barber_availability_exceptions_order" CHECK ("starts_at" < "ends_at"),
        CONSTRAINT "fk_barber_availability_exceptions_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_barber_availability_exceptions_prof" FOREIGN KEY ("organization_id", "professional_id") REFERENCES "barber_professionals"("organization_id", "id") ON DELETE CASCADE,
        CONSTRAINT "fk_barber_availability_exceptions_creator" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
      );
      CREATE INDEX "ix_barber_availability_exceptions_org_period" ON "barber_availability_exceptions" ("organization_id", "starts_at", "ends_at");
      CREATE TABLE "barber_appointments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "created_by_user_id" uuid NOT NULL,
        "professional_id" uuid NOT NULL,
        "client_id" uuid NOT NULL,
        "service_id" uuid NOT NULL,
        "starts_at" timestamptz NOT NULL,
        "ends_at" timestamptz NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','CONFIRMED','COMPLETED','CANCELLED')),
        "notes" text NULL,
        "service_name_snapshot" varchar(160) NOT NULL,
        "price_cents_snapshot" integer NOT NULL CHECK ("price_cents_snapshot" >= 0),
        "duration_minutes_snapshot" integer NOT NULL CHECK ("duration_minutes_snapshot" BETWEEN 1 AND 1440),
        "professional_name_snapshot" varchar(160) NOT NULL,
        "client_name_snapshot" varchar(160) NOT NULL,
        "client_phone_snapshot" varchar(40) NOT NULL,
        "client_email_snapshot" varchar(320) NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_barber_appointments_order" CHECK ("starts_at" < "ends_at"),
        CONSTRAINT "fk_barber_appointments_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_barber_appointments_creator" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_barber_appointments_prof" FOREIGN KEY ("organization_id", "professional_id") REFERENCES "barber_professionals"("organization_id", "id") ON DELETE CASCADE,
        CONSTRAINT "fk_barber_appointments_client" FOREIGN KEY ("organization_id", "client_id") REFERENCES "barber_clients"("organization_id", "id") ON DELETE CASCADE,
        CONSTRAINT "fk_barber_appointments_service" FOREIGN KEY ("organization_id", "service_id") REFERENCES "barber_services"("organization_id", "id") ON DELETE CASCADE
      );
      CREATE INDEX "ix_barber_appointments_org_prof_start" ON "barber_appointments" ("organization_id", "professional_id", "starts_at");
      CREATE INDEX "ix_barber_appointments_org_client_start" ON "barber_appointments" ("organization_id", "client_id", "starts_at");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "barber_appointments";
      DROP TABLE "barber_availability_exceptions";
      DROP TABLE "barber_working_hours";
      ALTER TABLE "barber_clients" DROP CONSTRAINT "uq_barber_clients_org_id";
    `);
  }
}
