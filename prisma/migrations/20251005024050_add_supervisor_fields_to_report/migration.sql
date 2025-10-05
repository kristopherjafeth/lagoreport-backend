-- AlterTable
ALTER TABLE `Report` ADD COLUMN `clientSupervisorName` VARCHAR(191) NULL,
    ADD COLUMN `companySupervisorName` VARCHAR(191) NULL,
    ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `Reportactivity` ALTER COLUMN `updatedAt` DROP DEFAULT;
