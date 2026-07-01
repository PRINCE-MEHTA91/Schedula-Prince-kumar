import { MigrationInterface, QueryRunner } from "typeorm";

export class Day20Updates1782905005236 implements MigrationInterface {
    name = 'Day20Updates1782905005236'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "doctor_profiles" ADD "allowFutureBooking" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "doctor_profiles" ADD "maxFutureBookingDays" integer`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD "schedulingType" character varying`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD "notes" character varying`);
        await queryRunner.query(`ALTER TYPE "public"."appointments_status_enum" ADD VALUE 'BOOKED'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."appointments_status_enum_old" AS ENUM('CONFIRMED', 'CANCELLED', 'PENDING', 'RESCHEDULED')`);
        await queryRunner.query(`ALTER TABLE "appointments" ALTER COLUMN "status" TYPE "public"."appointments_status_enum_old" USING "status"::"text"::"public"."appointments_status_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."appointments_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."appointments_status_enum_old" RENAME TO "appointments_status_enum"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "notes"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "schedulingType"`);
        await queryRunner.query(`ALTER TABLE "doctor_profiles" DROP COLUMN "maxFutureBookingDays"`);
        await queryRunner.query(`ALTER TABLE "doctor_profiles" DROP COLUMN "allowFutureBooking"`);
    }

}
