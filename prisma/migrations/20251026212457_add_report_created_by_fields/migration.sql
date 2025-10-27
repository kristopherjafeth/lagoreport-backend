-- AlterTable
ALTER TABLE `captain` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `customer` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `report` ADD COLUMN `createdByUserEmail` VARCHAR(191) NULL,
    ADD COLUMN `createdByUserFullName` VARCHAR(191) NULL,
    ADD COLUMN `createdByUserId` INTEGER NULL,
    ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `reportactivity` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `role` ALTER COLUMN `updatedAt` DROP DEFAULT;
