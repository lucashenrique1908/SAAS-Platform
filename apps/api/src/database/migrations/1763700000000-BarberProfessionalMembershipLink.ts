import type { MigrationInterface, QueryRunner } from 'typeorm';

export class BarberProfessionalMembershipLink1763700000000 implements MigrationInterface {
  name = 'BarberProfessionalMembershipLink1763700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "barber_professionals"
        ADD CONSTRAINT "fk_barber_professionals_membership"
          FOREIGN KEY ("user_id", "organization_id")
          REFERENCES "organization_memberships"("user_id", "organization_id")
          ON DELETE SET NULL ("user_id");
      CREATE UNIQUE INDEX "uq_barber_professionals_org_user"
        ON "barber_professionals" ("organization_id", "user_id")
        WHERE "user_id" IS NOT NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "uq_barber_professionals_org_user"');
    await queryRunner.query(
      'ALTER TABLE "barber_professionals" DROP CONSTRAINT "fk_barber_professionals_membership"',
    );
  }
}
