import {
  CacheType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { BaseCommand } from "~/command";
import { GuildModel } from "~/model/guild";

export default class InitCommand implements BaseCommand {
  data = new SlashCommandBuilder()
    .setName("init")
    .setDescription("初始化設定")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption((option) =>
      option.setName("role").setDescription("標記身分組").setRequired(true)
    );
  async execute(
    interaction: ChatInputCommandInteraction<CacheType>
  ): Promise<void> {
    await interaction.deferReply({
      ephemeral: true,
    });
    const guild = await GuildModel.get(interaction.guildId);
    try {
      if (await guild.init(interaction.options.getRole("role", true).id)) {
        await interaction.editReply({
          content: "女僕已入住",
        });
      } else {
        await interaction.editReply({
          content: "女僕正在處理其他事情，稍後再來找她吧",
        });
      }
    } catch (err) {
      await interaction.editReply({
        content: err.toString(),
      });
    }
  }
}
