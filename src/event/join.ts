import { CacheType, ClientEvents, Events, Interaction } from "discord.js";
import { BaseEvent } from "~/event";
import { GuildModel } from "~/model/guild";
import { MemberModel } from "~/model/member";
import { formatString } from "~/util/formatString";

export default class JoinEvent implements BaseEvent {
  name: keyof ClientEvents = Events.GuildMemberAdd;
  async execute(interaction: Interaction<CacheType>): Promise<void> {
    const guild = await GuildModel.get(interaction.guild.id);
    const welcome = guild.welcome;
    if (welcome) {
      const channel = guild.get().channels.cache.get(welcome.channelId);
      if (channel && channel.isTextBased()) {
        channel.send(
          formatString(welcome.msg, { user: `<@${interaction.user.id}>` })
        );
      }
    }
    if (guild.markRoleId) {
      const member = await MemberModel.get(guild, interaction.user.id);
      await member.init();
      await member.freshRoles("加入伺服器(join)");
    }
  }
}
