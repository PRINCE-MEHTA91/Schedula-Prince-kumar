import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsReminderSent1782459463290 implements MigrationInterface {
    name = 'AddIsReminderSent1782459463290'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "appointments" ADD "isReminderSent" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "isReminderSent"`);
    }

}
