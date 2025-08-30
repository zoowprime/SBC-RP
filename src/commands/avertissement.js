// src/commands/avertissement.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
require('dotenv').config({ path: './id.env' });

const RED = 0xE74C3C;
const { STAFF_ROLE_ID } = process.env;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avertissement')
    .setDescription('STAFF: envoyer un avertissement à un joueur.')
    .addUserOption(o => o.setName('target').setDescription('Joueur visé').setRequired(true))
    .addStringOption(o => o.setName('commentaire').setDescription('Commentaire de l’avertissement').setRequired(true))
    .setDMPermission(false),

  async execute(interaction) {
    // Vérif staff
    if (!interaction.member?.roles?.cache?.has(STAFF_ROLE_ID)) {
      return interaction.reply({ content: '❌ Réservé au staff.' });
    }

    const target = interaction.options.getUser('target', true);
    const commentaire = interaction.options.getString('commentaire', true)
      .replace(/@everyone/g, '@\u200beveryone')
      .replace(/@here/g, '@\u200bhere');

    const embed = new EmbedBuilder()
      .setColor(RED)
      .setTitle(`🚨 Avertissement pour ${target.tag}`)
      .addFields({ name: 'Commentaire', value: commentaire })
      .setThumbnail(target.displayAvatarURL({ extension: 'png', size: 128 }))
      .setFooter({ text: 'SBC Modération • /avertissement' })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      allowedMentions: { parse: ['users'] },
    });
  }
};
