// src/commands/commande-illegale.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { readJSON, writeJSON } = require('../utils/store');
const { findOwnedById, setOwned, db:propdb } = require('../utils/properties');
const { getIllegalType, accepts } = require('../utils/illegal');
const { getUser, setUser } = require('../economy');

const C = { primary:0x5865F2, success:0x57F287, warning:0xFEE75C, danger:0xED4245 };
const PRICE_PER_UNIT = 100;
const DAILY_LIMIT = 10;

const ITEMS = [
  { key:'jerrican_acide',  label:'Jerrican d’Acide (METH)', for:'meth' },
  { key:'meth_liquide',    label:'Meth (liquide) (METH)',   for:'meth' },
  { key:'bicarbonate',     label:'Bicarbonate (CRACK)',     for:'crack' },
  { key:'crack_precurseur',label:'Précurseur Crack (CRACK)',for:'crack' },
];

function loadOrders(){ return readJSON('illegal_orders.json', { users:{} }); }
function saveOrders(db){ writeJSON('illegal_orders.json', db); }
function todayKey(){ const d=new Date(); return [d.getUTCFullYear(), d.getUTCMonth()+1, d.getUTCDate()].join('-'); }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('commande-illegale')
    .setDescription('Approvisionnement Meth/Crack (100$ unité, 10/jour/item)')
    .addSubcommand(sc=>sc.setName('panneau').setDescription('Publier un panneau de commande dans ce salon'))
    .addSubcommand(sc=>sc.setName('acheter')
      .setDescription('Commander un item et le déposer dans votre site')
      .addStringOption(o=>o.setName('item').setDescription('Choisis un item').setRequired(true).setAutocomplete(true))
      .addIntegerOption(o=>o.setName('quantite').setDescription('1 à 10').setMinValue(1).setMaxValue(10).setRequired(true))
      .addStringOption(o=>o.setName('propriete_id').setDescription('Choisis ton site (selon l’item)').setRequired(true).setAutocomplete(true))
    ),

  async execute(interaction){
    const sub = interaction.options.getSubcommand();

    if (sub === 'panneau'){
      const menu = new StringSelectMenuBuilder()
        .setCustomId('illegal_select_item')
        .setPlaceholder('Choisis un item')
        .addOptions(ITEMS.map(i => ({ label:i.label, value:i.key, description:`${PRICE_PER_UNIT}$ / unité` })));

      const row = new ActionRowBuilder().addComponents(menu);
      const e = new EmbedBuilder()
        .setColor(C.primary)
        .setTitle('🏴 Vendeur illégal — Approvisionnement')
        .setDescription(
          `• Choisis un **item** ci-dessous.\n`+
          `• Commande avec **/commande-illegale acheter** *(item, quantité 1–10, propriété_id)*.\n`+
          `• **${PRICE_PER_UNIT}$** / unité — **${DAILY_LIMIT}** max par **item** et **par jour**.\n`+
          `• Dépôt **instantané** dans le stockage de votre **site** (si possédé et type correspondant).`
        )
        .setFooter({ text:'SBC — Meth & Crack' });
      await interaction.reply({ embeds:[e], components:[row] });
      return;
    }

    if (sub === 'acheter'){
      const itemKey = interaction.options.getString('item');
      const qty     = interaction.options.getInteger('quantite');
      const pid     = interaction.options.getString('propriete_id');

      const def = ITEMS.find(i => i.key === itemKey);
      if (!def) return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.danger).setDescription('Item invalide.')]});

      // quota
      const db = loadOrders(); const k = todayKey();
      if (!db.users[interaction.user.id]) db.users[interaction.user.id] = {};
      const used = db.users[interaction.user.id][`${itemKey}:${k}`] || 0;
      if (used + qty > DAILY_LIMIT) {
        const left = Math.max(0, DAILY_LIMIT - used);
        return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.warning).setDescription(`Limite journalière atteinte pour **${def.label}**. Il te reste **${left}** aujourd’hui.`)]});
      }

      // propriété & type
      const prop = findOwnedById(pid);
      if (!prop) return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.danger).setDescription('Propriété introuvable.')]});
      const ptype = getIllegalType(prop);
      if (!ptype) return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.danger).setDescription('Cette propriété n’est pas un site illégal reconnu.')]});
      if (ptype !== def.for) return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.warning).setDescription(`Cet item est réservé aux sites **${def.for}**.`)]});
      if (!accepts(ptype, itemKey)) return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.warning).setDescription(`Le site **${ptype}** n’accepte pas **${itemKey}**.`)]});

      // paiement (courant.liquide)
      const cost = qty * PRICE_PER_UNIT;
      const econ = getUser(interaction.guildId, interaction.user.id);
      if ((econ.current.liquid||0) < cost) {
        return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.danger).setDescription(`Fonds insuffisants : il faut **${cost}$** en liquide.`)]});
      }
      econ.current.liquid -= cost;
      setUser(interaction.guildId, interaction.user.id, (u)=>{ u.frozen=econ.frozen; u.current=econ.current; u.business=econ.business; });

      // dépôt immédiat
      prop.storage = prop.storage || { items:[] };
      const same = prop.storage.items.find(i => (i.type==='raw'||i.type==='mid') && i.name===itemKey);
      if (same) same.qty += qty; else prop.storage.items.push({ type:'raw', name:itemKey, qty });
      setOwned(prop);

      // quota++
      db.users[interaction.user.id][`${itemKey}:${k}`] = used + qty; saveOrders(db);

      const e = new EmbedBuilder()
        .setColor(C.success)
        .setTitle('✅ Commande validée')
        .setDescription(
          `Item: **${def.label}** (*${itemKey}*)\n`+
          `Quantité: **${qty}** — Total: **${cost}$**\n`+
          `Site: **${prop.name}** *(type ${ptype})* → dépôt **instantané** dans le stockage.`
        )
        .setFooter({ text:`Quota ${itemKey}: ${db.users[interaction.user.id][`${itemKey}:${k}`]}/${DAILY_LIMIT} aujourd’hui`});
      return interaction.reply({ embeds:[e] });
    }
  }
};