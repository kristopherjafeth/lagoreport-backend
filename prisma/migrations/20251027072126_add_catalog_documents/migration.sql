-- CreateTable
CREATE TABLE `CaptainDocument` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `captainId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `fileType` VARCHAR(191) NULL,
    `fileKey` VARCHAR(191) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CaptainDocument_captainId_idx`(`captainId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VesselDocument` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vesselId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `fileType` VARCHAR(191) NULL,
    `fileKey` VARCHAR(191) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VesselDocument_vesselId_idx`(`vesselId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CaptainDocument` ADD CONSTRAINT `CaptainDocument_captainId_fkey` FOREIGN KEY (`captainId`) REFERENCES `Captain`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VesselDocument` ADD CONSTRAINT `VesselDocument_vesselId_fkey` FOREIGN KEY (`vesselId`) REFERENCES `Vessel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
