import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import { getCollection } from "../utils/mongodb.js";

const deluser = new SlashCommandBuilder()
  .setName("deluser")
  .setDescription("Удалить пользователя из команд по нику")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) =>
    option
      .setName("nickname")
      .setDescription("Ник пользователя")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("eventid")
      .setDescription("ID события, из которого удалить пользователя.")
      .setRequired(false)
  );

const execute = async (interaction) => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const nickname = interaction.options.getString("nickname");
  const eventIdOption = interaction.options.getString("eventid");

  try {
    const events = await getCollection("events");

    let affectedEvents;
    if (eventIdOption) {
      affectedEvents = await events
        .find({
          eventId: eventIdOption,
          "teams.members.nickname": nickname,
        })
        .toArray();
    } else {
      affectedEvents = await events
        .find({ "teams.members.nickname": nickname })
        .toArray();
    }

    if (affectedEvents.length === 0) {
      return interaction.editReply({
        content: `Пользователь с ником ${nickname} не найден ${
          eventIdOption ? `в событии с ID ${eventIdOption}` : "во всех событиях"
        }.`,
      });
    }

    for (const event of affectedEvents) {
      event.teams.forEach((team) => {
        team.members = team.members.filter(
          (member) => member.nickname !== nickname
        );
      });

      await events.updateOne(
        { eventId: event.eventId },
        { $set: { teams: event.teams } }
      );

      const eventChannel = interaction.guild.channels.cache.get(
        event.channelId
      );
      if (!eventChannel) {
        console.error(`Канал с ID ${event.channelId} не найден.`);
        continue;
      }

      const message = await eventChannel.messages
        .fetch(event.eventId)
        .catch(() => null);
      if (!message) {
        console.error(`Сообщение с ID ${event.eventId} не найдено.`);
        continue;
      }

      const maxPlayersPerTeam = event.maxPlayersPerTeam || "∞";

      const updatedFields = event.teams.map((team) => {
        const registeredPlayers = team.members.reduce(
          (acc, member) => acc + (member.numberPlayers || 1),
          0
        );
        const membersText =
          team.members
            .map((member) => `${member.nickname} (${member.nickname})`)
            .join("\n") || "-";
        return {
          name: `${team.name} (${registeredPlayers}/${maxPlayersPerTeam})`,
          value: membersText,
          inline: true,
        };
      });

      const existingEmbed = message.embeds?.[0];
      const updatedEmbed = existingEmbed
        ? EmbedBuilder.from(existingEmbed)
        : new EmbedBuilder()
            .setTitle("Регистрация на турнир")
            .setColor("#3498DB");

      updatedEmbed.setFields(updatedFields);

      await message.edit({ embeds: [updatedEmbed] });
    }

    return interaction.editReply({
      content: `Пользователь с Steam ID ${nickname} успешно удалён ${
        eventIdOption ? `из события с ID ${eventIdOption}` : "из всех событий"
      }.`,
    });
  } catch (error) {
    console.error("Ошибка при удалении пользователя:", error);
    return interaction.editReply({
      content: "Произошла ошибка при удалении пользователя.",
    });
  }
};

export default { data: deluser, execute };
