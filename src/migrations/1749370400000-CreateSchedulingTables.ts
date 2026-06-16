import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSchedulingTables1749370400000 implements MigrationInterface {
  name = 'CreateSchedulingTables1749370400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. scheduling_type enum ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "public"."scheduling_type_enum" AS ENUM ('STREAM', 'WAVE')
    `);

    // ── 2. doctor_schedules ──────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "doctor_schedules" (
        "id"              SERIAL PRIMARY KEY,
        "doctorId"        INTEGER NOT NULL,
        "schedulingType"  "public"."scheduling_type_enum" NOT NULL,
        "date"            DATE NOT NULL,
        "startTime"       VARCHAR(5) NOT NULL,
        "endTime"         VARCHAR(5) NOT NULL,
        "slotDuration"    INTEGER,
        "bufferTime"      INTEGER,
        "maxCapacity"     INTEGER,
        "createdAt"       TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"       TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_doctor_schedule_doctor"
          FOREIGN KEY ("doctorId")
          REFERENCES "doctor_profiles"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_doctor_schedules_doctorId_date"
        ON "doctor_schedules" ("doctorId", "date")
    `);

    // ── 3. appointment_slots (STREAM only) ───────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "appointment_slots" (
        "id"          SERIAL PRIMARY KEY,
        "scheduleId"  INTEGER NOT NULL,
        "startTime"   VARCHAR(5) NOT NULL,
        "endTime"     VARCHAR(5) NOT NULL,
        "isBooked"    BOOLEAN NOT NULL DEFAULT false,
        "patientId"   INTEGER,
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_slot_schedule"
          FOREIGN KEY ("scheduleId")
          REFERENCES "doctor_schedules"("id")
          ON DELETE CASCADE,
        CONSTRAINT "fk_slot_patient"
          FOREIGN KEY ("patientId")
          REFERENCES "patient_profiles"("id")
          ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_appointment_slots_scheduleId"
        ON "appointment_slots" ("scheduleId")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_appointment_slots_patientId"
        ON "appointment_slots" ("patientId")
    `);

    // ── 4. wave_bookings (WAVE only) ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "wave_bookings" (
        "id"           SERIAL PRIMARY KEY,
        "scheduleId"   INTEGER NOT NULL,
        "patientId"    INTEGER NOT NULL,
        "tokenNumber"  INTEGER NOT NULL,
        "bookedAt"     TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_wave_booking_schedule"
          FOREIGN KEY ("scheduleId")
          REFERENCES "doctor_schedules"("id")
          ON DELETE CASCADE,
        CONSTRAINT "fk_wave_booking_patient"
          FOREIGN KEY ("patientId")
          REFERENCES "patient_profiles"("id")
          ON DELETE CASCADE,
        CONSTRAINT "uq_wave_booking_schedule_patient"
          UNIQUE ("scheduleId", "patientId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_wave_bookings_scheduleId"
        ON "wave_bookings" ("scheduleId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "wave_bookings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "appointment_slots"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "doctor_schedules"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."scheduling_type_enum"`,
    );
  }
}
