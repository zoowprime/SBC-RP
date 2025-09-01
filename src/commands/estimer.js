
const { SlashCommandBuilder } = require('discord.js');
const { estimatePrice } = require('../utils/price');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('estimer')
    .setDescription('Estimation prix RP interne (staff/concess)')
    .addStringOption(o=>o.setName('modele_ou_categorie').setDescription('Ex: "Bravado Buffalo STX" ou "muscle"').setRequired(true))
    .addStringOption(o=>o.setName('etat').setDescription('neuf|occasion'))
    .addStringOption(o=>o.setName('rarete').setDescription('standard|collector'))
    .addBooleanOption(o=>o.setName('promo').setDescription('Appliquer une promo de -10%')),
  async execute(interaction) {
    const moc = interaction.options.getString('modele_ou_categorie');
    const etat = interaction.options.getString('etat') || 'neuf';
    const rarete = interaction.options.getString('rarete') || 'standard';
    const promo = interaction.options.getBoolean('promo') || false;
    const res = estimatePrice(moc, { etat, rarete, promo });
    await interaction.reply({ ephemeral: true, content: `📊 Catégorie: **${res.category}**\nFourchette: **${res.min.toLocaleString()}–${res.max.toLocaleString()} $**\nPrix conseillé: **${res.price.toLocaleString()} $**` });
  }
};
