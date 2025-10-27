-- AlterTable
ALTER TABLE `captain` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `customer` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `report` ADD COLUMN `approvedAt` DATETIME(3) NULL,
    ADD COLUMN `approvedByUserEmail` VARCHAR(191) NULL,
    ADD COLUMN `approvedByUserFullName` VARCHAR(191) NULL,
    ADD COLUMN `approvedByUserId` INTEGER NULL,
    ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `reportactivity` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `role` ALTER COLUMN `updatedAt` DROP DEFAULT;
