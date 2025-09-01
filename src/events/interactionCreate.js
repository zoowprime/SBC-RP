
const { Events, ButtonStyle, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const { getVehicleById, listVehicles } = require('../utils/db');
const { vehicleToEmbed } = require('../utils/embeds');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      // Route to command files is handled by your main bot loader
      return;
    }
    if (!interaction.isButton()) return;

    // Pagination cache
    const cache = interaction.client.sbcSearchCache;
    if (interaction.customId.startsWith('sbc_prev_') || interaction.customId.startsWith('sbc_next_')) {
      if (!cache || !cache.list) return interaction.reply({ content: 'Cache expiré. Relance la recherche.', ephemeral: true });
      let i = cache.index || 0;
      if (interaction.customId.startsWith('sbc_prev_')) i = (i - 1 + cache.list.length) % cache.list.length;
      else i = (i + 1) % cache.list.length;
      cache.index = i;
      const v = cache.list[i];
      const e = vehicleToEmbed(v);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`sbc_prev_${i}`).setLabel('◀️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`sbc_next_${i}`).setLabel('▶️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`sbc_buy_${v.id}`).setLabel('🛒 Acheter').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`sbc_details_${v.id}`).setLabel('🔎 Détails').setStyle(ButtonStyle.Primary),
      );
      return interaction.update({ embeds: [e], components: [row] });
    }

    // Details
    if (interaction.customId.startsWith('sbc_details_')) {
      const id = interaction.customId.replace('sbc_details_', '');
      const v = getVehicleById(id);
      if (!v) return interaction.reply({ content: 'Véhicule introuvable.', ephemeral: true });
      const e = vehicleToEmbed(v);
      return interaction.reply({ ephemeral: true, embeds: [e] });
    }

    // Buy (escrow simple simulation)
    if (interaction.customId.startsWith('sbc_buy_')) {
      const id = interaction.customId.replace('sbc_buy_', '');
      const v = getVehicleById(id);
      if (!v) return interaction.reply({ content: 'Véhicule introuvable.', ephemeral: true });
      if (v.stock <= 0) return interaction.reply({ content: 'Rupture de stock.', ephemeral: true });
      // Here you would integrate with your in-game money system.
      // For MVP, just decrement stock.
      v.stock -= 1;
      const { upsertVehicle } = require('../utils/db');
      upsertVehicle(v);
      return interaction.reply({ ephemeral: true, content: `✅ Achat réservé via escrow RP pour **${v.marque} ${v.modele}** (${v.id}). Un vendeur te contactera.` });
    }
  }
};
