import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDoctorAvailability1781158772409 implements MigrationInterface {
    name = 'AddDoctorAvailability1781158772409'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Redundant migration - tables already created manually.
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Redundant migration
    }
}
