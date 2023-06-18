import { Client, Events, GatewayIntentBits } from "discord.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});
client.once(Events.ClientReady, (c) => {
  console.log(`機器人 \`${c.user.tag}\` 已連線`);
});
client.login(process.env.DISCORD_TOKEN);
