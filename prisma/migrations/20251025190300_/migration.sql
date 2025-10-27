-- AlterTable
ALTER TABLE `Captain` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `Customer`ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `Report` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `ReportActivity` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `Role` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- CreateTable
CREATE TABLE `Service` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `unit` VARCHAR(191) NOT NULL,
    `unitPriceUsd` DECIMAL(12, 2) NOT NULL,
    `unitPriceLocal` DECIMAL(12, 2) NULL,
    `localCurrency` VARCHAR(191) NULL DEFAULT 'VES',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Service_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Valuation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `customerId` INTEGER NULL,
    `customerName` VARCHAR(191) NULL,
    `customerContact` VARCHAR(191) NULL,
    `customerCode` VARCHAR(191) NULL,
    `customerAddress` VARCHAR(191) NULL,
    `customerEmail` VARCHAR(191) NULL,
    `customerPhone` VARCHAR(191) NULL,
    `issueDate` DATETIME(3) NOT NULL,
    `dueDate` DATETIME(3) NULL,
    `wellCode` VARCHAR(191) NULL,
    `drillCode` VARCHAR(191) NULL,
    `scope` VARCHAR(191) NULL,
    `workOrderNumber` VARCHAR(191) NULL,
    `referenceNumber` VARCHAR(191) NULL,
    `paymentTerms` VARCHAR(191) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `localCurrency` VARCHAR(191) NULL DEFAULT 'VES',
    `exchangeRate` DECIMAL(12, 4) NULL,
    `subtotalUsd` DECIMAL(14, 2) NOT NULL,
    `subtotalLocal` DECIMAL(14, 2) NULL,
    `taxRate` DECIMAL(5, 2) NULL,
    `taxUsd` DECIMAL(14, 2) NULL,
    `taxLocal` DECIMAL(14, 2) NULL,
    `totalUsd` DECIMAL(14, 2) NOT NULL,
    `totalLocal` DECIMAL(14, 2) NULL,
    `notes` VARCHAR(191) NULL,
    `terms` VARCHAR(191) NULL,
    `preparedBy` VARCHAR(191) NULL,
    `approvedBy` VARCHAR(191) NULL,
    `receivedBy` VARCHAR(191) NULL,
    `receivedId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Valuation_code_key`(`code`),
    INDEX `Valuation_issueDate_idx`(`issueDate`),
    INDEX `Valuation_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ValuationItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `valuationId` INTEGER NOT NULL,
    `serviceId` INTEGER NULL,
    `description` VARCHAR(191) NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(12, 2) NOT NULL,
    `unitPriceUsd` DECIMAL(14, 2) NOT NULL,
    `unitPriceLocal` DECIMAL(14, 2) NULL,
    `totalUsd` DECIMAL(14, 2) NOT NULL,
    `totalLocal` DECIMAL(14, 2) NULL,
    `orderIndex` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ValuationItem_valuationId_idx`(`valuationId`),
    INDEX `ValuationItem_serviceId_idx`(`serviceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Valuation` ADD CONSTRAINT `Valuation_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ValuationItem` ADD CONSTRAINT `ValuationItem_valuationId_fkey` FOREIGN KEY (`valuationId`) REFERENCES `Valuation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ValuationItem` ADD CONSTRAINT `ValuationItem_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `Service`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
