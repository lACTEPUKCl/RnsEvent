import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import { getCollection } from "../utils/mongodb.js";

const delevent = new SlashCommandBuilder()
  .setName("delevent")
  .setDescription("Удалить событие")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) =>
    option
      .setName("eventid")
      .setDescription("ID события для удаления")
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

    await events.deleteOne({ eventId });

    const channel = await interaction.client.channels
      .fetch(event.channelId)
      .catch(() => null);
    if (!channel) {
      return interaction.editReply({
        content:
          "Канал, связанный с этим событием, не найден. Событие удалено из базы данных.",
      });
    }

    const message = await channel.messages.fetch(eventId).catch(() => null);
    if (message) {
      await message.delete();
    }

    return interaction.editReply({
      content: `Событие с ID ${eventId} успешно удалено.`,
    });
  } catch (error) {
    console.error("Ошибка при удалении события:", error);
    return interaction.editReply({
      content: "Произошла ошибка при удалении события.",
    });
  }
};

export default { data: delevent, execute };
