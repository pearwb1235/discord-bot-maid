import { CacheType, ClientEvents, Events, Interaction } from "discord.js";
import { BaseEvent } from "~/event";
import { GuildModel } from "~/model/guild";
import { MemberModel } from "~/model/member";

export default class JoinEvent implements BaseEvent {
  name: keyof ClientEvents = Events.GuildMemberAdd;
  async execute(interaction: Interaction<CacheType>): Promise<void> {
    const guild = await GuildModel.get(interaction.guild.id);
    const welcome = guild.welcome;
    if (welcome) {
      const channel = guild.get().channels.cache.get(welcome.channelId);
      if (channel && channel.isTextBased()) {
        channel.send(
          welcome.msg.replace(/(?<!\\)({{user}})/g, `<@${interaction.user.id}>`)
        );
      }
    }
    if (guild.markRoleId) {
      const member = await MemberModel.get(guild, interaction.user.id);
      await member.fresh();
    }
  }
}
