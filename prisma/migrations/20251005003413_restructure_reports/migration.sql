-- El nuevo esquema difiere completamente del anterior, por lo que recreamos la tabla
-- `Report` y definimos la tabla relacionada `ReportActivity`.

DROP TABLE IF EXISTS `ReportActivity`;
DROP TABLE IF EXISTS `Report`;

CREATE TABLE `Report` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `vesselName` VARCHAR(191) NOT NULL,
  `captainName` VARCHAR(191) NOT NULL,
  `clientName` VARCHAR(191) NOT NULL,
  `patronName` VARCHAR(191) NOT NULL,
  `motoristaName` VARCHAR(191) NOT NULL,
  `cookName` VARCHAR(191) NOT NULL,
  `sailorName` VARCHAR(191) NOT NULL,
  `notes` VARCHAR(191) NULL,
  `serviceDate` DATETIME(3) NOT NULL,
  `serviceStart` DATETIME(3) NOT NULL,
  `serviceEnd` DATETIME(3) NOT NULL,
  `totalServiceMinutes` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE = InnoDB;

CREATE TABLE `ReportActivity` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `reportId` INTEGER NOT NULL,
  `description` VARCHAR(191) NOT NULL,
  `startedAt` DATETIME(3) NOT NULL,
  `endedAt` DATETIME(3) NOT NULL,
  `imageUrl` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE = InnoDB;

CREATE INDEX `Report_vesselName_idx` ON `Report`(`vesselName`);
CREATE INDEX `Report_serviceDate_idx` ON `Report`(`serviceDate`);
CREATE INDEX `ReportActivity_reportId_idx` ON `ReportActivity`(`reportId`);
CREATE INDEX `ReportActivity_startedAt_idx` ON `ReportActivity`(`startedAt`);

ALTER TABLE `Reportactivity`
  ADD CONSTRAINT `ReportActivity_reportId_fkey`
  FOREIGN KEY (`reportId`) REFERENCES `Report`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
