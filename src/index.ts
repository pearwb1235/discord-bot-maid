import { Events } from "discord.js";
import { discordClient } from "~/library/discord";
import { Member } from "~/model/member";

discordClient.once(Events.ClientReady, (c) => {
  console.log(`機器人 \`${c.user.tag}\` 已連線`);
});
discordClient.on(Events.MessageCreate, (message) => {
  const member = new Member(message.guildId, message.member.id);
  member.getRoles().then((result) => console.log(result));
});
discordClient.login(process.env.DISCORD_TOKEN);
