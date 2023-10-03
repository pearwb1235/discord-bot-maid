import {
  CacheType,
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { BaseCommand } from "~/command";
import { GuildModel } from "~/model/guild";

export default class WelcomeCommand implements BaseCommand {
  data = new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("加入伺服器歡迎訊息")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option.setName("msg").setDescription("{{user}}標記使用者")
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("歡迎頻道")
        .addChannelTypes(ChannelType.GuildText)
    );
  async execute(
    interaction: ChatInputCommandInteraction<CacheType>
  ): Promise<void> {
    const guild = await GuildModel.get(interaction.guildId);
    const channel = interaction.options.getChannel("channel");
    const msg = interaction.options.getString("msg");
    try {
      await guild.setWelcome(
        msg === null ? null : interaction.options.getString("msg"),
        msg === null ? null : channel ? channel.id : interaction.channelId
      );
      await interaction.reply({
        content: "女僕知道了",
        ephemeral: true,
      });
    } catch (err) {
      await interaction.reply({
        content: err.toString(),
        ephemeral: true,
      });
    }
  }
}
