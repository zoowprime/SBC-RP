// src/commands/actionrp.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Violet SBC
const VIOLET = 0x9B59B6;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('action')
    .setDescription('Publie une action RP dans un bel embed violet.')
    .addStringOption(o =>
      o.setName('texte')
       .setDescription("Décris ton action RP")
       .setRequired(true)
       .setMaxLength(4000) // sécurité description d’embed
    )
    .setDMPermission(false),

  async execute(interaction) {
    const user = interaction.user;
    const raw  = interaction.options.getString('texte', true);

    // Anti-spam des mass mentions sans casser le texte
    const safe = raw
      .replace(/@everyone/g, '@\u200beveryone')
      .replace(/@here/g, '@\u200bhere');

    // Petite mise en forme RP ✍️
    const pretty = `> *${safe}*`;

    const embed = new EmbedBuilder()
      .setColor(VIOLET)
      .setTitle(`🎭 Action RP de (${user})`)
      .setDescription(pretty)
      .setThumbnail(user.displayAvatarURL({ extension: 'png', size: 128 }))
      .setFooter({ text: 'SBC RP • /action' })
      .setTimestamp();

    // Public (pas d’éphémère)
    return interaction.reply({
      embeds: [embed],
      allowedMentions: { parse: ['users'] }, // pas de ping @everyone/@here
    });
  }
};
