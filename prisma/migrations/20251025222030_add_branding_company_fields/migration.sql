-- AlterTable
ALTER TABLE `brandingsetting` ADD COLUMN `address` VARCHAR(191) NULL,
    ADD COLUMN `legalName` VARCHAR(191) NULL,
    ADD COLUMN `phone` VARCHAR(191) NULL,
    ADD COLUMN `taxId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `captain` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `customer` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `report` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `reportactivity` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `role` ALTER COLUMN `updatedAt` DROP DEFAULT;
