// src/commands/warn.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
require('dotenv').config({ path: './id.env' });

const RED = 0xE74C3C;
const { STAFF_ROLE_ID } = process.env;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('STAFF: ajouter un avertissement (niveau 1, 2 ou 3)')
    .addUserOption(o => o.setName('target').setDescription('Joueur à warn').setRequired(true))
    .addIntegerOption(o =>
      o.setName('level')
       .setDescription('Niveau de warn')
       .addChoices(
         { name: 'Niveau 1', value: 1 },
         { name: 'Niveau 2', value: 2 },
         { name: 'Niveau 3', value: 3 },
       )
       .setRequired(true)
    )
    .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(true))
    .setDMPermission(false),

  async execute(interaction) {
    if (!interaction.member?.roles?.cache?.has(STAFF_ROLE_ID)) {
      return interaction.reply({ content: '❌ Réservé au staff.' });
    }

    const target = interaction.options.getUser('target', true);
    const level  = interaction.options.getInteger('level', true);
    const raison = interaction.options.getString('raison', true)
      .replace(/@everyone/g, '@\u200beveryone')
      .replace(/@here/g, '@\u200bhere');

    const emoji = level === 3 ? '⛔' : level === 2 ? '⚠️' : '❗';

    const embed = new EmbedBuilder()
      .setColor(RED)
      .setTitle(`${emoji} ${target.tag} a été warn`)
      .addFields(
        { name: 'Niveau', value: `**${level}**`, inline: true },
        { name: 'Raison', value: raison, inline: false },
      )
      .setThumbnail(target.displayAvatarURL({ extension: 'png', size: 128 }))
      .setFooter({ text: 'SBC Modération • /warn' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
  }
};
