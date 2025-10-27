-- AlterTable
ALTER TABLE `Report` ADD COLUMN `teamId` INTEGER NULL;

-- CreateTable
CREATE TABLE `Mariner` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `cedula` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Mariner_cedula_key`(`cedula`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Team` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `defaultCompanySupervisorName` VARCHAR(191) NULL,
    `defaultClientSupervisorName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TeamCaptain` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `teamId` INTEGER NOT NULL,
    `captainId` INTEGER NOT NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TeamCaptain_captainId_idx`(`captainId`),
    UNIQUE INDEX `TeamCaptain_teamId_captainId_key`(`teamId`, `captainId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TeamMariner` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `teamId` INTEGER NOT NULL,
    `marinerId` INTEGER NOT NULL,
    `role` ENUM('PATRON', 'MOTORISTA', 'COCINERO', 'MARINERO') NOT NULL,
    `orderIndex` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TeamMariner_marinerId_idx`(`marinerId`),
    INDEX `TeamMariner_teamId_role_idx`(`teamId`, `role`),
    UNIQUE INDEX `TeamMariner_teamId_marinerId_key`(`teamId`, `marinerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Report_teamId_idx` ON `Report`(`teamId`);

-- AddForeignKey
ALTER TABLE `Report` ADD CONSTRAINT `Report_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamCaptain` ADD CONSTRAINT `TeamCaptain_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamCaptain` ADD CONSTRAINT `TeamCaptain_captainId_fkey` FOREIGN KEY (`captainId`) REFERENCES `Captain`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamMariner` ADD CONSTRAINT `TeamMariner_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamMariner` ADD CONSTRAINT `TeamMariner_marinerId_fkey` FOREIGN KEY (`marinerId`) REFERENCES `Mariner`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
