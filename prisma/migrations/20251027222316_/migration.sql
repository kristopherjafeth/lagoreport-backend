/*
  Warnings:

  - You are about to drop the `Brightness` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Co2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Fan1` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Greenhouse` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Heater1` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Humidity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Lamp1` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Luminosity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Moi` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Ph` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Pump1` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Rs_med` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SoilHumidity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Temperature` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Volts` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `Brightness` DROP FOREIGN KEY `Brightness_greenhouseId_fkey`;

-- DropForeignKey
ALTER TABLE `Co2` DROP FOREIGN KEY `Co2_greenhouseId_fkey`;

-- DropForeignKey
ALTER TABLE `Fan1` DROP FOREIGN KEY `Fan1_greenhouseId_fkey`;

-- DropForeignKey
ALTER TABLE `Heater1` DROP FOREIGN KEY `Heater1_greenhouseId_fkey`;

-- DropForeignKey
ALTER TABLE `Humidity` DROP FOREIGN KEY `Humidity_greenhouseId_fkey`;

-- DropForeignKey
ALTER TABLE `Lamp1` DROP FOREIGN KEY `Lamp1_greenhouseId_fkey`;

-- DropForeignKey
ALTER TABLE `Luminosity` DROP FOREIGN KEY `Luminosity_greenhouseId_fkey`;

-- DropForeignKey
ALTER TABLE `Moi` DROP FOREIGN KEY `Moi_greenhouseId_fkey`;

-- DropForeignKey
ALTER TABLE `Ph` DROP FOREIGN KEY `ph_greenhouseId_fkey`;

-- DropForeignKey
ALTER TABLE `Pump1` DROP FOREIGN KEY `Pump1_greenhouseId_fkey`;

-- DropForeignKey
ALTER TABLE `Rs_med` DROP FOREIGN KEY `Rs_med_greenhouseId_fkey`;

-- DropForeignKey
ALTER TABLE `SoilHumidity` DROP FOREIGN KEY `SoilHumidity_greenhouseId_fkey`;

-- DropForeignKey
ALTER TABLE `Temperature` DROP FOREIGN KEY `Temperature_greenhouseId_fkey`;

-- DropForeignKey
ALTER TABLE `Volts` DROP FOREIGN KEY `Volts_greenhouseId_fkey`;

-- DropTable
DROP TABLE `Brightness`;

-- DropTable
DROP TABLE `Co2`;

-- DropTable
DROP TABLE `Fan1`;

-- DropTable
DROP TABLE `Greenhouse`;

-- DropTable
DROP TABLE `Heater1`;

-- DropTable
DROP TABLE `Humidity`;

-- DropTable
DROP TABLE `Lamp1`;

-- DropTable
DROP TABLE `Luminosity`;

-- DropTable
DROP TABLE `Moi`;

-- DropTable
DROP TABLE `Ph`;

-- DropTable
DROP TABLE `Pump1`;

-- DropTable
DROP TABLE `Rs_med`;

-- DropTable
DROP TABLE `SoilHumidity`;

-- DropTable
DROP TABLE `Temperature`;

-- DropTable
DROP TABLE `Volts`;
