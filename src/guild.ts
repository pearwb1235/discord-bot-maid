import { discordClient } from "~/library/discord";
import { prismaClient } from "~/library/prisma";
import { GuildModel } from "~/model/guild";

export async function refreshGuilds() {
  console.log("女僕開始整理資料...");
  try {
    const guilds = await prismaClient.guild.findMany();
    for (const guild of guilds) {
      if (!discordClient.guilds.cache.get(guild.guildId)) {
        console.error(`女僕遺失了 \`${guild.guildId}\` 的鑰匙`);
        continue;
      }
      if (!guild.markRoleId) continue;
      const guildModel = await GuildModel.get(guild.guildId);
      await guildModel.refreshMembers();
    }
  } catch (err) {
    console.error(err);
  }
  console.log("女僕整理資料完畢!");
  setTimeout(refreshGuilds, 60 * 1000);
}
