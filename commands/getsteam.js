import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { getCollection } from "../utils/mongodb.js";
import { config } from "dotenv";
config();

const getsteam = new SlashCommandBuilder()
  .setName("getsteam")
  .setDescription("Получить информацию об игроке по нику (Steam ID)")
  .addStringOption((option) =>
    option
      .setName("username")
      .setDescription("Никнейм игрока из эмбеда")
      .setRequired(true)
  );

const execute = async (interaction) => {
  const username = interaction.options.getString("username").trim();
  const eventsCollection = await getCollection("events");
  const query = {
    $or: [
      { "teams.members.nickname": { $regex: `^${username}$`, $options: "i" } },
      { "substitutes.nickname": { $regex: `^${username}$`, $options: "i" } },
    ],
  };
  const eventsFound = await eventsCollection.find(query).toArray();

  if (!eventsFound.length) {
    return interaction.reply({
      content: `Игрок с ником "${username}" не найден.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  let resultText;
  for (const event of eventsFound) {
    for (const team of event.teams) {
      const matchingMembers = team.members.filter(
        (member) => member.nickname.toLowerCase() === username.toLowerCase()
      );
      for (const member of matchingMembers) {
        resultText = `Команда: ${team.name}, Ник: ${member.nickname}, Steam ID: ${member.steamId}\n`;
      }
    }
    if (event.substitutes && Array.isArray(event.substitutes)) {
      const matchingSubs = event.substitutes.filter(
        (sub) => sub.nickname.toLowerCase() === username.toLowerCase()
      );
      for (const sub of matchingSubs) {
        resultText = `Скамья запасных, Ник: ${member.nickname}, Steam ID: ${sub.steamId}\n`;
      }
    }
  }

  if (resultText.length > 1900) {
    resultText = resultText.slice(0, 1900) + "\n... (результаты обрезаны)";
  }

  return interaction.reply({
    content: resultText,
    flags: MessageFlags.Ephemeral,
  });
};

export default { data: getsteam, execute };
