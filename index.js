import {
  Client,
  GatewayIntentBits,
  Collection,
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags,
} from "discord.js";
import getCommands from "./commands/getCommands.js";
import { getCollection } from "./utils/mongodb.js";
import { config } from "dotenv";
import { updateEventEmbed } from "./utils/updateEventEmbed.js";
import getSteamId64 from "./utils/getSteamID64.js";
config();

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.on("error", (error) => {
  console.error("Client error:", error);
});

client.commands = new Collection();
const commands = await getCommands();
for (const command of commands) {
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log("Команда не содержит 'data' или 'execute' свойства.");
  }
}

client.on("ready", () => {
  console.log(`Вошёл как ${client.user.tag}!`);
});

const messages = {
  errorExecuting: "Произошла ошибка при выполнении команды.",
  eventNotExist: "Это событие больше не существует.",
  alreadyRegistered: "Вы уже зарегистрированы в команде.",
  selectTeam: "Выберите команду для регистрации:",
  registrationSuccess: (teamName) =>
    `Вы успешно зарегистрированы в ${
      teamName === "substitutes" ? "списке запасных" : `команде ${teamName}`
    }.`,
  registrationCancelled: "Ваша регистрация была успешно отменена.",
  notRegistered:
    "Вы не зарегистрированы ни в одной команде и не находитесь в списке запасных.",
  eventNotFound: "Событие не найдено.",
};

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(error);
        await interaction.reply({
          content: messages.errorExecuting,
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    } else if (interaction.isButton()) {
      if (interaction.customId.startsWith("register_default_")) {
        const eventId = interaction.message.id;
        const eventsCollection = await getCollection("events");
        const currentEvent = await eventsCollection.findOne({ eventId });
        if (!currentEvent)
          return interaction.reply({
            content: messages.eventNotExist,
            flags: MessageFlags.Ephemeral,
          });
        const userId = interaction.user.id;
        const alreadyRegistered =
          currentEvent.teams.some((team) =>
            team.members.some((member) => member.userId === userId)
          ) ||
          (currentEvent.substitutes &&
            currentEvent.substitutes.some((sub) => sub.userId === userId));
        if (alreadyRegistered)
          return interaction.reply({
            content: messages.alreadyRegistered,
            flags: MessageFlags.Ephemeral,
          });
        const filteredTeams = currentEvent.teams.filter(
          (team) => team.members.length < currentEvent.maxPlayersPerTeam
        );
        if (filteredTeams.length === 0)
          return interaction.reply({
            content:
              "Все команды уже заполнены! Вы можете зарегистрироваться в запасные (скамья запасных).",
            flags: MessageFlags.Ephemeral,
          });
        const teamOptions = filteredTeams.map((team) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(
              `${team.name} (${team.members.length}/${currentEvent.maxPlayersPerTeam})`
            )
            .setValue(team.name)
        );
        teamOptions.push(
          new StringSelectMenuOptionBuilder()
            .setLabel("Скамья запасных")
            .setValue("substitutes")
        );
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`team_select_menu_${eventId}`)
          .setPlaceholder("Выберите команду")
          .addOptions(teamOptions);
        const row = new ActionRowBuilder().addComponents(selectMenu);
        await interaction.reply({
          content: messages.selectTeam,
          components: [row],
          flags: MessageFlags.Ephemeral,
        });
      } else if (interaction.customId.startsWith("cancel_default_")) {
        const eventsCollection = await getCollection("events");
        const eventId = interaction.message.id;
        const currentEvent = await eventsCollection.findOne({ eventId });
        if (!currentEvent)
          return interaction.reply({
            content: messages.eventNotExist,
            flags: MessageFlags.Ephemeral,
          });
        const userId = interaction.user.id;
        let removed = false;
        currentEvent.teams.forEach((team) => {
          const index = team.members.findIndex(
            (member) => member.userId === userId
          );
          if (index !== -1) {
            team.members.splice(index, 1);
            removed = true;
          }
        });
        if (currentEvent.substitutes) {
          const subIndex = currentEvent.substitutes.findIndex(
            (sub) => sub.userId === userId
          );
          if (subIndex !== -1) {
            currentEvent.substitutes.splice(subIndex, 1);
            removed = true;
          }
        }
        if (!removed)
          return interaction.reply({
            content: messages.notRegistered,
            flags: MessageFlags.Ephemeral,
          });
        await eventsCollection.updateOne(
          { eventId: currentEvent.eventId },
          {
            $set: {
              teams: currentEvent.teams,
              substitutes: currentEvent.substitutes,
            },
          }
        );
        await updateEventEmbed(client, currentEvent);

        if (interaction.guild) {
          try {
            const member = await interaction.guild.members.fetch(
              interaction.user.id
            );
            if (member) {
              await member.roles.remove(process.env.EVENTROLEID);
              console.log(`Роль удалена у пользователя ${interaction.user.id}`);
            }
          } catch (err) {
            console.error("Ошибка при удалении роли:", err);
          }
        }

        return interaction.reply({
          content: messages.registrationCancelled,
          flags: MessageFlags.Ephemeral,
        });
      }
    } else if (
      interaction.isStringSelectMenu() &&
      interaction.customId.startsWith("team_select_menu_")
    ) {
      const parts = interaction.customId.split("_");
      const eventId = parts.slice(3).join("_");
      const selectedTeam = interaction.values[0];
      const eventsCollection = await getCollection("events");
      const currentEvent = await eventsCollection.findOne({ eventId });
      if (!currentEvent)
        return interaction.reply({
          content: messages.eventNotFound,
          flags: MessageFlags.Ephemeral,
        });
      const userId = interaction.user.id;
      const alreadyRegistered =
        currentEvent.teams.some((team) =>
          team.members.some((member) => member.userId === userId)
        ) ||
        (currentEvent.substitutes &&
          currentEvent.substitutes.some((sub) => sub.userId === userId));
      if (alreadyRegistered)
        return interaction.reply({
          content: messages.alreadyRegistered,
          flags: MessageFlags.Ephemeral,
        });
      if (selectedTeam !== "substitutes") {
        const teamIndex = currentEvent.teams.findIndex(
          (team) => team.name === selectedTeam
        );
        if (teamIndex === -1)
          return interaction.reply({
            content: "Команда не найдена, попробуйте снова.",
            flags: MessageFlags.Ephemeral,
          });
        if (
          currentEvent.teams[teamIndex].members.length >=
          currentEvent.maxPlayersPerTeam
        )
          return interaction.reply({
            content: `Команда ${selectedTeam} уже заполнена! Выберите другую команду или запасные.`,
            flags: MessageFlags.Ephemeral,
          });
      }
      const modal = new ModalBuilder()
        .setCustomId(`register_modal_${selectedTeam}_${eventId}`)
        .setTitle("Регистрация на ивент");
      const steamIdInput = new TextInputBuilder()
        .setCustomId("steamid_input")
        .setLabel("Введите ваш Steam ID или ссылку на профиль")
        .setPlaceholder("Например: 76561198000000000 или ссылка")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      const squadLeaderInput = new TextInputBuilder()
        .setCustomId("squad_leader_input")
        .setLabel("Хотите ли вы быть сквад-лидером? (Да/Нет)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      const techSquadInput = new TextInputBuilder()
        .setCustomId("tech_squad_input")
        .setLabel("Хотите ли вы быть в отряде 'Тех'? (Да/Нет)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      const squadPilotInput = new TextInputBuilder()
        .setCustomId("pilot_squad_input")
        .setLabel("Хотите ли вы быть пилотом? (Да/Нет)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      const squadHoursInput = new TextInputBuilder()
        .setCustomId("squad_hours_input")
        .setLabel("Сколько часов вы провели в Squad?")
        .setPlaceholder("Например: 5")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      modal.addComponents(
        new ActionRowBuilder().addComponents(steamIdInput),
        new ActionRowBuilder().addComponents(squadLeaderInput),
        new ActionRowBuilder().addComponents(techSquadInput),
        new ActionRowBuilder().addComponents(squadPilotInput),
        new ActionRowBuilder().addComponents(squadHoursInput)
      );
      await interaction.showModal(modal);
    } else if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("register_modal_")
    ) {
      const parts = interaction.customId.split("_");
      const selectedTeam = parts[2];
      const eventId = parts.slice(3).join("_");
      const eventsCollection = await getCollection("events");
      const currentEvent = await eventsCollection.findOne({ eventId });
      if (!currentEvent)
        return interaction.reply({
          content: messages.eventNotFound,
          flags: MessageFlags.Ephemeral,
        });
      const userId = interaction.user.id;
      if (selectedTeam !== "substitutes") {
        const teamIndex = currentEvent.teams.findIndex(
          (team) => team.name === selectedTeam
        );
        if (teamIndex === -1)
          return interaction.reply({
            content: "Команда не найдена, попробуйте ещё раз.",
            flags: MessageFlags.Ephemeral,
          });
        if (
          currentEvent.teams[teamIndex].members.length >=
          currentEvent.maxPlayersPerTeam
        )
          return interaction.reply({
            content: `Команда ${selectedTeam} уже заполнена! Попробуйте выбрать другую команду.`,
            flags: MessageFlags.Ephemeral,
          });
      }
      const steamApiKey = process.env.STEAM_API_KEY;
      const steamIdRaw = interaction.fields.getTextInputValue("steamid_input");
      const userFromSteam = await getSteamId64(steamApiKey, steamIdRaw);
      const steamId = userFromSteam.steamId;

      if (!steamId)
        return interaction.reply({
          content: messages.errorExecuting + " Неверный Steam ID.",
          flags: MessageFlags.Ephemeral,
        });
      let nickname;
      try {
        const playerResponse = await fetch(
          `http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${steamApiKey}&steamids=${steamId}`
        );
        const playerData = await playerResponse.json();
        if (
          playerData.response &&
          playerData.response.players &&
          playerData.response.players.length
        ) {
          nickname = playerData.response.players[0].personaname;
        } else {
          return interaction.reply({
            content: "Steam пользователь не найден, попробуйте ещё раз.",
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch (error) {
        console.error("Ошибка при запросе к Steam API:", error);
        return interaction.reply({
          content: "Ошибка при запросе к Steam API, попробуйте ещё раз.",
          flags: MessageFlags.Ephemeral,
        });
      }
      const squadLeader =
        interaction.fields.getTextInputValue("squad_leader_input");
      const techSquad =
        interaction.fields.getTextInputValue("tech_squad_input");
      const pilotSquad =
        interaction.fields.getTextInputValue("pilot_squad_input");
      let squadHoursRaw =
        interaction.fields.getTextInputValue("squad_hours_input");
      let squadHours = squadHoursRaw.replace(/\D/g, "");
      if (squadHours.length > 5) {
        squadHours = squadHours.substring(0, 5) + "...";
      }
      const numberPlayers = 1;

      if (userFromSteam.squadHours) {
        squadHours = parseInt(userFromSteam.squadHours, 10);
      }

      if (selectedTeam === "substitutes") {
        if (!currentEvent.substitutes) currentEvent.substitutes = [];
        currentEvent.substitutes.push({
          userId,
          nickname,
          steamId,
          squadLeader,
          techSquad,
          pilotSquad,
          squadHours,
          numberPlayers,
        });
      } else {
        const teamIndex = currentEvent.teams.findIndex(
          (team) => team.name === selectedTeam
        );
        currentEvent.teams[teamIndex].members.push({
          userId,
          nickname,
          steamId,
          squadLeader,
          techSquad,
          pilotSquad,
          squadHours,
          numberPlayers,
        });
      }
      await eventsCollection.updateOne(
        { eventId: currentEvent.eventId },
        {
          $set: {
            teams: currentEvent.teams,
            substitutes: currentEvent.substitutes,
          },
        }
      );
      await updateEventEmbed(client, currentEvent);
      if (interaction.guild) {
        try {
          const member = await interaction.guild.members.fetch(userId);
          if (member) {
            await member.roles.add(process.env.EVENTROLEID);
            console.log(`Роль выдана пользователю ${userId}`);
          }
        } catch (err) {
          console.error("Ошибка при выдаче роли:", err);
        }
      }

      return interaction.reply({
        content: messages.registrationSuccess(selectedTeam),
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error) {
    console.error("Ошибка при обработке взаимодействия:", error);
    try {
      await interaction.reply({
        content: messages.errorExecuting,
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      console.error("Ошибка при отправке ответа:", err);
    }
  }
});

await client.login(process.env.CLIENT_TOKEN);
