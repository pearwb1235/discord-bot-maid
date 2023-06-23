/*
  Warnings:

  - You are about to drop the column `roleUpdatedAt` on the `member` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `guild` ADD COLUMN `lastAuditLogId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `member` DROP COLUMN `roleUpdatedAt`;
