-- CreateTable
CREATE TABLE `BrandingSetting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sidebarLogoUrl` VARCHAR(191) NULL,
    `pdfLogoUrl` VARCHAR(191) NULL,
    `primaryColor` VARCHAR(191) NOT NULL DEFAULT '#0039B7',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
