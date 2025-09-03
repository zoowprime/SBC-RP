// src/commands/stockage.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { findOwnedById, setOwned } = require('../utils/properties');
const { getUserInv, setUserInv } = require('../utils/inventory');
const { displayName } = require('../utils/items');

const COLORS = {
  primary: 0x5865F2,
  success: 0x57F287,
  warning: 0xFEE75C,
  danger:  0xED4245,
  slate:   0x2B2D31,
};

const EMO = {
  head: '📦',
  ok: '✅',
  in: '⬆️',
  out: '⬇️',
  prop: '🏠',
  lock: '🔒',
  list: '🗂️',
  drug: '💊',
  food: '🍔',
  water: '💧',
  soda: '🥤',
  cash: '💵',
};

function can(userId, prop, right) {
  if (!prop) return false;
  if (prop.ownerId === userId) return true;
  const entry = (prop.access || []).find(a => a.userId === userId);
  if (!entry) return false;
  if (right === 'voir') return entry.rights.includes('voir');
  if (right === 'depot') return entry.rights.includes('depôt') || entry.rights.includes('depot');
  if (right === 'retrait') return entry.rights.includes('retrait');
  return false;
}

function catLabel(type) {
  if (type === 'drug_final') return `${EMO.drug} Drogues`;
  if (type === 'food')       return `${EMO.food} Nourriture`;
  if (type === 'water')      return `${EMO.water} Eau`;
  if (type === 'soda')       return `${EMO.soda} Soda`;
  return `${EMO.list} Autres`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stockage')
    .setDescription('Stockages de propriétés')
    .addSubcommand(sc =>
      sc.setName('ouvrir')
        .setDescription('Ouvrir le stockage d’une propriété')
        .addStringOption(o => o.setName('propriete_id').setDescription('ID propriété').setRequired(true))
    )
    .addSubcommand(sc =>
      sc.setName('depot')
        .setDescription('Déposer depuis votre inventaire vers le stockage')
        .addStringOption(o => o.setName('propriete_id').setDescription('ID propriété').setRequired(true))
        .addStringOption(o => o.setName('type').setDescription('food|water|soda|drug_final|autre').setRequired(true))
        .addStringOption(o => o.setName('nom').setDescription('Nom affiché (ex: burger, Amnesia (Weed))').setRequired(true))
        .addIntegerOption(o => o.setName('quantite').setDescription('Qté').setMinValue(1).setRequired(true))
    )
    .addSubcommand(sc =>
      sc.setName('retrait')
        .setDescription('Retirer du stockage vers votre inventaire')
        .addStringOption(o => o.setName('propriete_id').setDescription('ID propriété').setRequired(true))
        .addStringOption(o => o.setName('type').setDescription('food|water|soda|drug_final|autre').setRequired(true))
        .addStringOption(o => o.setName('nom').setDescription('Nom affiché exact').setRequired(true))
        .addIntegerOption(o => o.setName('quantite').setDescription('Qté').setMinValue(1).setRequired(true))
    ),

  async execute(interaction) {
    const sub   = interaction.options.getSubcommand();
    const pid   = interaction.options.getString('propriete_id');
    const user  = interaction.user;
    const prop  = findOwnedById(pid);

    if (!prop) {
      return interaction.reply({
        embeds: [ new EmbedBuilder().setColor(COLORS.danger).setDescription('Propriété introuvable.') ]
      });
    }

    // ---------- OUVRIR ----------
    if (sub === 'ouvrir') {
      if (!can(user.id, prop, 'voir')) {
        return interaction.reply({
          embeds: [ new EmbedBuilder().setColor(COLORS.danger).setDescription(`${EMO.lock} Accès refusé.`) ]
        });
      }

      const groups = { food: [], water: [], soda: [], drug_final: [], other: [] };
      for (const it of (prop.storage?.items || [])) {
        const line = `• ${displayName(it)} × **${it.qty}**`;
        if (it.type === 'food') groups.food.push(line);
        else if (it.type === 'water') groups.water.push(line);
        else if (it.type === 'soda') groups.soda.push(line);
        else if (it.type === 'drug_final') groups.drug_final.push(line);
        else groups.other.push(line);
      }

      const e = new EmbedBuilder()
        .setColor(COLORS.primary)
        .setTitle(`${EMO.prop} Stockage — ${prop.name}`)
        .setDescription(`ID: \`${prop.id}\``)
        .setFooter({ text: 'SBC Immobilier' })
        .setTimestamp();

      const push = (name, arr) => {
        e.addFields({ name, value: arr.length ? arr.join('\n').slice(0,1024) : '_Vide._', inline: false });
      };
      push(catLabel('food'), groups.food);
      push(catLabel('water'), groups.water);
      push(catLabel('soda'), groups.soda);
      push(catLabel('drug_final'), groups.drug_final);
      if (groups.other.length) push(catLabel('other'), groups.other);

      return interaction.reply({ embeds: [e] }); // public
    }

    // Helpers pour dépôt/retrait
    const type   = interaction.options.getString('type');
    const name   = interaction.options.getString('nom');
    const qty    = interaction.options.getInteger('quantite');
    prop.storage = prop.storage || { items: [] };

    // Trouver item par libellé affiché
    const findByLabel = (arr, label) =>
      arr.find(i => displayName(i).toLowerCase() === label.toLowerCase());

    // ---------- DEPOT ----------
    if (sub === 'depot') {
      if (!can(user.id, prop, 'depot')) {
        return interaction.reply({
          embeds: [ new EmbedBuilder().setColor(COLORS.danger).setDescription(`${EMO.lock} Accès dépôt refusé.`) ]
        });
      }

      const inv = getUserInv(user.id);
      const src = findByLabel(inv.items, name);
      if (!src || src.qty < qty || (type && src.type !== type)) {
        return interaction.reply({
          embeds: [ new EmbedBuilder().setColor(COLORS.warning).setDescription(`Item introuvable ou quantité insuffisante.`) ]
        });
      }

      // retirer de l’inventaire joueur
      src.qty -= qty;
      if (src.qty <= 0) inv.items = inv.items.filter(i => i !== src);
      setUserInv(user.id, inv);

      // ajouter au stockage (stack strict)
      const key = JSON.stringify({ type: src.type, name: src.name, base: src.base, custom: src.custom });
      const dst = prop.storage.items.find(i => JSON.stringify({ type: i.type, name: i.name, base: i.base, custom: i.custom }) === key);
      if (dst) dst.qty += qty;
      else prop.storage.items.push({ ...src, qty });

      setOwned(prop);

      const e = new EmbedBuilder()
        .setColor(COLORS.success)
        .setTitle(`${EMO.in} Dépôt effectué`)
        .setDescription(`${displayName(src)} × **${qty}** → **${prop.name}**`)
        .setFooter({ text: `Propriété ${prop.id}` })
        .setTimestamp();
      return interaction.reply({ embeds: [e] });
    }

    // ---------- RETRAIT ----------
    if (sub === 'retrait') {
      if (!can(user.id, prop, 'retrait')) {
        return interaction.reply({
          embeds: [ new EmbedBuilder().setColor(COLORS.danger).setDescription(`${EMO.lock} Accès retrait refusé.`) ]
        });
      }

      const pool = prop.storage.items;
      const src  = findByLabel(pool, name);
      if (!src || (type && src.type !== type) || src.qty < qty) {
        return interaction.reply({
          embeds: [ new EmbedBuilder().setColor(COLORS.warning).setDescription(`Item introuvable ou quantité insuffisante en stockage.`) ]
        });
      }

      // retirer du stockage
      src.qty -= qty;
      if (src.qty <= 0) prop.storage.items = pool.filter(i => i !== src);
      setOwned(prop);

      // ajouter à l’inventaire joueur (stack strict)
      const inv = getUserInv(user.id);
      const key = JSON.stringify({ type: src.type, name: src.name, base: src.base, custom: src.custom });
      const dst = inv.items.find(i => JSON.stringify({ type: i.type, name: i.name, base: i.base, custom: i.custom }) === key);
      if (dst) dst.qty += qty; else inv.items.push({ ...src, qty });
      setUserInv(user.id, inv);

      const e = new EmbedBuilder()
        .setColor(COLORS.success)
        .setTitle(`${EMO.out} Retrait effectué`)
        .setDescription(`${displayName(src)} × **${qty}** ← **${prop.name}**`)
        .setFooter({ text: `Propriété ${prop.id}` })
        .setTimestamp();
      return interaction.reply({ embeds: [e] });
    }
  }
};
