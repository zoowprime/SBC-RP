
const { SlashCommandBuilder } = require('discord.js');
const { nextVehicleId, upsertVehicle } = require('../utils/db');
const { hasSellerPerm } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vendre')
    .setDescription('Gestion des annonces concession')
    .addSubcommand(sc => sc.setName('publier')
      .setDescription('Publier une nouvelle annonce')
      .addStringOption(o=>o.setName('marque').setDescription('Marque').setRequired(true))
      .addStringOption(o=>o.setName('modele').setDescription('Modèle').setRequired(true))
      .addStringOption(o=>o.setName('categorie').setDescription('compacte|berline|pickup_suv|muscle|sport|sport_plus|supercar|moto_*|luxe_special').setRequired(true))
      .addStringOption(o=>o.setName('etat').setDescription('neuf|occasion').setRequired(true))
      .addIntegerOption(o=>o.setName('prix').setDescription('Prix unitaire').setRequired(true))
      .addIntegerOption(o=>o.setName('stock').setDescription('Stock').setRequired(true))
      .addStringOption(o=>o.setName('couleurs').setDescription('Couleurs dispo, séparées par des virgules'))
      .addStringOption(o=>o.setName('image').setDescription('URL image'))
      .addStringOption(o=>o.setName('tags').setDescription('tags séparés par des virgules'))
    ),
  async execute(interaction) {
    if (interaction.options.getSubcommand() !== 'publier') return;
    if (!hasSellerPerm(interaction.member)) return interaction.reply({ content: '⛔ Tu n’as pas les droits vendeur.', ephemeral: true });

    const v = {
      id: nextVehicleId(),
      marque: interaction.options.getString('marque'),
      modele: interaction.options.getString('modele'),
      categorie: interaction.options.getString('categorie'),
      etat: interaction.options.getString('etat'),
      prix: interaction.options.getInteger('prix'),
      stock: interaction.options.getInteger('stock'),
      couleurs: (interaction.options.getString('couleurs')||'').split(',').map(s=>s.trim()).filter(Boolean),
      images: interaction.options.getString('image') ? [interaction.options.getString('image')] : [],
      tags: (interaction.options.getString('tags')||'').split(',').map(s=>s.trim()).filter(Boolean),
      perfs: {},
      vendeur_role: interaction.member.roles.highest?.id || null,
      date_publication: new Date().toISOString(),
    };
    upsertVehicle(v);
    await interaction.reply({ content: `✅ Annonce publiée: **${v.id}** (${v.marque} ${v.modele})`, ephemeral: true });
  }
};
