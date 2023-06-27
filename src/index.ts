import { Events } from "discord.js";
import { addCommandHandler } from "~/command";
import { registerEvents } from "~/event";
import { refreshGuilds } from "~/guild";
import { discordClient } from "~/library/discord";
import { logger } from "~/library/logger";

discordClient.once(Events.ClientReady, (c) => {
  logger.info(`機器人 \`${c.user.tag}\` 已連線`);
  refreshGuilds();
});
addCommandHandler(discordClient);
registerEvents(discordClient);
discordClient.login(process.env.DISCORD_TOKEN);
