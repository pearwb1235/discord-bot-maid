-- CreateTable
CREATE TABLE `guild` (
    `guildId` VARCHAR(191) NOT NULL,
    `markRoleId` VARCHAR(191) NULL,

    PRIMARY KEY (`guildId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `guild_roles` (
    `guildId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `defaultValue` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`guildId`, `roleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `guild_roles` ADD CONSTRAINT `guild_roles_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `guild`(`guildId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
INSERT INTO `guild` (`guildId`) SELECT DISTINCT `guildId` FROM `member`;
ALTER TABLE `member` ADD CONSTRAINT `member_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `guild`(`guildId`) ON DELETE RESTRICT ON UPDATE CASCADE;
