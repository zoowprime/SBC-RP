// src/commands/anonyme.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const BLACK = 0x000000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('anonyme')
    .setDescription('Publie un message anonyme dans ce salon.')
    .addStringOption(o =>
      o.setName('texte')
       .setDescription('Texte à publier anonymement')
       .setRequired(true)
       .setMaxLength(4000)
    )
    .setDMPermission(false),

  async execute(interaction) {
    const raw = interaction.options.getString('texte', true);

    // Neutralise @everyone / @here pour éviter les pings
    const safe = raw
      .replace(/@everyone/g, '@\u200beveryone')
      .replace(/@here/g, '@\u200bhere');

    const embed = new EmbedBuilder()
      .setColor(BLACK)
      .setTitle('🕶️ Message anonyme')
      .setDescription(`> *${safe}*`)
      .setFooter({ text: 'SBC RP • Anonyme' })
      .setTimestamp();

    // Publie anonymement dans le salon (aucune mention autorisée)
    await interaction.channel.send({
      embeds: [embed],
      allowedMentions: { parse: [] },
    }).catch(() => {});

    // Accusé privé pour ne pas révéler l’auteur publiquement
    return interaction.reply({ content: '✅ Envoyé anonymement.', ephemeral: true }).catch(() => {});
  }
};
