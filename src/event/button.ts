import {
  CacheType,
  ClientEvents,
  Events,
  GuildMember,
  Interaction,
} from "discord.js";
import { BaseEvent } from "~/event";

export default class ButtonEvent implements BaseEvent {
  name: keyof ClientEvents = Events.InteractionCreate;
  async execute(interaction: Interaction<CacheType>): Promise<void> {
    if (!interaction.isButton()) return;
    await interaction.deferReply({
      ephemeral: true,
    });
    try {
      const match = /^giverole_(\d+)$/.exec(interaction.customId);
      if (match === null) {
        await interaction.editReply({
          content: `這個按鈕已經失效了`,
        });
        return;
      }
      const role = interaction.guild.roles.cache.get(match[1]);
      const member = interaction.member as GuildMember;
      if (member.roles.cache.has(role.id)) {
        if (!["develop", "DEVELOP"].includes(process.env.NODE_ENV))
          await member.roles.remove(role, "身分組按鈕");
        await interaction.editReply({
          content: `您不再擁有 <@&${role.id}> 身分組`,
        });
      } else {
        if (!["develop", "DEVELOP"].includes(process.env.NODE_ENV))
          await member.roles.add(role, "身分組按鈕");
        await interaction.editReply({
          content: `您現在擁有 <@&${role.id}> 身分組`,
        });
      }
    } catch (err) {
      await interaction.editReply({
        content: err.toString(),
      });
    }
  }
}
