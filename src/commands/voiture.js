
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { listVehicles } = require('../utils/db');
const { vehicleToEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('voiture')
    .setDescription('Achat & recherche de véhicules')
    .addSubcommand(sc => sc.setName('acheter')
      .setDescription('Chercher un véhicule')
      .addStringOption(o=>o.setName('marque').setDescription('Marque').setAutocomplete(true))
      .addStringOption(o=>o.setName('modele').setDescription('Modèle').setAutocomplete(true))
      .addStringOption(o=>o.setName('type').setDescription('catégorie: compacte, berline, pickup_suv, muscle, sport, sport_plus, supercar'))
      .addIntegerOption(o=>o.setName('budget_min').setDescription('Budget min'))
      .addIntegerOption(o=>o.setName('budget_max').setDescription('Budget max'))
      .addStringOption(o=>o.setName('mot').setDescription('Recherche texte'))
    )),
  async execute(interaction) {
    if (interaction.options.getSubcommand() !== 'acheter') return;
    await interaction.deferReply({ ephemeral: true });

    const filter = {
      marque: interaction.options.getString('marque') || undefined,
      modele: interaction.options.getString('modele') || undefined,
      categorie: interaction.options.getString('type') || undefined,
      budget_min: interaction.options.getInteger('budget_min'),
      budget_max: interaction.options.getInteger('budget_max'),
      mot: interaction.options.getString('mot') || undefined,
      disponible: true,
    };
    const list = listVehicles(filter).slice(0, 10);
    if (list.length === 0) {
      return interaction.editReply({ content: 'Aucun véhicule trouvé avec ces critères.' });
    }
    const e = vehicleToEmbed(list[0]);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`sbc_prev_0`).setLabel('◀️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`sbc_next_0`).setLabel('▶️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`sbc_buy_${list[0].id}`).setLabel('🛒 Acheter').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`sbc_details_${list[0].id}`).setLabel('🔎 Détails').setStyle(ButtonStyle.Primary),
    );
    await interaction.editReply({ content: `Résultats: ${list.length} trouvés`, embeds: [e], components: [row] });
    // Store in message for pagination (simple cache via interaction.client)
    interaction.client.sbcSearchCache = { list, index: 0 };
  }
};
