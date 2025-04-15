import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js";
import { getCollection } from "../utils/mongodb.js";

export const data = new SlashCommandBuilder()
  .setName("substitutes")
  .setDescription("Получить список запасных участников события")
  .addStringOption((option) =>
    option
      .setName("eventid")
      .setDescription("ID события (если не указан — берётся активное событие)")
      .setRequired(false)
  );

export const execute = async (interaction) => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const eventIdOption = interaction.options.getString("eventid");
  const eventsCollection = await getCollection("events");
  let event;

  if (eventIdOption) {
    event = await eventsCollection.findOne({ eventId: eventIdOption });
  } else {
    event = await eventsCollection.findOne({ status: "active" });
  }

  if (!event) {
    await interaction.editReply("Событие не найдено.");
    return;
  }

  const substitutes = event.substitutes || [];

  if (substitutes.length === 0) {
    await interaction.editReply("В данном событии нет запасных участников.");
    return;
  }

  const substitutesList = substitutes
    .map((sub, index) => {
      const displayName = sub.nickname ? sub.nickname : "Без имени";
      const squadHours = sub.squadHours
        ? `| Часов в Squad: ${sub.squadHours}`
        : "";
      return `${index + 1}. <@${sub.userId}> — ${displayName} ${squadHours}`;
    })
    .join("\n");

  const embed = new EmbedBuilder()
    .setTitle(`Список запасных для события ${event.eventId}`)
    .setDescription(substitutesList)
    .setColor("Blue")
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
};

export default { data, execute };
