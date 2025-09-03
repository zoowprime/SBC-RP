const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { findOwnedById, setOwned } = require('../utils/properties');
const { getUserInv, setUserInv } = require('../utils/inventory');
const { getIllegalType, recipeAllowed } = require('../utils/illegal');

const C = { primary:0x5865F2, success:0x57F287, warning:0xFEE75C, danger:0xED4245 };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('produire')
    .setDescription('Transformer dans une propriété illégale')
    .addStringOption(o=>o.setName('propriete_id').setDescription('ID propriété').setRequired(true))
    .addStringOption(o=>o.setName('recette').setDescription('weed_pochon|weed_final|coke_poudre|coke_final|meth_pierre|meth_final|crack_roche|crack_final').setRequired(true))
    .addIntegerOption(o=>o.setName('quantite').setDescription('Qté').setMinValue(1).setRequired(true))
    .addStringOption(o=>o.setName('nom_custom').setDescription('Nom custom (final uniquement)')),

  async execute(interaction){
    const pid = interaction.options.getString('propriete_id');
    const recipe = interaction.options.getString('recette');
    const q = interaction.options.getInteger('quantite');
    const custom = interaction.options.getString('nom_custom') || null;

    const prop = findOwnedById(pid); if (!prop) return interaction.reply({ content:'Propriété introuvable.' });
    const ptype = (require('../utils/illegal')).getIllegalType(prop);
    if (!ptype) return interaction.reply({ content:'Cette propriété n’est pas un site illégal reconnu.' });
    if (!recipeAllowed(ptype, recipe)) return interaction.reply({ content:`Recette **${recipe}** non autorisée dans un site **${ptype}**.` });

    const owner = prop.ownerId === interaction.user.id;
    const can = owner || (prop.access||[]).some(a => a.userId===interaction.user.id && (a.rights||[]).includes('voir'));
    if (!can) return interaction.reply({ content:'Accès production refusé.' });

    prop.storage = prop.storage || { items:[] };
    const pool = prop.storage.items;
    const take = (name, need) => {
      const row = pool.find(i=>i.name===name && (i.type==='raw'||i.type==='mid'));
      if (!row || row.qty < need) return false;
      row.qty -= need; if (row.qty===0) prop.storage.items = pool.filter(x=>x!==row);
      return true;
    };
    const addMid = (name, qty) => {
      const row = pool.find(i=>i.name===name && i.type==='mid');
      if (row) row.qty += qty; else pool.push({ type:'mid', name, qty });
    };

    let produced = 0;

    if (recipe === 'weed_pochon'){
      const need = 5*q;
      if (!take('weed_feuille', need)) return interaction.reply({ content:'Pas assez de weed_feuille.' });
      addMid('weed_pochon', q); produced = q;

    } else if (recipe === 'weed_final'){
      if (!take('weed_pochon', q)) return interaction.reply({ content:'Pas assez de weed_pochon.' });
      const inv = getUserInv(interaction.user.id);
      const unit = { type:'drug_final', name:'weed', base:'weed', custom, qty:q };
      const same = inv.items.find(i=>i.type==='drug_final'&&i.base==='weed'&&i.custom===custom);
      if (same) same.qty+=q; else inv.items.push(unit);
      setUserInv(interaction.user.id, inv); produced = q;

    } else if (recipe === 'coke_poudre'){
      const need = 3*q;
      if (!take('coca_feuille', need)) return interaction.reply({ content:'Pas assez de coca_feuille.' });
      addMid('coca_poudre', q); produced = q;

    } else if (recipe === 'coke_final'){
      const need = 2*q;
      if (!take('coca_poudre', need)) return interaction.reply({ content:'Pas assez de coca_poudre.' });
      const inv = getUserInv(interaction.user.id);
      const unit = { type:'drug_final', name:'coke_pochon', base:'coke', custom, qty:q };
      const same = inv.items.find(i=>i.type==='drug_final'&&i.base==='coke'&&i.custom===custom);
      if (same) same.qty+=q; else inv.items.push(unit);
      setUserInv(interaction.user.id, inv); produced = q;

    } else if (recipe === 'meth_pierre'){
      // Jerrican d’Acide + 1× meth_liquide → 1× meth_pierre
      if (!take('jerrican_acide', q) || !take('meth_liquide', q)) {
        return interaction.reply({ content:'Jerrican d’Acide / meth_liquide insuffisants.' });
      }
      addMid('meth_pierre', q); produced = q;

    } else if (recipe === 'meth_final'){
      const need = 2*q;
      if (!take('meth_pierre', need)) return interaction.reply({ content:'Pas assez de meth_pierre.' });
      const inv = getUserInv(interaction.user.id);
      const unit = { type:'drug_final', name:'meth_pochon', base:'meth', custom, qty:q };
      const same = inv.items.find(i=>i.type==='drug_final'&&i.base==='meth'&&i.custom===custom);
      if (same) same.qty+=q; else inv.items.push(unit);
      setUserInv(interaction.user.id, inv); produced = q;

    } else if (recipe === 'crack_roche'){
      if (!take('coca_poudre', q) || !take('bicarbonate', q)) {
        return interaction.reply({ content:'coca_poudre / bicarbonate insuffisants.' });
      }
      addMid('crack_roche', q); produced = q;

    } else if (recipe === 'crack_final'){
      const need = 2*q;
      if (!take('crack_roche', need)) return interaction.reply({ content:'Pas assez de crack_roche.' });
      const inv = getUserInv(interaction.user.id);
      const unit = { type:'drug_final', name:'crack_pochon', base:'crack', custom, qty:q };
      const same = inv.items.find(i=>i.type==='drug_final'&&i.base==='crack'&&i.custom===custom);
      if (same) same.qty+=q; else inv.items.push(unit);
      setUserInv(interaction.user.id, inv); produced = q;

    } else return interaction.reply({ content:'Recette inconnue.' });

    setOwned(prop);
    const e = new EmbedBuilder()
      .setColor(C.success)
      .setTitle('⚗️ Production effectuée')
      .setDescription(`Recette **${recipe}** — Produit: **${produced}**`)
      .setFooter({ text:`Propriété ${prop.id} — ${prop.name}` });
    return interaction.reply({ embeds:[e] });
  }
};
