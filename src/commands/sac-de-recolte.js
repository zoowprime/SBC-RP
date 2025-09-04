// src/commands/sac-de-recolte.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBag, setBag } = require('../utils/harvest');
const { findOwnedById, setOwned } = require('../utils/properties');
const { getIllegalType, accepts } = require('../utils/illegal');

const C = { primary:0x5865F2, success:0x57F287, warning:0xFEE75C, danger:0xED4245 };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sac-de-recolte')
    .setDescription('Voir / déposer / jeter le Sac')
    .addSubcommand(sc=>sc.setName('voir').setDescription('Voir le contenu du Sac'))
    .addSubcommand(sc=>sc.setName('deposer')
      .setDescription('Déposer du Sac vers un entrepôt illégal')
      .addStringOption(o=>o.setName('propriete_id').setDescription('Choisis une propriété').setRequired(true).setAutocomplete(true))
      .addStringOption(o=>o.setName('item').setDescription('Choisis un item du sac').setRequired(true).setAutocomplete(true))
      .addIntegerOption(o=>o.setName('quantite').setDescription('Qté').setMinValue(1).setRequired(true))
    )
    .addSubcommand(sc=>sc.setName('jeter')
      .setDescription('Détruire une partie du Sac')
      .addStringOption(o=>o.setName('item').setDescription('Choisis un item du sac').setRequired(true).setAutocomplete(true))
      .addIntegerOption(o=>o.setName('quantite').setDescription('Qté').setMinValue(1).setRequired(true))
    ),

  async execute(interaction){
    const sub = interaction.options.getSubcommand();
    const uid = interaction.user.id;
    const bag = getBag(uid);

    if (sub === 'voir'){
      const e = new EmbedBuilder()
        .setColor(C.primary).setTitle('🎒 Sac de récolte')
        .addFields(
          { name:'Weed feuilles', value:String(bag.weed_feuille), inline:true },
          { name:'Coca feuilles', value:String(bag.coca_feuille), inline:true },
          { name:'Coca poudre',   value:String(bag.coca_poudre),  inline:true },
          { name:'Jerrican d’Acide', value:String(bag.jerrican_acide), inline:true },
          { name:'Meth liquide',     value:String(bag.meth_liquide),    inline:true },
        )
        .setFooter({ text:'Le Sac est non échangeable. Dépose dans un entrepôt illégal.' });
      return interaction.reply({ embeds:[e] });
    }

    if (sub === 'deposer'){
      const pid  = interaction.options.getString('propriete_id');
      const item = interaction.options.getString('item');
      const qty  = interaction.options.getInteger('quantite');
      if (!bag[item] || bag[item] < qty) return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.warning).setDescription('Quantité insuffisante dans le Sac.') ]});

      const prop = findOwnedById(pid);
      if (!prop) return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.danger).setDescription('Propriété introuvable.') ]});
      const ptype = getIllegalType(prop);
      if (!ptype) return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.danger).setDescription('Cette propriété n’est pas un site illégal reconnu.') ]});
      if (!accepts(ptype, item)) return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.warning).setDescription(`Cet entrepôt **${ptype}** n’accepte pas **${item}**.`) ]});

      const owner = prop.ownerId === uid;
      const guest = (prop.access||[]).some(a => a.userId===uid && (a.rights||[]).includes('depôt'));
      if (!owner && !guest) return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.danger).setDescription('Accès dépôt refusé.') ]});

      setBag(uid, (b)=>{ b[item]-=qty; });
      prop.storage = prop.storage || { items:[] };
      const same = prop.storage.items.find(i=>i.type==='raw' && i.name===item);
      if (same) same.qty += qty; else prop.storage.items.push({ type:'raw', name:item, qty });
      setOwned(prop);

      return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.success).setTitle('⬆️ Dépôt effectué').setDescription(`**${qty}× ${item}** → **${prop.name}**.`) ]});
    }

    if (sub === 'jeter'){
      const item = interaction.options.getString('item');
      const qty  = interaction.options.getInteger('quantite');
      if (!bag[item] || bag[item] < qty) return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.warning).setDescription('Quantité insuffisante dans le Sac.') ]});
      setBag(uid, (b)=>{ b[item]-=qty; });
      return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.success).setDescription(`🗑️ Jeté **${qty}× ${item}**.`) ]});
    }
  }
};