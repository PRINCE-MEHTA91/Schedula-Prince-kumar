import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: AddSlotGeneration
 * Creates:
 *   - recurring_availability table
 *   - custom_availability table
 *   - appointments table
 * Adds:
 *   - slotDuration column to doctor_profiles
 */
export class AddSlotGeneration1749370400000 implements MigrationInterface {
  name = 'AddSlotGeneration1749370400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add slotDuration to doctor_profiles (default 15 minutes)
    await queryRunner.query(`
      ALTER TABLE "doctor_profiles"
      ADD COLUMN IF NOT EXISTS "slotDuration" integer NOT NULL DEFAULT 15
    `);

    // Create recurring_availability table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "recurring_availability" (
        "id"          SERIAL PRIMARY KEY,
        "doctorId"    integer NOT NULL REFERENCES "doctor_profiles"("id") ON DELETE CASCADE,
        "dayOfWeek"   integer NOT NULL,
        "startTime"   time NOT NULL,
        "endTime"     time NOT NULL,
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // Create custom_availability table (date-level overrides)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "custom_availability" (
        "id"          SERIAL PRIMARY KEY,
        "doctorId"    integer NOT NULL REFERENCES "doctor_profiles"("id") ON DELETE CASCADE,
        "date"        date NOT NULL,
        "startTime"   time,
        "endTime"     time,
        "isAvailable" boolean NOT NULL DEFAULT true,
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // Create appointments table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "appointments" (
        "id"        SERIAL PRIMARY KEY,
        "doctorId"  integer NOT NULL REFERENCES "doctor_profiles"("id"),
        "patientId" integer NOT NULL,
        "date"      date NOT NULL,
        "startTime" time NOT NULL,
        "endTime"   time NOT NULL,
        "status"    varchar NOT NULL DEFAULT 'BOOKED',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "appointments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "custom_availability"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "recurring_availability"`);
    await queryRunner.query(`
      ALTER TABLE "doctor_profiles"
      DROP COLUMN IF EXISTS "slotDuration"
    `);
  }
}
