const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const {
  listByCategory, getUserInv, setUserInv,
  addWeapon, removeWeapon, addVehicle, removeVehicle
} = require('../utils/inventory');
const { displayName } = require('../utils/items');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventaire')
    .setDescription('Inventaire SBC (voitures, armes, permis, argent, items, drogues)')
    // Afficher
    .addSubcommand(sc => sc.setName('voir').setDescription('Affiche ton inventaire complet'))
    // Donner (items & drogues seulement)
    .addSubcommand(sc => sc.setName('donner')
      .setDescription('Donner un item (Nourriture/Eau/Soda/Drogue) à un joueur')
      .addUserOption(o=>o.setName('cible').setDescription('Joueur cible').setRequired(true))
      .addStringOption(o=>o.setName('categorie').setDescription('Nourriture|Eau|Soda|Drogues').setRequired(true))
      .addStringOption(o=>o.setName('item').setDescription('Nom affiché').setRequired(true))
      .addIntegerOption(o=>o.setName('quantite').setDescription('Quantité').setRequired(true)))
    // Armes (manuel)
    .addSubcommand(sc => sc.setName('arme_ajouter')
      .setDescription('Ajouter une arme (manuel)')
      .addStringOption(o=>o.setName('nom').setDescription('Ex: pistolet de combat').setRequired(true))
      .addStringOption(o=>o.setName('serial').setDescription('Numéro de série'))
      .addIntegerOption(o=>o.setName('munitions').setDescription('Munitions')))
    .addSubcommand(sc => sc.setName('arme_retirer')
      .setDescription('Retirer une arme (manuel)')
      .addStringOption(o=>o.setName('nom').setDescription('Nom exact').setRequired(true))
      .addStringOption(o=>o.setName('serial').setDescription('Numéro de série (si tu veux cibler)')))
    // Voitures (manuel)
    .addSubcommand(sc => sc.setName('voiture_ajouter')
      .setDescription('Ajouter une voiture (manuel)')
      .addStringOption(o=>o.setName('modele').setDescription('Ex: Buffalo STX').setRequired(true))
      .addStringOption(o=>o.setName('plaque').setDescription('Plaque'))
      .addBooleanOption(o=>o.setName('assuree').setDescription('Assurance')))
    .addSubcommand(sc => sc.setName('voiture_retirer')
      .setDescription('Retirer une voiture (manuel)')
      .addStringOption(o=>o.setName('modele').setDescription('Modèle exact').setRequired(true))
      .addStringOption(o=>o.setName('plaque').setDescription('Plaque (si tu veux cibler)'))),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    // ---------- VOIR ----------
    if (sub === 'voir') {
      const data = listByCategory(userId);
      const e = new EmbedBuilder()
        .setTitle(`Inventaire de ${interaction.user.username}`)
        .setColor(0x2b2d31)
        .setTimestamp();

      // Voitures
      e.addFields({
        name: '🚗 Voitures',
        value: data.vehicles.length
          ? data.vehicles.map(v => `• ${v.model}${v.plate?` — ${v.plate}`:''}${v.insured?' (assurée)':''}`).join('\n').slice(0,1024)
          : '— Aucun —'
      });
      // Armes
      e.addFields({
        name: '🗡️ Armes',
        value: data.weapons.length
          ? data.weapons.map(w => `• ${w.name}${w.serial?` — ${w.serial}`:''}${w.ammo?` — ${w.ammo} muns`:''}`).join('\n').slice(0,1024)
          : '— Aucun —'
      });
      // Permis & argent
      e.addFields(
        { name: '🪪 Permis', value: (data.permits||[]).length ? data.permits.join(', ') : '— Aucun —', inline: true },
        { name: '💵 Liquide', value: `${data.liquide} $`, inline: true },
      );
      // Items / Drogues
      for (const [cat, arr] of Object.entries(data.cats)) {
        if (!arr.length) continue;
        const lines = arr.map(it => `• ${displayName(it)} × **${it.qty}**`).join('\n');
        e.addFields({ name: `📦 ${cat}`, value: lines.substring(0,1024) });
      }

      return interaction.reply({ embeds: [e], ephemeral: true });
    }

    // ---------- DONNER (items/drogues) ----------
    if (sub === 'donner') {
      const cible = interaction.options.getUser('cible');
      const cat = interaction.options.getString('categorie');
      const itemName = interaction.options.getString('item');
      const qty = interaction.options.getInteger('quantite');
      if (qty <= 0) return interaction.reply({ content: 'Quantité invalide.', ephemeral: true });

      const invSelf = getUserInv(userId);
      const line = invSelf.items.find(it => {
        const ok =
          (it.type==='food' && cat==='Nourriture') ||
          (it.type==='water' && cat==='Eau') ||
          (it.type==='soda' && cat==='Soda') ||
          (it.type==='drug_final' && cat==='Drogues');
        if (!ok) return false;
        return (require('../utils/items').displayName(it)).toLowerCase() === itemName.toLowerCase();
      });
      if (!line) return interaction.reply({ content: 'Item introuvable dans ton inventaire.', ephemeral: true });
      if (line.qty < qty) return interaction.reply({ content: 'Quantité insuffisante.', ephemeral: true });

      // remove from sender
      const idx = invSelf.items.indexOf(line);
      invSelf.items[idx].qty -= qty;
      if (invSelf.items[idx].qty <= 0) invSelf.items.splice(idx,1);
      setUserInv(userId, invSelf);

      // add to receiver (stack strict)
      const invRx = getUserInv(cible.id);
      const key = JSON.stringify({ type: line.type, name: line.name, base: line.base, custom: line.custom });
      const match = invRx.items.find(i => JSON.stringify({ type: i.type, name: i.name, base: i.base, custom: i.custom }) === key);
      if (match) match.qty += qty; else invRx.items.push({ ...line, qty });
      setUserInv(cible.id, invRx);

      return interaction.reply({ content: `✅ Transféré **${qty}× ${itemName}** à ${cible}.`, ephemeral: true });
    }

    // ---------- ARMES (manuel) ----------
    if (sub === 'arme_ajouter') {
      const nom = interaction.options.getString('nom');
      const serial = interaction.options.getString('serial') || null;
      const ammo = interaction.options.getInteger('munitions') || 0;
      addWeapon(userId, { name: nom, serial, ammo });
      return interaction.reply({ content: `🔫 Ajouté: **${nom}**${serial?` (${serial})`:''}${ammo?` — ${ammo} muns`:''}`, ephemeral: true });
    }
    if (sub === 'arme_retirer') {
      const nom = interaction.options.getString('nom');
      const serial = interaction.options.getString('serial') || null;
      const ok = removeWeapon(userId, nom, serial);
      return interaction.reply({ content: ok ? `🗑️ Retiré: **${nom}**` : 'Aucune arme correspondante.', ephemeral: true });
    }

    // ---------- VOITURES (manuel) ----------
    if (sub === 'voiture_ajouter') {
      const model = interaction.options.getString('modele');
      const plate = interaction.options.getString('plaque') || null;
      const insured = interaction.options.getBoolean('assuree') || false;
      addVehicle(userId, { model, plate, insured });
      return interaction.reply({ content: `🚗 Ajouté: **${model}**${plate?` — ${plate}`:''}${insured?' (assurée)':''}`, ephemeral: true });
    }
    if (sub === 'voiture_retirer') {
      const model = interaction.options.getString('modele');
      const plate = interaction.options.getString('plaque') || null;
      const ok = removeVehicle(userId, model, plate);
      return interaction.reply({ content: ok ? `🗑️ Retiré: **${model}**` : 'Aucun véhicule correspondant.', ephemeral: true });
    }
  }
};
