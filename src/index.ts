import { Events } from "discord.js";
import { addCommandHandler } from "~/command";
import { registerEvents } from "~/event";
import { discordClient } from "~/library/discord";

discordClient.once(Events.ClientReady, (c) => {
  console.log(`機器人 \`${c.user.tag}\` 已連線`);
});
addCommandHandler(discordClient);
registerEvents(discordClient);
discordClient.login(process.env.DISCORD_TOKEN);
