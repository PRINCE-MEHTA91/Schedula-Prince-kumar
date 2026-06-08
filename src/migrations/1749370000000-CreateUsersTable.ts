import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1749370000000 implements MigrationInterface {
  name = 'CreateUsersTable1749370000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the role enum type if it doesn't exist
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."users_role_enum" AS ENUM('DOCTOR', 'PATIENT');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create users table if it doesn't exist (handles already existing tables from synchronize:true era)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id"          SERIAL NOT NULL,
        "name"        character varying NOT NULL,
        "email"       character varying NOT NULL,
        "password"    character varying NOT NULL,
        "role"        "public"."users_role_enum" NOT NULL DEFAULT 'PATIENT',
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."users_role_enum"`);
  }
}
