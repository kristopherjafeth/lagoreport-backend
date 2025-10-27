-- AlterTable
ALTER TABLE `Captain` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `Customer`ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `Report` ADD COLUMN `createdByUserEmail` VARCHAR(191) NULL,
    ADD COLUMN `createdByUserFullName` VARCHAR(191) NULL,
    ADD COLUMN `createdByUserId` INTEGER NULL,
    ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `ReportActivity` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `Role` ALTER COLUMN `updatedAt` DROP DEFAULT;
