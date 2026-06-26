import { MigrationInterface, QueryRunner } from "typeorm";

export class AdvancedScheduling1782364713321 implements MigrationInterface {
    name = 'AdvancedScheduling1782364713321'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."doctor_profiles_schedulingtype_enum" AS ENUM('STREAM', 'WAVE')`);
        await queryRunner.query(`ALTER TABLE "doctor_profiles" ADD "schedulingType" "public"."doctor_profiles_schedulingtype_enum" NOT NULL DEFAULT 'STREAM'`);
        await queryRunner.query(`ALTER TABLE "doctor_profiles" ADD "bufferTime" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "doctor_profiles" ADD "maxPatientsPerWave" integer`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD "tokenNumber" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "tokenNumber"`);
        await queryRunner.query(`ALTER TABLE "doctor_profiles" DROP COLUMN "maxPatientsPerWave"`);
        await queryRunner.query(`ALTER TABLE "doctor_profiles" DROP COLUMN "bufferTime"`);
        await queryRunner.query(`ALTER TABLE "doctor_profiles" DROP COLUMN "schedulingType"`);
        await queryRunner.query(`DROP TYPE "public"."doctor_profiles_schedulingtype_enum"`);
    }

}
