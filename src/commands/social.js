// src/commands/social.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
require('dotenv').config({ path: './id.env' });

const { STAFF_ROLE_ID } = process.env;
const { listUserPosts, trendingHashtags, getPost, deletePost, postLink } = require('../social');

const VIOLET = 0x9B59B6;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('social')
    .setDescription('Outils réseaux sociaux RP')

    .addSubcommand(sc =>
      sc.setName('profile')
        .setDescription('Affiche les derniers posts d’un utilisateur.')
        .addUserOption(o => o.setName('user').setDescription('Utilisateur').setRequired(false))
    )

    .addSubcommand(sc =>
      sc.setName('trending')
        .setDescription('Top hashtags récents.')
        .addIntegerOption(o => o.setName('jours').setDescription('Fenêtre en jours (1-30)').setMinValue(1).setMaxValue(30).setRequired(false))
    )

    .addSubcommand(sc =>
      sc.setName('supprimer-post')
        .setDescription('STAFF: Supprime un post par lien/ID de message.')
        .addStringOption(o => o.setName('message').setDescription('Lien ou ID du message').setRequired(true))
    )
    .setDMPermission(false),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'profile') {
      const user = interaction.options.getUser('user') || interaction.user;
      const posts = listUserPosts(guildId, user.id, 5);

      const lines = posts.map(p => {
        const icon = p.platform === 'insta' ? '📸' : '𝕏';
        return `${icon} ${new Date(p.createdAt).toLocaleString('fr-FR')} — ${postLink(guildId, p.channelId, p.messageId)}\n` +
               (p.hashtags.length ? `• ${p.hashtags.join(' ')}` : '• (sans hashtag)');
      });
      const desc = lines.length ? lines.join('\n\n') : '*Aucun post pour le moment.*';

      const embed = new EmbedBuilder()
        .setColor(VIOLET)
        .setTitle(`🪪 Profil social — ${user.tag}`)
        .setThumbnail(user.displayAvatarURL({ extension: 'png', size: 128 }))
        .setDescription(desc)
        .setFooter({ text: 'SBC Social' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'trending') {
      const days = interaction.options.getInteger('jours') || 7;
      const tags = trendingHashtags(guildId, days);
      const text = tags.length
        ? tags.map(([h, n], i) => `**${i+1}.** ${h} — ${n}`).join('\n')
        : '*Aucun hashtag récent.*';

      const embed = new EmbedBuilder()
        .setColor(VIOLET)
        .setTitle(`📈 Trending — ${days} jour(s)`)
        .setDescription(text)
        .setFooter({ text: 'SBC Social' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'supprimer-post') {
      if (!interaction.member?.roles?.cache?.has(STAFF_ROLE_ID)) {
        return interaction.reply({ content: '❌ Réservé au staff.' });
      }
      let ref = interaction.options.getString('message', true).trim();
      // extraire un ID si on reçoit une URL
      const match = ref.match(/\/channels\/\d+\/(\d+)\/(\d+)/);
      let channelId = null, messageId = null;
      if (match) {
        channelId = match[1]; messageId = match[2];
      } else if (/^\d{16,20}$/.test(ref)) {
        // si juste l’ID du message → on essaiera de supprimer dans le salon courant
        messageId = ref; channelId = interaction.channelId;
      } else {
        return interaction.reply({ content: '❌ Fournis un **lien** de message ou un **ID** valide.' });
      }

      try {
        const ch = await interaction.client.channels.fetch(channelId);
        const msg = await ch.messages.fetch(messageId);
        await msg.delete().catch(() => {});
      } catch {}

      // supprimer des données
      deletePost(guildId, messageId);

      return interaction.reply({ content: '🗑️ Post supprimé et déréférencé.' });
    }
  },
};
