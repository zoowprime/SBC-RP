// src/commands/x.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
require('dotenv').config({ path: './id.env' });
const { createPost, postLink } = require('../social');

const X_BLACK = 0x000000;
const { X_FEED_CHANNEL } = process.env;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('x')
    .setDescription('Publier sur X RP')
    .addSubcommand(sc =>
      sc.setName('poster')
        .setDescription('Publie un post X (image optionnelle)')
        .addStringOption(o => o.setName('texte').setDescription('Contenu / Hashtags #rp').setRequired(true))
        .addAttachmentOption(o => o.setName('image').setDescription('Image (optionnel)').setRequired(false))
    )
    .setDMPermission(false),

  async execute(interaction) {
    const caption = interaction.options.getString('texte', true);
    const att = interaction.options.getAttachment('image');
    const feedCh = X_FEED_CHANNEL
      ? await interaction.client.channels.fetch(X_FEED_CHANNEL).catch(() => null)
      : interaction.channel;

    if (!feedCh?.isTextBased()) {
      return interaction.reply({ content: '❌ Salon de feed X introuvable.' });
    }

    const embed = new EmbedBuilder()
      .setColor(X_BLACK)
      .setTitle(`𝕏 Post — @${interaction.user.username}`)
      .setDescription(caption)
      .setFooter({ text: 'SBC Social • X' })
      .setTimestamp();

    if (att?.contentType?.startsWith('image/') || (att?.url && /\.(png|jpe?g|gif|webp)$/i.test(att.url))) {
      embed.setImage(att.url);
    }

    const msg = await feedCh.send({ embeds: [embed], allowedMentions: { parse: [] } });
    try { await msg.react('❤️'); await msg.react('🔁'); } catch {}

    createPost({
      guildId: interaction.guildId,
      messageId: msg.id,
      channelId: msg.channelId,
      platform: 'x',
      authorId: interaction.user.id,
      caption,
      imageURL: att?.url || null,
    });

    return interaction.reply({ content: `✅ Post X publié : ${postLink(interaction.guildId, msg.channelId, msg.id)}` });
  }
};
