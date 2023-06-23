-- CreateTable
CREATE TABLE `member` (
    `guildId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `roleUpdatedAt` VARCHAR(191) NULL,

    PRIMARY KEY (`guildId`, `memberId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `member_roles` (
    `guildId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `flag` BOOLEAN NOT NULL,

    PRIMARY KEY (`guildId`, `memberId`, `roleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `member_roles` ADD CONSTRAINT `member_roles_guildId_memberId_fkey` FOREIGN KEY (`guildId`, `memberId`) REFERENCES `member`(`guildId`, `memberId`) ON DELETE RESTRICT ON UPDATE CASCADE;
