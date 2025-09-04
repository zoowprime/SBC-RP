// src/commands/stockage.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { findOwnedById, listAccessibleForUser, setOwned } = require('../utils/properties');
const { getUserInv, setUserInv } = require('../utils/inventory');
const { displayName } = require('../utils/items');

const C = { primary:0x5865F2, success:0x57F287, warning:0xFEE75C, danger:0xED4245 };

function canDo(p, uid, right) {
  if (p.ownerId === uid) return true;
  return (p.access || []).some(a => a.userId === uid && (a.rights||[]).includes(right));
}

function summarizeStorage(p) {
  const items = (p.storage?.items || []);
  if (!items.length) return '_Vide._';

  const groups = {};
  for (const it of items) {
    const key = it.type || 'autre';
    if (!groups[key]) groups[key] = [];
    groups[key].push(it);
  }
  const order = ['food','water','soda','drug_final','raw','mid','autre'];
  const em = { food:'🍔', water:'💧', soda:'🥤', drug_final:'🧪', raw:'📦', mid:'🧰', autre:'📦' };

  let out = '';
  for (const k of order) {
    if (!groups[k]) continue;
    const lines = groups[k].map(it => `• ${displayName(it)} × **${it.qty}**`).join('\n');
    out += `**${em[k]||'📦'} ${k.toUpperCase()}**\n${lines}\n\n`;
  }
  return out.slice(0, 3900) || '_Vide._';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stockage')
    .setDescription('Stockages de propriétés (ouvrir / dépôt / retrait)')

    .addSubcommand(sc => sc.setName('ouvrir')
      .setDescription('Ouvrir un stockage de propriété')
      .addStringOption(o => o
        .setName('propriete_id')
        .setDescription('(facultatif) ID ou laisse vide et choisis dans le menu')
        .setRequired(false)
        .setAutocomplete(true)
      )
    )

    // ⚠️ Requis d’abord, puis option facultative (ordre corrigé)
    .addSubcommand(sc => sc.setName('depot')
      .setDescription('Déposer un item de ton inventaire vers la propriété')
      .addStringOption(o => o.setName('item').setDescription('Nom affiché (exact)').setRequired(true))
      .addIntegerOption(o => o.setName('quantite').setDescription('Quantité').setMinValue(1).setRequired(true))
      .addStringOption(o => o.setName('propriete_id').setDescription('(facultatif) ID ou sélection menu').setRequired(false).setAutocomplete(true))
    )

    // ⚠️ Requis d’abord, puis option facultative (ordre corrigé)
    .addSubcommand(sc => sc.setName('retrait')
      .setDescription('Retirer un item du stockage vers ton inventaire')
      .addStringOption(o => o.setName('item').setDescription('Nom affiché (exact)').setRequired(true))
      .addIntegerOption(o => o.setName('quantite').setDescription('Quantité').setMinValue(1).setRequired(true))
      .addStringOption(o => o.setName('propriete_id').setDescription('(facultatif) ID ou sélection menu').setRequired(false).setAutocomplete(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const uid = interaction.user.id;

    const pid = interaction.options.getString('propriete_id');
    let prop = null;

    if (sub === 'ouvrir') {
      if (!pid) {
        const props = listAccessibleForUser(uid);
        if (!props.length) return interaction.reply({ content: 'Tu n’as accès à aucune propriété.', ephemeral: true });
        return interaction.reply({
          embeds: [ new EmbedBuilder()
            .setColor(C.primary)
            .setTitle('📦 Ouvrir un stockage')
            .setDescription('Clique dans le champ **propriete_id** de la commande et **sélectionne ta propriété** (autocomplete).')
          ]
        });
      }
      prop = findOwnedById(pid);
      if (!prop) return interaction.reply({ content: 'Propriété introuvable.', ephemeral: true });
      if (!canDo(prop, uid, 'voir')) return interaction.reply({ content: 'Accès refusé.', ephemeral: true });

      const e = new EmbedBuilder()
        .setColor(C.primary)
        .setTitle(`📦 Stockage — ${prop.name} [${prop.id}]`)
        .setDescription(summarizeStorage(prop))
        .setFooter({ text: prop.type ? `Type: ${prop.type}` : 'Type: N/A' })
        .setTimestamp();

      return interaction.reply({ embeds: [e] });
    }

    if (sub === 'depot') {
      if (!pid) {
        return interaction.reply({
          embeds: [ new EmbedBuilder().setColor(C.primary).setDescription('❗ Laisse **propriete_id** vide et **choisis dans la liste** (autocomplete).') ],
          ephemeral: true
        });
      }
      prop = findOwnedById(pid);
      if (!prop) return interaction.reply({ content: 'Propriété introuvable.', ephemeral: true });
      if (!canDo(prop, uid, 'depôt')) return interaction.reply({ content: 'Accès dépôt refusé.', ephemeral: true });

      const itemName = interaction.options.getString('item');
      const qty = interaction.options.getInteger('quantite');

      const inv = getUserInv(uid);
      const line = inv.items.find(i => displayName(i).toLowerCase() === itemName.toLowerCase());
      if (!line) return interaction.reply({ content: 'Item introuvable dans ton inventaire.', ephemeral: true });
      if (line.qty < qty) return interaction.reply({ content: 'Quantité insuffisante.', ephemeral: true });

      line.qty -= qty;
      if (line.qty <= 0) inv.items = inv.items.filter(i => i !== line);
      setUserInv(uid, inv);

      prop.storage = prop.storage || { items: [] };
      const key = JSON.stringify({ type: line.type, name: line.name, base: line.base, custom: line.custom });
      const match = prop.storage.items.find(i => JSON.stringify({ type: i.type, name: i.name, base: i.base, custom: i.custom }) === key);
      if (match) match.qty += qty; else prop.storage.items.push({ ...line, qty });
      setOwned(prop);

      const e = new EmbedBuilder()
        .setColor(C.success)
        .setTitle('⬆️ Dépôt effectué')
        .setDescription(`**${qty}× ${displayName(line)}** → **${prop.name}**`)
        .setTimestamp();

      return interaction.reply({ embeds: [e] });
    }

    if (sub === 'retrait') {
      if (!pid) {
        return interaction.reply({
          embeds: [ new EmbedBuilder().setColor(C.primary).setDescription('❗ Laisse **propriete_id** vide et **choisis dans la liste** (autocomplete).') ],
          ephemeral: true
        });
      }
      prop = findOwnedById(pid);
      if (!prop) return interaction.reply({ content: 'Propriété introuvable.', ephemeral: true });
      if (!canDo(prop, uid, 'retrait')) return interaction.reply({ content: 'Accès retrait refusé.', ephemeral: true });

      const itemName = interaction.options.getString('item');
      const qty = interaction.options.getInteger('quantite');

      prop.storage = prop.storage || { items: [] };
      const line = prop.storage.items.find(i => displayName(i).toLowerCase() === itemName.toLowerCase());
      if (!line) return interaction.reply({ content: 'Item introuvable dans le stockage.', ephemeral: true });
      if (line.qty < qty) return interaction.reply({ content: 'Quantité insuffisante en stockage.', ephemeral: true });

      line.qty -= qty;
      if (line.qty <= 0) prop.storage.items = prop.storage.items.filter(i => i !== line);
      setOwned(prop);

      const inv = getUserInv(uid);
      const key = JSON.stringify({ type: line.type, name: line.name, base: line.base, custom: line.custom });
      const match = inv.items.find(i => JSON.stringify({ type: i.type, name: i.name, base: i.base, custom: i.custom }) === key);
      if (match) match.qty += qty; else inv.items.push({ ...line, qty });
      setUserInv(uid, inv);

      const e = new EmbedBuilder()
        .setColor(C.success)
        .setTitle('⬇️ Retrait effectué')
        .setDescription(`**${qty}× ${displayName(line)}** ← **${prop.name}**`)
        .setTimestamp();

      return interaction.reply({ embeds: [e] });
    }
  }
};
