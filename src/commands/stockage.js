const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { findOwnedById, setOwned, canAccess, totalStoredCount } = require('../utils/properties');
const { getUserInv, setUserInv } = require('../utils/inventory');
const { displayName } = require('../utils/items');

function catOf(it) {
  if (it.type === 'food') return 'Nourriture';
  if (it.type === 'water') return 'Eau';
  if (it.type === 'soda') return 'Soda';
  return 'Autres';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stockage')
    .setDescription('Stocker / retirer des items dans une propriété')
    .addSubcommand(sc => sc.setName('ouvrir').setDescription('Voir le contenu')
      .addStringOption(o=>o.setName('propriete_id').setDescription('ID propriété').setRequired(true)))
    .addSubcommand(sc => sc.setName('depot').setDescription('Déposer depuis inventaire → propriété')
      .addStringOption(o=>o.setName('propriete_id').setDescription('ID propriété').setRequired(true))
      .addStringOption(o=>o.setName('item').setDescription('Nom affiché de l\'item').setRequired(true))
      .addIntegerOption(o=>o.setName('quantite').setDescription('Quantité').setRequired(true)))
    .addSubcommand(sc => sc.setName('retrait').setDescription('Retirer depuis propriété → inventaire')
      .addStringOption(o=>o.setName('propriete_id').setDescription('ID propriété').setRequired(true))
      .addStringOption(o=>o.setName('item').setDescription('Nom affiché de l\'item').setRequired(true))
      .addIntegerOption(o=>o.setName('quantite').setDescription('Quantité').setRequired(true))),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (sub === 'ouvrir') {
      const id = interaction.options.getString('propriete_id');
      const p = findOwnedById(id);
      if (!p) return interaction.reply({ content: 'Propriété introuvable.', ephemeral: true });
      if (!canAccess(p, userId, 'view')) return interaction.reply({ content: '⛔ Accès refusé.', ephemeral: true });

      const e = new EmbedBuilder().setTitle(`Stockage — ${p.name} [${p.id}]`).setColor(0x2b2d31).setTimestamp();
      const byCat = {};
      for (const it of (p.storage.items||[])) {
        const c = catOf(it);
        byCat[c] = byCat
