// src/commands/mute.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
require('dotenv').config({ path: './id.env' });

const RED = 0xE74C3C;
const { STAFF_ROLE_ID } = process.env;

// Table des durées (valeur → ms)
const DURATIONS = {
  '5m':   5 * 60 * 1000,
  '10m': 10 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '20m': 20 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '45m': 45 * 60 * 1000,
  '1h':  60 * 60 * 1000,
  '2h':  2  * 60 * 60 * 1000,
  '3h':  3  * 60 * 60 * 1000,
  '4h':  4  * 60 * 60 * 1000,
  '5h':  5  * 60 * 60 * 1000,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('STAFF: mute (timeout) un joueur sur tout le serveur.')
    .addUserOption(o => o.setName('target').setDescription('Joueur à mute').setRequired(true))
    .addStringOption(o =>
      o.setName('temps')
       .setDescription('Durée du mute')
       .setRequired(true)
       .addChoices(
         { name: '5 minutes',  value: '5m'  },
         { name: '10 minutes', value: '10m' },
         { name: '15 minutes', value: '15m' },
         { name: '20 minutes', value: '20m' },
         { name: '30 minutes', value: '30m' },
         { name: '45 minutes', value: '45m' },
         { name: '1 heure',    value: '1h'  },
         { name: '2 heures',   value: '2h'  },
         { name: '3 heures',   value: '3h'  },
         { name: '4 heures',   value: '4h'  },
         { name: '5 heures',   value: '5h'  },
       )
    )
    .addStringOption(o => o.setName('raison').setDescription('Raison du mute').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers) // nécessite la perm côté staff
    .setDMPermission(false),

  async execute(interaction) {
    if (!interaction.member?.roles?.cache?.has(STAFF_ROLE_ID)) {
      return interaction.reply({ content: '❌ Réservé au staff.' });
    }

    const target = interaction.options.getUser('target', true);
    const key    = interaction.options.getString('temps', true);
    const reason = (interaction.options.getString('raison') || 'Aucune raison fournie')
      .replace(/@everyone/g, '@\u200beveryone')
      .replace(/@here/g, '@\u200bhere');

    const ms = DURATIONS[key];
    if (!ms) return interaction.reply({ content: '❌ Durée invalide.' });

    try {
      const guild = interaction.guild;
      const member = await guild.members.fetch(target.id);

      // Sécurité hiérarchie
      const me = await guild.members.fetchMe();
      if (member.id === me.id) return interaction.reply({ content: '❌ Je ne peux pas me mute moi-même.' });
      if (member.roles.highest.comparePositionTo(me.roles.highest) >= 0) {
        return interaction.reply({ content: '❌ Je ne peux pas mute ce membre (rôle trop élevé).' });
      }

      await member.timeout(ms, `Mute par ${interaction.user.tag} • ${reason}`);

      const embed = new EmbedBuilder()
        .setColor(RED)
        .setTitle(`🔇 ${target.tag} a été mute`)
        .addFields(
          { name: 'Raison', value: reason },
          { name: 'Temps',  value: labelFromKey(key) },
        )
        .setThumbnail(target.displayAvatarURL({ extension: 'png', size: 128 }))
        .setFooter({ text: 'SBC Modération • /mute' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
    } catch (e) {
      console.error('mute error:', e);
      return interaction.reply({ content: '❌ Impossible de mute ce joueur (permissions/hiérarchie ?).' });
    }
  }
};

function labelFromKey(k) {
  return {
    '5m': '5 minutes', '10m': '10 minutes', '15m': '15 minutes',
    '20m': '20 minutes', '30m': '30 minutes', '45m': '45 minutes',
    '1h': '1 heure', '2h': '2 heures', '3h': '3 heures', '4h': '4 heures', '5h': '5 heures'
  }[k] || k;
}
