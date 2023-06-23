import { CacheType, ClientEvents, Events, Interaction } from "discord.js";
import { BaseEvent } from "~/event";
import { MemberModel } from "~/model/member";

export default class JoinEvent implements BaseEvent {
  name: keyof ClientEvents = Events.GuildMemberAdd;
  async execute(interaction: Interaction<CacheType>): Promise<void> {
    const member = await MemberModel.get(
      interaction.guild.id,
      interaction.user.id
    );
    await member.fresh();
  }
}
