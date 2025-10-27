-- Create captain-user relation and persistent two-factor codes for captain accounts
ALTER TABLE `Captain`
  ADD COLUMN `userId` INT NULL,
  ADD CONSTRAINT `Captain_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD UNIQUE INDEX `Captain_userId_key` (`userId`);

ALTER TABLE `User`
  ADD COLUMN `twoFactorCode` CHAR(6) NULL,
  ADD UNIQUE INDEX `User_twoFactorCode_key` (`twoFactorCode`);
