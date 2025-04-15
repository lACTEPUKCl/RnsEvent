import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import { getCollection } from "../utils/mongodb.js";

const stopreg = new SlashCommandBuilder()
  .setName("stopreg")
  .setDescription("Остановить регистрацию на турнир")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) =>
    option
      .setName("eventid")
      .setDescription("ID события для остановки регистрации")
      .setRequired(true)
  );

const execute = async (interaction) => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const eventId = interaction.options.getString("eventid");

  try {
    const events = await getCollection("events");
    const event = await events.findOne({ eventId });
    if (!event) {
      return interaction.editReply({
        content: `Событие с ID ${eventId} не найдено.`,
      });
    }
    if (event.status === "stopped") {
      return interaction.editReply({
        content: `Регистрация для события с ID ${eventId} уже остановлена.`,
      });
    }

    await events.updateOne({ eventId }, { $set: { status: "stopped" } });

    const channel = await interaction.client.channels
      .fetch(event.channelId)
      .catch(() => null);
    if (!channel) {
      return interaction.editReply({
        content: "Канал, связанный с этим событием, не найден.",
      });
    }

    const message = await channel.messages
      .fetch(event.eventId)
      .catch(() => null);
    if (message) {
      await message.edit({ components: [] });
      console.log(`Кнопки для события ${eventId} успешно удалены.`);
    } else {
      console.warn(`Сообщение события с ID ${eventId} не найдено.`);
    }

    return interaction.editReply({
      content: `Регистрация для события с ID ${eventId} успешно остановлена.`,
    });
  } catch (error) {
    console.error("Ошибка при остановке регистрации:", error);
    return interaction.editReply({
      content: "Произошла ошибка при остановке регистрации.",
    });
  }
};

export default { data: stopreg, execute };
