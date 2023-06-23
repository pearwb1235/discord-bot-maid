import {
  CacheType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { BaseCommand } from "~/command";
import { GuildModel } from "~/model/guild";

export default class AddCommand implements BaseCommand {
  data = new SlashCommandBuilder()
    .setName("add")
    .setDescription("增加持久身分組")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption((option) =>
      option.setName("role").setDescription("持久身分組").setRequired(true)
    )
    .addBooleanOption((option) =>
      option.setName("default").setDescription("預設是否擁有該身分")
    );
  async execute(
    interaction: ChatInputCommandInteraction<CacheType>
  ): Promise<void> {
    await interaction.deferReply({
      ephemeral: true,
    });
    const guild = await GuildModel.get(interaction.guildId);
    try {
      await guild.addRole(
        interaction.options.getRole("role", true).id,
        interaction.options.getBoolean("default") || false
      );
      await interaction.editReply({
        content: "女僕已更新身分組狀態",
      });
    } catch (err) {
      await interaction.editReply({
        content: err.toString(),
      });
    }
  }
}
