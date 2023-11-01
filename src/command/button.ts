import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CacheType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { BaseCommand } from "~/command";

export default class ButtonCommand implements BaseCommand {
  data = new SlashCommandBuilder()
    .setName("button")
    .setDescription("創建身分組按鈕")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption((option) =>
      option.setName("role").setDescription("給予的身分組").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("label").setDescription("按鈕文字").setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("color")
        .setDescription("按鈕顏色")
        .addChoices(
          { name: "Primary", value: "Primary" },
          { name: "Secondary", value: "Secondary" },
          { name: "Success", value: "Success" },
          { name: "Danger", value: "Danger" },
          { name: "Link", value: "Link" }
        )
    )
    .addStringOption((option) =>
      option.setName("emoji").setDescription("按鈕表情")
    )
    .addStringOption((option) =>
      option.setName("message").setDescription("訊息")
    );
  async execute(
    interaction: ChatInputCommandInteraction<CacheType>
  ): Promise<void> {
    await interaction.deferReply({
      ephemeral: true,
    });
    try {
      const color = interaction.options.getString("color") as
        | "Primary"
        | "Secondary"
        | "Success"
        | "Danger"
        | "Link"
        | null;
      const emoji = interaction.options.getString("emoji");
      const message = interaction.options.getString("message");

      if (emoji !== null && !/^<a?:.+?:\d{18,}>$/u.test(emoji)) {
        await interaction.editReply({
          content: "按鈕表情參數錯誤",
        });
        return;
      }

      const btn = new ButtonBuilder()
        .setCustomId(`giverole_${interaction.options.getRole("role").id}`)
        .setLabel(interaction.options.getString("label", true))
        .setStyle(color !== null ? ButtonStyle[color] : ButtonStyle.Primary);

      if (emoji !== null) btn.setEmoji(emoji);

      await interaction.channel.send({
        content: message !== null ? message : undefined,
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(btn)],
      });
      await interaction.editReply({
        content: "女僕已為您創建了一個按鈕",
      });
    } catch (err) {
      await interaction.editReply({
        content: err.toString(),
      });
    }
  }
}
