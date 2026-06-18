import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the three scheduling tables:
 *   - stream_slots      (fixed time-slot scheduling)
 *   - wave_schedules    (batch/capacity-based scheduling)
 *   - appointments      (unified appointment record for both types)
 */
export class CreateSchedulingTables1749370400000 implements MigrationInterface {
  name = 'CreateSchedulingTables1749370400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── stream_slots ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "stream_slots" (
        "id"          SERIAL PRIMARY KEY,
        "doctorId"    INTEGER NOT NULL,
        "date"        DATE NOT NULL,
        "startTime"   TIME NOT NULL,
        "endTime"     TIME NOT NULL,
        "isAvailable" BOOLEAN NOT NULL DEFAULT TRUE,
        "isBooked"    BOOLEAN NOT NULL DEFAULT FALSE,
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_stream_slots_doctor"
          FOREIGN KEY ("doctorId")
          REFERENCES "doctor_profiles"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_stream_slots_doctor_date"
       ON "stream_slots" ("doctorId", "date")`,
    );

    // ── wave_schedules ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "wave_schedules" (
        "id"          SERIAL PRIMARY KEY,
        "doctorId"    INTEGER NOT NULL,
        "date"        DATE NOT NULL,
        "startTime"   TIME NOT NULL,
        "endTime"     TIME NOT NULL,
        "capacity"    INTEGER NOT NULL,
        "bookedCount" INTEGER NOT NULL DEFAULT 0,
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_wave_schedules_doctor"
          FOREIGN KEY ("doctorId")
          REFERENCES "doctor_profiles"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_wave_schedules_doctor_date"
       ON "wave_schedules" ("doctorId", "date")`,
    );

    // ── scheduling type enum ─────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TYPE "appointments_schedulingtype_enum" AS ENUM ('STREAM', 'WAVE')`,
    );

    // ── appointment status enum ──────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TYPE "appointments_status_enum"
       AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'RESCHEDULED')`,
    );

    // ── appointments ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "appointments" (
        "id"               SERIAL PRIMARY KEY,
        "patientId"        INTEGER NOT NULL,
        "doctorId"         INTEGER NOT NULL,
        "schedulingType"   "appointments_schedulingtype_enum" NOT NULL,
        "streamSlotId"     INTEGER,
        "waveScheduleId"   INTEGER,
        "waveToken"        INTEGER,
        "appointmentDate"  DATE NOT NULL,
        "startTime"        TIME NOT NULL,
        "endTime"          TIME NOT NULL,
        "status"           "appointments_status_enum" NOT NULL DEFAULT 'CONFIRMED',
        "notes"            TEXT,
        "createdAt"        TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"        TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_appointments_patient"
          FOREIGN KEY ("patientId")
          REFERENCES "patient_profiles"("id")
          ON DELETE CASCADE,
        CONSTRAINT "fk_appointments_doctor"
          FOREIGN KEY ("doctorId")
          REFERENCES "doctor_profiles"("id")
          ON DELETE CASCADE,
        CONSTRAINT "fk_appointments_stream_slot"
          FOREIGN KEY ("streamSlotId")
          REFERENCES "stream_slots"("id")
          ON DELETE SET NULL,
        CONSTRAINT "fk_appointments_wave_schedule"
          FOREIGN KEY ("waveScheduleId")
          REFERENCES "wave_schedules"("id")
          ON DELETE SET NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_appointments_patient"
       ON "appointments" ("patientId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_appointments_doctor"
       ON "appointments" ("doctorId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_appointments_date"
       ON "appointments" ("appointmentDate")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "appointments"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "appointments_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "appointments_schedulingtype_enum"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "wave_schedules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stream_slots"`);
  }
}
