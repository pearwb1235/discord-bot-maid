import { discordClient } from "~/library/discord";
import { logger } from "~/library/logger";
import { prismaClient } from "~/library/prisma";
import { GuildModel } from "~/model/guild";
import { MemberModel } from "~/model/member";

export async function loadGuilds() {
  logger.debug(0, "女僕正準備上班...");
  try {
    const guilds = await prismaClient.guild.findMany();
    for (const guild of guilds) {
      if (!discordClient.guilds.cache.get(guild.guildId)) {
        logger.error(`女僕遺失了 \`${guild.guildId}\` 的鑰匙`);
        continue;
      }
      if (!guild.markRoleId) continue;
      const guildModel = await GuildModel.get(guild.guildId);
      const members = await guildModel
        .get()
        .members.fetch()
        .then((members) => members.toJSON());
      for (const member of members) {
        if (member.roles.cache.has(guild.markRoleId)) continue;
        logger.debug(
          1,
          `女僕抓到了下班時間偷溜進來的 \`${member.displayName}(${member.id})\``
        );
        const memberModel = await MemberModel.get(guildModel, member.id);
        await memberModel.freshRoles("加入伺服器(load)");
      }
      await guildModel.refreshMembers();
    }
    logger.debug(0, "女僕開始上班!");
  } catch (err) {
    logger.error("女僕整理資料發生了錯誤:", err.toString());
  }
}

export async function refreshGuilds() {
  logger.debug(0, "女僕開始整理資料...");
  try {
    const guilds = await prismaClient.guild.findMany();
    for (const guild of guilds) {
      if (!discordClient.guilds.cache.get(guild.guildId)) {
        logger.error(`女僕遺失了 \`${guild.guildId}\` 的鑰匙`);
        continue;
      }
      if (!guild.markRoleId) continue;
      const guildModel = await GuildModel.get(guild.guildId);
      await guildModel.refreshMembers();
    }
    logger.debug(0, "女僕整理資料完畢!");
  } catch (err) {
    logger.error("女僕整理資料發生了錯誤:", err.toString());
  }
  setTimeout(refreshGuilds, 60 * 1000);
}
