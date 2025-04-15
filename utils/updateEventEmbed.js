import { EmbedBuilder } from "discord.js";

export const updateEventEmbed = async (client, event) => {
  try {
    const eventChannel = await client.channels.fetch(event.channelId);
    if (!eventChannel) {
      console.error(`❌ Канал ${event.channelId} не найден.`);
      return;
    }

    const eventMessage = await eventChannel.messages.fetch(event.eventId);
    if (!eventMessage) {
      console.error(`❌ Сообщение события ${event.eventId} не найдено.`);
      return;
    }

    if (!eventMessage.editable) {
      console.error("❌ Бот не может редактировать это сообщение!");
      return;
    }

    const maxPlayersPerTeam = event.maxPlayersPerTeam || "∞";

    const updatedEmbed = EmbedBuilder.from(eventMessage.embeds[0]).setFields(
      event.teams.map((team) => {
        const registeredPlayers = team.members.reduce(
          (acc, member) => acc + (member.numberPlayers || 1),
          0
        );

        const membersText =
          team.members
            .map((member) => {
              if (member.clanTag) {
                return `[${member.clanTag}] ${member.nickname} (${member.steamId}) [${member.numberPlayers}]`;
              } else if (
                member.squadLeader ||
                member.techSquad ||
                member.techSquad
              ) {
                let prefix = "";
                if (
                  member.techSquad &&
                  member.techSquad.toLowerCase() === "да"
                ) {
                  prefix += "⚙️";
                }
                if (
                  member.squadLeader &&
                  member.squadLeader.toLowerCase() === "да"
                ) {
                  prefix += "⭐";
                }
                if (
                  member.pilotSquad &&
                  member.pilotSquad.toLowerCase() === "да"
                ) {
                  prefix += "🚁";
                }
                return `${prefix}${member.nickname} - ${member.squadHours}ч.`;
              } else {
                return `${member.nickname} (${member.steamId})`;
              }
            })
            .join("\n") || "-";

        return {
          name: `${team.name} (${registeredPlayers}/${maxPlayersPerTeam})`,
          value: membersText,
          inline: true,
        };
      })
    );

    if (!updatedEmbed.data.fields || updatedEmbed.data.fields.length === 0) {
      console.error("❌ Поля в Embed отсутствуют!");
      return;
    }

    await eventMessage.edit({ embeds: [updatedEmbed] });
    console.log(`✅ Обновлен Embed для события ${event.eventId}`);
  } catch (error) {
    console.error(
      `Ошибка при обновлении Embed для события ${event.eventId}:`,
      error
    );
  }
};
