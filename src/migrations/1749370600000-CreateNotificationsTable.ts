import { MigrationInterface, QueryRunner } from 'typeorm';

// Creates the notifications table
// Stores auto-generated notifications triggered by appointment events
export class CreateNotificationsTable1749370600000 implements MigrationInterface {
  name = 'CreateNotificationsTable1749370600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the enum type for notification type
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "notification_type_enum" AS ENUM (
          'APPOINTMENT_BOOKED',
          'APPOINTMENT_CANCELLED',
          'APPOINTMENT_RESCHEDULED'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id"          SERIAL NOT NULL,

        -- FK to patient_profiles.id (the patient who receives this notification)
        "patientId"   integer NOT NULL,

        -- What event caused this notification
        "type"        "notification_type_enum" NOT NULL,

        -- Short heading e.g. "Appointment Booked"
        "title"       character varying NOT NULL,

        -- Full notification message body
        "message"     text NOT NULL,

        -- Whether the patient has dismissed/read this notification
        "isRead"      boolean NOT NULL DEFAULT false,

        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "PK_notifications" PRIMARY KEY ("id"),

        CONSTRAINT "FK_notifications_patient"
          FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // Index for fast lookup of a patient's notifications (latest first)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_patientId_createdAt"
      ON "notifications" ("patientId", "createdAt" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_notifications_patientId_createdAt"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "notification_type_enum"`);
  }
}
