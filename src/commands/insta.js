// src/commands/insta.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
require('dotenv').config({ path: './id.env' });
const { createPost, postLink } = require('../social');

const INSTA_PINK = 0xE1306C;
const { INSTAGRAM_FEED_CHANNEL } = process.env;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('insta')
    .setDescription('Publier sur Insta RP')
    .addSubcommand(sc =>
      sc.setName('poster')
        .setDescription('Publie un post Insta (image optionnelle)')
        .addStringOption(o => o.setName('texte').setDescription('Légende / Hashtags #rp').setRequired(true))
        .addAttachmentOption(o => o.setName('image').setDescription('Image (optionnel)').setRequired(false))
    )
    .setDMPermission(false),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub !== 'poster') return;

    const caption = interaction.options.getString('texte', true);
    const att = interaction.options.getAttachment('image');
    const feedCh = INSTAGRAM_FEED_CHANNEL
      ? await interaction.client.channels.fetch(INSTAGRAM_FEED_CHANNEL).catch(() => null)
      : interaction.channel;

    if (!feedCh?.isTextBased()) {
      return interaction.reply({ content: '❌ Salon de feed Instagram introuvable.' });
    }

    const embed = new EmbedBuilder()
      .setColor(INSTA_PINK)
      .setTitle(`📸 Insta — @${interaction.user.username}`)
      .setDescription(caption)
      .setFooter({ text: 'SBC Social • Instagram' })
      .setTimestamp();

    if (att?.contentType?.startsWith('image/') || (att?.url && /\.(png|jpe?g|gif|webp)$/i.test(att.url))) {
      embed.setImage(att.url);
    }

    const msg = await feedCh.send({
      embeds: [embed],
      allowedMentions: { parse: [] },
    });

    // ❤️ auto + thread commentaires
    try { await msg.react('❤️'); } catch {}
    try { await msg.startThread({ name: `💬 Commentaires de @${interaction.user.username}`, autoArchiveDuration: 1440 }); } catch {}

    // Persistance
    createPost({
      guildId: interaction.guildId,
      messageId: msg.id,
      channelId: msg.channelId,
      platform: 'insta',
      authorId: interaction.user.id,
      caption,
      imageURL: att?.url || null,
    });

    return interaction.reply({
      content: `✅ Post Instagram publié : ${postLink(interaction.guildId, msg.channelId, msg.id)}`,
    });
  }
};
