/*
  Warnings:

  - You are about to drop the `fanactuator1` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `Fanactuator1` DROP FOREIGN KEY `Fanactuator1_greenhouseId_fkey`;

-- DropTable
DROP TABLE `Fanactuator1`;
