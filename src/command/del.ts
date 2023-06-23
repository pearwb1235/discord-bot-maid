import {
  CacheType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { BaseCommand } from "~/command";
import { GuildModel } from "~/model/guild";

export default class DelCommand implements BaseCommand {
  data = new SlashCommandBuilder()
    .setName("del")
    .setDescription("刪除持久身分組")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption((option) =>
      option.setName("role").setDescription("持久身分組").setRequired(true)
    );
  async execute(
    interaction: ChatInputCommandInteraction<CacheType>
  ): Promise<void> {
    await interaction.deferReply({
      ephemeral: true,
    });
    const guild = await GuildModel.get(interaction.guildId);
    try {
      await guild.delRole(interaction.options.getRole("role", true).id);
      await interaction.editReply({
        content: "女僕將不再處理該身分組紀錄",
      });
    } catch (err) {
      if (err.code === "P2025") {
        await interaction.editReply({
          content: "女僕不覺得這個是持久身分組",
        });
      } else {
        await interaction.editReply({
          content: err.toString(),
        });
      }
    }
  }
}
