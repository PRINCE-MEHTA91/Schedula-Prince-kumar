import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDoctorProfilesTable1749370100000
  implements MigrationInterface
{
  name = 'CreateDoctorProfilesTable1749370100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "doctor_profiles" (
        "id"                SERIAL NOT NULL,
        "fullName"          character varying NOT NULL,
        "specialization"    character varying NOT NULL,
        "experience"        integer NOT NULL,
        "qualification"     character varying NOT NULL,
        "consultationFee"   numeric(10,2) NOT NULL,
        "availabilityHours" text NOT NULL,
        "profileDetails"    text,
        "userId"            integer NOT NULL,
        "createdAt"         TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"         TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_doctor_profiles_userId" UNIQUE ("userId"),
        CONSTRAINT "PK_doctor_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "FK_doctor_profiles_userId"
          FOREIGN KEY ("userId") REFERENCES "users"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "doctor_profiles"`);
  }
}
