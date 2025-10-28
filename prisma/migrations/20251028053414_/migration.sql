-- AlterTable
ALTER TABLE `Captain` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `Customer` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `Report` ADD COLUMN `approvedAt` DATETIME(3) NULL,
    ADD COLUMN `approvedByUserEmail` VARCHAR(191) NULL,
    ADD COLUMN `approvedByUserFullName` VARCHAR(191) NULL,
    ADD COLUMN `approvedByUserId` INTEGER NULL,
    ADD COLUMN `clientSupervisorName` VARCHAR(191) NULL,
    ADD COLUMN `companySupervisorName` VARCHAR(191) NULL,
    ADD COLUMN `createdByUserEmail` VARCHAR(191) NULL,
    ADD COLUMN `createdByUserFullName` VARCHAR(191) NULL,
    ADD COLUMN `createdByUserId` INTEGER NULL,
    ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `ReportActivity` ADD COLUMN `latitude` DOUBLE NULL,
    ADD COLUMN `longitude` DOUBLE NULL,
    ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `Role` MODIFY `description` VARCHAR(191) NULL,
    ALTER COLUMN `updatedAt` DROP DEFAULT;
