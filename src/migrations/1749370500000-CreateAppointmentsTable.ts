import { MigrationInterface, QueryRunner } from 'typeorm';

// Creates the appointments table
// Unique constraint on (doctorId, date, startTime) prevents double booking
export class CreateAppointmentsTable1749370500000 implements MigrationInterface {
  name = 'CreateAppointmentsTable1749370500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // First create the enum type for appointment status
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "appointment_status_enum" AS ENUM ('BOOKED', 'CANCELLED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "appointments" (
        "id"          SERIAL NOT NULL,
        "doctorId"    integer NOT NULL,
        "patientId"   integer NOT NULL,
        "date"        character varying NOT NULL,
        "startTime"   character varying NOT NULL,
        "endTime"     character varying NOT NULL,
        "status"      "appointment_status_enum" NOT NULL DEFAULT 'BOOKED',
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "PK_appointments" PRIMARY KEY ("id"),

        -- Prevent same doctor from being booked twice for same date+time
        CONSTRAINT "UQ_appointments_doctor_date_time"
          UNIQUE ("doctorId", "date", "startTime"),

        CONSTRAINT "FK_appointments_doctor"
          FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,

        CONSTRAINT "FK_appointments_patient"
          FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "appointments"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "appointment_status_enum"`);
  }
}
