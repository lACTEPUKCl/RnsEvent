import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import { getCollection } from "../utils/mongodb.js";

const notification = new SlashCommandBuilder()
  .setName("notification")
  .setDescription(
    "Отправить напоминание об ивенте всем зарегистрированным игрокам"
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) =>
    option
      .setName("event_id")
      .setDescription("ID события, для которого отправить напоминание")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("message_link")
      .setDescription("Ссылка на сообщение ивента")
      .setRequired(true)
  );

const execute = async (interaction) => {
  const eventId = interaction.options.getString("event_id");
  const messageLink = interaction.options.getString("message_link");

  try {
    const eventsCollection = await getCollection("events");
    const event = await eventsCollection.findOne({ eventId });

    if (!event) {
      return interaction.reply({
        content: `Событие с ID ${eventId} не найдено.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const registeredUserIds = new Set();
    for (const team of event.teams) {
      for (const member of team.members) {
        registeredUserIds.add(member.userId);
      }
    }
    if (event.substitutes && event.substitutes.length > 0) {
      for (const sub of event.substitutes) {
        registeredUserIds.add(sub.userId);
      }
    }

    const reminderMessage = `Напоминаем, что ваш ивент скоро начнется! Посмотрите детали по ссылке: ${messageLink}`;

    for (const userId of registeredUserIds) {
      try {
        const user = await interaction.client.users.fetch(userId);
        if (user) {
          await user.send(reminderMessage);
        }
      } catch (dmError) {
        console.error(
          `Не удалось отправить DM пользователю ${userId}:`,
          dmError
        );
      }
    }

    await interaction.reply({
      content: "Напоминание отправлено всем зарегистрированным игрокам.",
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error("Ошибка при отправке напоминаний:", error);
    await interaction.reply({
      content: "Произошла ошибка при отправке напоминаний.",
      flags: MessageFlags.Ephemeral,
    });
  }
};

export default { data: notification, execute };
