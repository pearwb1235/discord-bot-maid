import { Events } from "discord.js";
import { discordClient } from "~/library/discord";
import { GuildModel } from "~/model/guild";
import { MemberModel } from "~/model/member";

discordClient.once(Events.ClientReady, (c) => {
  console.log(`機器人 \`${c.user.tag}\` 已連線`);
});
discordClient.on(Events.MessageCreate, (message) => {
  GuildModel.get(message.guildId).then(async (guild) => {
    const member = await MemberModel.get(message.guildId, message.member.id);
    const roles = await member.getRoles(
      guild
        .get()
        .roles.cache.filter(
          (role) => role.rawPosition > 0 && !("botId" in role.tags)
        )
        .map((role) => role.id)
    );
    for (const roleId in roles) {
      const role = guild.get().roles.cache.get(roleId);
      console.log(
        `${role ? role.name : "<DELETE>"}(${roleId}): ${roles[roleId]}`
      );
    }
  });
});
discordClient.login(process.env.DISCORD_TOKEN);
