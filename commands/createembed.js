import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import { config } from "dotenv";
config();

const LOGO_URL =
  "https://cdn.discordapp.com/attachments/1179711462197968896/1271584403826540705/0000.png?ex=67fe2a02&is=67fcd882&hm=d22041b1dea474ccb3d0c877a3305fc41618b9ee0f0e370626022fcef7ef4c61&";

const createembed = new SlashCommandBuilder()
  .setName("createembed")
  .setDescription("Создать ембед с информацией об ивенте (через JSON)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const execute = async (interaction) => {
  await interaction.reply({
    content: "Проверьте личные сообщения для настройки ембеда.",
    flags: MessageFlags.Ephemeral,
  });
  const dmChannel = await interaction.user.createDM();

  await dmChannel.send("Пришлите, пожалуйста, JSON описания ембеда");

  let jsonInput;
  try {
    const collectedJSON = await dmChannel.awaitMessages({
      filter: (msg) => msg.author.id === interaction.user.id,
      max: 1,
      time: 300000,
      errors: ["time"],
    });
    jsonInput = collectedJSON.first().content;
  } catch (err) {
    return dmChannel.send("Время ожидания истекло. Попробуйте снова.");
  }

  let embedData;
  try {
    embedData = JSON.parse(jsonInput);
    if (!embedData.embeds || !Array.isArray(embedData.embeds)) {
      throw new Error("Неверный формат: отсутствует массив embeds.");
    }
  } catch (e) {
    return dmChannel.send(
      "Ошибка при разборе JSON. Проверьте формат и попробуйте снова."
    );
  }

  await dmChannel.send(
    "Добавить изображение после ембеда? (напишите `да` или `нет`)"
  );
  let addImage;
  try {
    const collectedAnswer = await dmChannel.awaitMessages({
      filter: (msg) => msg.author.id === interaction.user.id,
      max: 1,
      time: 300000,
      errors: ["time"],
    });
    addImage = collectedAnswer.first().content.trim().toLowerCase();
  } catch (err) {
    return dmChannel.send("Время ожидания истекло. Попробуйте снова.");
  }

  let imageUrl = null;
  if (addImage === "да" || addImage === "yes") {
    await dmChannel.send(
      "Пришлите ссылку на изображение или загрузите файл. Если хотите отказаться, напишите `нет`."
    );
    try {
      const collectedImage = await dmChannel.awaitMessages({
        filter: (msg) => msg.author.id === interaction.user.id,
        max: 1,
        time: 300000,
        errors: ["time"],
      });
      const msg = collectedImage.first();
      if (msg.attachments.size > 0) {
        imageUrl = msg.attachments.first().url;
      } else {
        const text = msg.content.trim();
        if (text.toLowerCase() !== "нет") {
          imageUrl = text;
        }
      }
    } catch (err) {
      return dmChannel.send(
        "Время ожидания истекло. Продолжаем без дополнительного изображения."
      );
    }
  }

  if (embedData.embeds.length > 0) {
    embedData.embeds[0].thumbnail = { url: LOGO_URL };
  }

  const guild = interaction.guild;
  const eventChannel = guild.channels.cache.get(process.env.EVENT_CHANNELID);
  if (!eventChannel) {
    return dmChannel.send("Ошибка: канал для публикации сообщения не найден.");
  }

  if (imageUrl) {
    await eventChannel.send({
      content: embedData.content || "",
      files: [imageUrl],
    });
  }

  try {
    const sentMessage = await eventChannel.send({
      embeds: embedData.embeds.map((em) => EmbedBuilder.from(em)),
      username: embedData.username,
      avatarURL: embedData.avatar_url,
    });

    await dmChannel.send("Сообщение с ембедом опубликовано!");
    console.log("Пост с ембедом создан:", sentMessage.id);
  } catch (error) {
    console.error("Ошибка при публикации ембеда:", error);
    await dmChannel.send("Произошла ошибка при публикации сообщения.");
  }
};

export default { data: createembed, execute };
