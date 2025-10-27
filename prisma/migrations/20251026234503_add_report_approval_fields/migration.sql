-- AlterTable
ALTER TABLE `Captain` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `Customer`ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `Report` ADD COLUMN `approvedAt` DATETIME(3) NULL,
    ADD COLUMN `approvedByUserEmail` VARCHAR(191) NULL,
    ADD COLUMN `approvedByUserFullName` VARCHAR(191) NULL,
    ADD COLUMN `approvedByUserId` INTEGER NULL,
    ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `ReportActivity` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `Role` ALTER COLUMN `updatedAt` DROP DEFAULT;
