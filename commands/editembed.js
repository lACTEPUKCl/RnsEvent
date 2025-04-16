import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";

const editEmbed = new SlashCommandBuilder()
  .setName("editembed")
  .setDescription("Редактировать ембед в канале по ID сообщения")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((opt) =>
    opt
      .setName("messageid")
      .setDescription("ID сообщения, которое нужно отредактировать")
      .setRequired(true)
  );

const execute = async (interaction) => {
  await interaction.reply({
    content: "Проверьте личные сообщения для ввода нового JSON.",
    flags: MessageFlags.Ephemeral,
  });

  const dm = await interaction.user.createDM();
  await dm.send(
    "Пришлите, пожалуйста, JSON с полями для обновления сообщения.\n" +
      'Например: `{"content":"Новый текст","embeds":[{"title":"Новый заголовок","description":"Описание"}]}`'
  );

  let jsonInput;
  try {
    const collected = await dm.awaitMessages({
      filter: (m) => m.author.id === interaction.user.id,
      max: 1,
      time: 300000,
      errors: ["time"],
    });
    jsonInput = collected.first().content;
  } catch {
    return dm.send("Время ожидания истекло. Попробуйте снова.");
  }

  let updateData;
  try {
    updateData = JSON.parse(jsonInput);
  } catch {
    return dm.send("Неверный JSON. Попробуйте ещё раз.");
  }

  const channel = interaction.guild.channels.cache.get(
    process.env.EVENT_CHANNELID
  );
  if (!channel) return dm.send("Канал для редактирования не найден.");

  const messageId = interaction.options.getString("messageid");
  let target;
  try {
    target = await channel.messages.fetch(messageId);
  } catch {
    return dm.send("Сообщение с таким ID не найдено.");
  }

  const payload = {};
  if (updateData.content !== undefined) payload.content = updateData.content;
  if (Array.isArray(updateData.embeds)) {
    payload.embeds = updateData.embeds.map((e) => EmbedBuilder.from(e));
  }

  try {
    await target.edit(payload);
    await dm.send("Сообщение успешно обновлено!");
  } catch (err) {
    console.error(err);
    await dm.send("Ошибка при редактировании сообщения.");
  }
};

export default { data: editEmbed, execute };
