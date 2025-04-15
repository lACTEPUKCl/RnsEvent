import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import { getCollection } from "../utils/mongodb.js";
import { config } from "dotenv";
config();

const startreg = new SlashCommandBuilder()
  .setName("startreg")
  .setDescription(
    "Запуск регистрации на турнир (только число участников в команде)"
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addIntegerOption((option) =>
    option
      .setName("players")
      .setDescription("Количество участников в команде (по умолчанию 2)")
      .setRequired(false)
  );

const execute = async (interaction) => {
  const maxPlayersPerTeam = interaction.options.getInteger("players") || 2;
  const eventChannel = interaction.guild.channels.cache.get(
    process.env.EVENT_CHANNELID
  );
  if (!eventChannel) {
    return interaction.reply({
      content: "Канал для публикации событий не найден.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("Регистрация на ивент")
    .setColor("#3498DB")
    .addFields(
      { name: `Команда 1 (0/${maxPlayersPerTeam})`, value: "-", inline: true },
      { name: `Команда 2 (0/${maxPlayersPerTeam})`, value: "-", inline: true }
    );

  const placeholderRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("register_placeholder")
      .setLabel("Регистрация")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("cancel_placeholder")
      .setLabel("Отмена")
      .setStyle(ButtonStyle.Danger)
  );

  const message = await eventChannel.send({
    embeds: [embed],
    components: [placeholderRow],
  });

  const updatedRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`register_default_${message.id}`)
      .setLabel("Регистрация")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`cancel_default_${message.id}`)
      .setLabel("Отмена")
      .setStyle(ButtonStyle.Danger)
  );

  await message.edit({ components: [updatedRow] });

  try {
    const events = await getCollection("events");
    await events.insertOne({
      eventId: message.id,
      channelId: eventChannel.id,
      guildId: interaction.guild.id,
      text: "",
      imageUrl: "",
      eventType: "default",
      status: "active",
      teams: [
        { name: "Команда 1", members: [] },
        { name: "Команда 2", members: [] },
      ],
      substitutes: [],
      maxPlayersPerTeam,
      createdBy: interaction.user.id,
      createdAt: new Date(),
    });
    await interaction.reply({
      content: "Регистрация успешно создана!",
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error("Ошибка при сохранении события:", error);
    await interaction.reply({
      content: "Произошла ошибка при сохранении события.",
      flags: MessageFlags.Ephemeral,
    });
  }
};

export default { data: startreg, execute };
