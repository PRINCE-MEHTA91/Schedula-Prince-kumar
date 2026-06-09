import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePatientProfilesTable1749370200000
  implements MigrationInterface
{
  name = 'CreatePatientProfilesTable1749370200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create gender enum type
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."patient_profiles_gender_enum" AS ENUM('MALE', 'FEMALE', 'OTHER');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "patient_profiles" (
        "id"              SERIAL NOT NULL,
        "fullName"        character varying NOT NULL,
        "age"             integer NOT NULL,
        "gender"          "public"."patient_profiles_gender_enum" NOT NULL,
        "contactDetails"  text NOT NULL,
        "basicHealthInfo" text,
        "userId"          integer NOT NULL,
        "createdAt"       TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"       TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_patient_profiles_userId" UNIQUE ("userId"),
        CONSTRAINT "PK_patient_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "FK_patient_profiles_userId"
          FOREIGN KEY ("userId") REFERENCES "users"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "patient_profiles"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."patient_profiles_gender_enum"`,
    );
  }
}
