-- CreateTable
CREATE TABLE `Report` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `equipmentName` VARCHAR(191) NOT NULL,
    `reportDate` DATETIME(3) NOT NULL,
    `reportTime` VARCHAR(191) NOT NULL,
    `location` VARCHAR(191) NOT NULL,
    `waypoint` VARCHAR(191) NOT NULL,
    `satelliteLocation` VARCHAR(191) NOT NULL,
    `approvalSignatureUrl` VARCHAR(191) NOT NULL DEFAULT '/images/default-signature.png',
    `captainId` INTEGER NOT NULL,
    `supervisorId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Report_equipmentName_idx`(`equipmentName`),
    INDEX `Report_reportDate_idx`(`reportDate`),
    INDEX `Report_captainId_idx`(`captainId`),
    INDEX `Report_supervisorId_idx`(`supervisorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Report` ADD CONSTRAINT `Report_captainId_fkey` FOREIGN KEY (`captainId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Report` ADD CONSTRAINT `Report_supervisorId_fkey` FOREIGN KEY (`supervisorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
