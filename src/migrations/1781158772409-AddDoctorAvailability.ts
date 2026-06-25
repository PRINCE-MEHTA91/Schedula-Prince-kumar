import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDoctorAvailability1781158772409 implements MigrationInterface {
  name = 'AddDoctorAvailability1781158772409';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "doctor_profiles" DROP CONSTRAINT "FK_doctor_profiles_userId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_profiles" DROP CONSTRAINT "FK_patient_profiles_userId"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."recurring_availability_dayofweek_enum" AS ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')`,
    );
    await queryRunner.query(
      `CREATE TABLE "recurring_availability" ("id" SERIAL NOT NULL, "doctorProfileId" integer NOT NULL, "dayOfWeek" "public"."recurring_availability_dayofweek_enum" NOT NULL, "startTime" TIME NOT NULL, "endTime" TIME NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2464dd095ba418858c1aa3f4e01" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "custom_availability" ("id" SERIAL NOT NULL, "doctorProfileId" integer NOT NULL, "date" date NOT NULL, "startTime" TIME, "endTime" TIME, "isAvailable" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e9b8fa5803ca3d6554a7ddf7045" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "recurring_availability" ADD CONSTRAINT "FK_988d39de6521504d5dc9ac0b9f5" FOREIGN KEY ("doctorProfileId") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "custom_availability" ADD CONSTRAINT "FK_4b01248ade4901e776f8ed260f8" FOREIGN KEY ("doctorProfileId") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctor_profiles" ADD CONSTRAINT "FK_a798afca9436b00dac80f911a83" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_profiles" ADD CONSTRAINT "FK_fc4788002ae2de0a68f6ccf24e5" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient_profiles" DROP CONSTRAINT "FK_fc4788002ae2de0a68f6ccf24e5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctor_profiles" DROP CONSTRAINT "FK_a798afca9436b00dac80f911a83"`,
    );
    await queryRunner.query(
      `ALTER TABLE "custom_availability" DROP CONSTRAINT "FK_4b01248ade4901e776f8ed260f8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "recurring_availability" DROP CONSTRAINT "FK_988d39de6521504d5dc9ac0b9f5"`,
    );
    await queryRunner.query(`DROP TABLE "custom_availability"`);
    await queryRunner.query(`DROP TABLE "recurring_availability"`);
    await queryRunner.query(
      `DROP TYPE "public"."recurring_availability_dayofweek_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_profiles" ADD CONSTRAINT "FK_patient_profiles_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctor_profiles" ADD CONSTRAINT "FK_doctor_profiles_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
}
}
