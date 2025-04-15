import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { getCollection } from "../utils/mongodb.js";
import { updateEventEmbed } from "../utils/updateEventEmbed.js";

export const data = new SlashCommandBuilder()
  .setName("swap")
  .setDescription(
    "Заменить игрока из команды (по Steam ID) игроком из скамьи запасных."
  )
  .addStringOption((option) =>
    option
      .setName("substitute")
      .setDescription("Ник игрока, как указано в списке запасных")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("target")
      .setDescription("Ник игрока, которого вы хотите заменить")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("eventid")
      .setDescription("ID события (если не указан — берётся активное событие)")
      .setRequired(false)
  );

export const execute = async (interaction) => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const substituteNickname = interaction.options.getString("substitute");
  const targetNickname = interaction.options.getString("target");
  const eventIdOption = interaction.options.getString("eventid");

  const eventsCollection = await getCollection("events");
  let event;
  if (eventIdOption) {
    event = await eventsCollection.findOne({ eventId: eventIdOption });
  } else {
    event = await eventsCollection.findOne({ status: "active" });
  }
  if (!event) {
    return interaction.editReply("Событие не найдено.");
  }
  if (!event.substitutes || event.substitutes.length === 0) {
    return interaction.editReply("Скамья запасных пуста.");
  }
  const substituteIndex = event.substitutes.findIndex(
    (sub) => sub.nickname === substituteNickname
  );
  if (substituteIndex === -1) {
    return interaction.editReply("Запасной с указанным ником не найден.");
  }
  const substitute = event.substitutes[substituteIndex];

  let teamFound = null;
  let teamIndex = -1;
  let targetIndex = -1;
  for (let i = 0; i < event.teams.length; i++) {
    const team = event.teams[i];
    const index = team.members.findIndex(
      (member) => member.nickname === targetNickname
    );
    if (index !== -1) {
      teamFound = team;
      teamIndex = i;
      targetIndex = index;
      break;
    }
  }
  if (!teamFound) {
    return interaction.editReply(
      "Игрок с указанным ником не найден в составе ни одной команды."
    );
  }
  const target = teamFound.members[targetIndex];

  // Процесс обмена
  teamFound.members.splice(targetIndex, 1);
  event.substitutes.splice(substituteIndex, 1);
  teamFound.members.push(substitute);
  event.substitutes.push(target);

  const updateResult = await eventsCollection.updateOne(
    { eventId: event.eventId },
    { $set: { teams: event.teams, substitutes: event.substitutes } }
  );
  if (updateResult.modifiedCount === 0) {
    return interaction.editReply("Не удалось обновить данные о событии.");
  }
  await updateEventEmbed(interaction.client, event);

  return interaction.editReply(
    `Успешно заменён игрок с ником **${targetNickname}** на запасного с ником **${substituteNickname}**.`
  );
};

export default { data, execute };
