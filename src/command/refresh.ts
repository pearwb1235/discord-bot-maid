import {
  CacheType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { BaseCommand } from "~/command";
import { GuildModel, RefreshMembersType } from "~/model/guild";

export default class RefreshCommand implements BaseCommand {
  data = new SlashCommandBuilder()
    .setName("refresh")
    .setDescription("立即刷新資料")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
  async execute(
    interaction: ChatInputCommandInteraction<CacheType>
  ): Promise<void> {
    await interaction.deferReply({
      ephemeral: true,
    });
    const guild = await GuildModel.get(interaction.guildId);
    try {
      if (await guild.refreshMembers(RefreshMembersType.ALL))
        await interaction.editReply({
          content: "女僕已整理資料完成",
        });
      else
        await interaction.editReply({
          content: "女僕正在處理其他事情，稍後再來找她吧",
        });
    } catch (err) {
      await interaction.editReply({
        content: err.toString(),
      });
    }
  }
}
