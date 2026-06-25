import { MigrationInterface, QueryRunner } from 'typeorm';

// isAvailable column add karta hai — default true (existing doctors available rahenge)
export class AddIsAvailableToDoctorProfiles1749370300000 implements MigrationInterface {
  name = 'AddIsAvailableToDoctorProfiles1749370300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctor_profiles"
      ADD COLUMN IF NOT EXISTS "isAvailable" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctor_profiles"
      DROP COLUMN IF EXISTS "isAvailable"
    `);
  }
}
