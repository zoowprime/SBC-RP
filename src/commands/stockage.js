// src/commands/stockage.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { findOwnedById } = require('../utils/properties');
const { listAccessibleProps } = require('../utils/props-access');
const { sendPropertyPicker } = require('../ui/pickers');

const COLOR = 0x57F287;

async function openStorage(interaction, pid, fromPicker = false) {
  const p = findOwnedById(pid);
  if (!p) {
    if (fromPicker) return interaction.update({ content:'Propriété introuvable.', components:[], embeds:[] });
    return interaction.reply({ content:'Propriété introuvable.' });
  }
  const items = (p.storage?.items || []);
  const inv = items.length ? items.map(i => `• **${i.name}** — ${i.qty}`).join('\n').slice(0, 4000) : '— Vide —';
  const e = new EmbedBuilder().setColor(COLOR).setTitle(`📦 Stockage — ${p.name}`).setDescription(inv);
  if (fromPicker) return interaction.update({ embeds:[e], components:[] });
  return interaction.reply({ embeds:[e] });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stockage')
    .setDescription('Ouvrir le stockage d’une propriété')
    .addSubcommand(sc => sc.setName('ouvrir')
      .setDescription('Voir le stockage d’une propriété accessible')
      .addStringOption(o => o.setName('propriete_id').setDescription('(facultatif) ID ou laisse vide pour menu'))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const uid = interaction.user.id;

    if (sub === 'ouvrir') {
      const pid = interaction.options.getString('propriete_id');
      if (!pid) {
        const props = listAccessibleProps(uid, null).map(p => ({ id:p.id, name:p.name, ptype:p.ptype||null }));
        return sendPropertyPicker(interaction, props, 'PROP_PICK:stockage_ouvrir', 'Choisis une propriété', true);
      }
      return openStorage(interaction, pid);
    }
  },

  // hook pour picker
  async openFromPicker(interaction, propId) { return openStorage(interaction, propId, true); }
};
