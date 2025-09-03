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

    // ---------- OUVRIR ----------
    if (sub === 'ouvrir') {
      const id = interaction.options.getString('propriete_id');
      const p = findOwnedById(id);
      if (!p) return interaction.reply({ content: 'Propriété introuvable.', ephemeral: true });
      if (!canAccess(p, userId, 'view')) return interaction.reply({ content: '⛔ Accès refusé.', ephemeral: true });

      const e = new EmbedBuilder()
        .setTitle(`Stockage — ${p.name} [${p.id}]`)
        .setColor(0x2b2d31)
        .setTimestamp();

      const byCat = {};
      for (const it of (p.storage.items || [])) {
        const c = catOf(it);
        byCat[c] = byCat[c] || [];
        byCat[c].push(it);
      }
      for (const [cat, arr] of Object.entries(byCat)) {
        const lines = arr.map(it => `• ${displayName(it)} × **${it.qty}**`).join('\n').slice(0, 1024);
        e.addFields({ name: `• ${cat}`, value: lines || '—' });
      }
      e.setFooter({ text: `Capacité utilisée: ${totalStoredCount(p)}/2000` });
      return interaction.reply({ embeds: [e], ephemeral: true });
    }

    // ---------- DEPOT ----------
    if (sub === 'depot') {
      const id = interaction.options.getString('propriete_id');
      const name = interaction.options.getString('item');
      const qty = interaction.options.getInteger('quantite');
      const p = findOwnedById(id);
      if (!p) return interaction.reply({ content: 'Propriété introuvable.', ephemeral: true });
      if (!canAccess(p, userId, 'deposit')) return interaction.reply({ content: '⛔ Accès (dépôt) refusé.', ephemeral: true });
      if (qty <= 0) return interaction.reply({ content: 'Quantité invalide.', ephemeral: true });

      // chercher l'item dans l'inventaire par son "nom affiché"
      const inv = getUserInv(userId);
      const idx = inv.items.findIndex(it => displayName(it).toLowerCase() === name.toLowerCase());
      if (idx === -1) return interaction.reply({ content: 'Item introuvable dans votre inventaire.', ephemeral: true });
      if (inv.items[idx].qty < qty) return interaction.reply({ content: 'Quantité insuffisante.', ephemeral: true });

      // capacité
      const cap = totalStoredCount(p);
      if (cap + qty > 2000) return interaction.reply({ content: 'Capacité de 2000 items atteinte.', ephemeral: true });

      // transfert inventaire -> propriété (empilement strict: même type+name)
      const moving = { ...inv.items[idx], qty };
      inv.items[idx].qty -= qty;
      if (inv.items[idx].qty === 0) inv.items.splice(idx, 1);
      setUserInv(userId, inv);

      p.storage.items = p.storage.items || [];
      const matchIdx = p.storage.items.findIndex(it =>
        it.type === moving.type &&
        it.name === moving.name
      );
      if (matchIdx >= 0) p.storage.items[matchIdx].qty += qty;
      else p.storage.items.push(moving);
      setOwned(p);

      return interaction.reply({ content: `✅ Déposé **${qty}× ${name}** dans ${p.name}.`, ephemeral: true });
    }

    // ---------- RETRAIT ----------
    if (sub === 'retrait') {
      const id = interaction.options.getString('propriete_id');
      const name = interaction.options.getString('item');
      const qty = interaction.options.getInteger('quantite');
      const p = findOwnedById(id);
      if (!p) return interaction.reply({ content: 'Propriété introuvable.', ephemeral: true });
      if (!canAccess(p, userId, 'withdraw')) return interaction.reply({ content: '⛔ Accès (retrait) refusé.', ephemeral: true });
      if (qty <= 0) return interaction.reply({ content: 'Quantité invalide.', ephemeral: true });

      const i = p.storage.items.findIndex(it => displayName(it).toLowerCase() === name.toLowerCase());
      if (i === -1) return interaction.reply({ content: 'Item introuvable en stockage.', ephemeral: true });
      if (p.storage.items[i].qty < qty) return interaction.reply({ content: 'Quantité insuffisante en stockage.', ephemeral: true });

      // transfert propriété -> inventaire (empilement strict)
      const moving = { ...p.storage.items[i], qty };
      p.storage.items[i].qty -= qty;
      if (p.storage.items[i].qty === 0) p.storage.items.splice(i, 1);
      setOwned(p);

      const inv = getUserInv(userId);
      const matchIdx = inv.items.findIndex(it =>
        it.type === moving.type &&
        it.name === moving.name
      );
      if (matchIdx >= 0) inv.items[matchIdx].qty += qty;
      else inv.items.push(moving);
      setUserInv(userId, inv);

      return interaction.reply({ content: `✅ Retiré **${qty}× ${name}** de ${p.name}.`, ephemeral: true });
    }
  }
};
