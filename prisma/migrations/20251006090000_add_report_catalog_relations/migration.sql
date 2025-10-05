-- Add captain/customer relations to Report
ALTER TABLE `Report`
  ADD COLUMN `captainId` INTEGER NULL,
  ADD COLUMN `customerId` INTEGER NULL;

CREATE INDEX `Report_captainId_idx` ON `Report`(`captainId`);
CREATE INDEX `Report_customerId_idx` ON `Report`(`customerId`);

ALTER TABLE `Report`
  ADD CONSTRAINT `Report_captainId_fkey`
  FOREIGN KEY (`captainId`) REFERENCES `Captain`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Report`
  ADD CONSTRAINT `Report_customerId_fkey`
  FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
