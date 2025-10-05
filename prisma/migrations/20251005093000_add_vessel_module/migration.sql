-- CreateTable
CREATE TABLE `Vessel` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `registration` VARCHAR(191) NULL,
    `vesselType` VARCHAR(191) NULL,
    `flag` VARCHAR(191) NULL,
    `owner` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Vessel_registration_key`(`registration`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `Report` ADD COLUMN `vesselId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Report_vesselId_idx` ON `Report`(`vesselId`);

-- AddForeignKey
ALTER TABLE `Report` ADD CONSTRAINT `Report_vesselId_fkey` FOREIGN KEY (`vesselId`) REFERENCES `Vessel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
