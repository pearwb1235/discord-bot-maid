import { discordClient } from "~/library/discord";
import { logger } from "~/library/logger";
import { prismaClient } from "~/library/prisma";
import { GuildModel } from "~/model/guild";

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
