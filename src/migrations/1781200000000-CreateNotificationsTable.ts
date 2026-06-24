import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Day 14 — Create notifications table.
 *
 * Creates:
 *  - ENUM type   notification_type_enum
 *  - TABLE        notifications
 */
export class CreateNotificationsTable1781200000000 implements MigrationInterface {
  name = 'CreateNotificationsTable1781200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Notification type enum ────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "notification_type_enum" AS ENUM (
        'APPOINTMENT_BOOKED',
        'APPOINTMENT_CANCELLED',
        'APPOINTMENT_RESCHEDULED',
        'APPOINTMENT_REMINDER',
        'FOLLOW_UP_REMINDER'
      )
    `);

    // ── 2. Notifications table ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id"          SERIAL PRIMARY KEY,
        "patientId"   INTEGER       NOT NULL
                        REFERENCES "patient_profiles"("id") ON DELETE CASCADE,
        "title"       VARCHAR(255)  NOT NULL,
        "message"     TEXT          NOT NULL,
        "type"        "notification_type_enum" NOT NULL,
        "isRead"      BOOLEAN       NOT NULL DEFAULT false,
        "createdAt"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);

    // ── 3. Index for fast per-patient lookups ─────────────────────────────────
    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_patientId"
        ON "notifications" ("patientId")
    `);

    // ── 4. Index to efficiently count unread notifications ───────────────────
    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_patientId_isRead"
        ON "notifications" ("patientId", "isRead")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_patientId_isRead"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_patientId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "notification_type_enum"`);
  }
}
