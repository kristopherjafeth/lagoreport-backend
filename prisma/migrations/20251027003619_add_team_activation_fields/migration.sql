-- AlterTable
ALTER TABLE `Team` ADD COLUMN `deactivatedAt` DATETIME(3) NULL,
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;
