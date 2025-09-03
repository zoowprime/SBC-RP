// src/commands/illegal.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db, save, nextId } = require('../utils/properties');
const { findOwnedById, setOwned } = require('../utils/properties');
const { getIllegalType, accepts } = require('../utils/illegal');

const C = { primary:0x5865F2, success:0x57F287, warning:0xFEE75C, danger:0xED4245 };

function isStaffOrImmo(member){
  const S = process.env.STAFF_ROLE_ID;
  const I = process.env.IMMO_ROLE_ID;
  return !!(member?.roles?.cache?.has(S) || member?.roles?.cache?.has(I));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('illegal')
    .setDescription('Sites illégaux (hors agence)')
    .addSubcommand(sc=>sc.setName('creer-vendeur')
      .setDescription('Créer une propriété “vendeur illégal” (source infinie)')
      .addStringOption(o=>o.setName('nom').setDescription('Ex: Brickade 6x6 — Meth').setRequired(true))
      .addStringOption(o=>o.setName('type').setDescription('weed|coke|meth|crack').setRequired(true))
      .addUserOption(o=>o.setName('owner').setDescription('Propriétaire initial').setRequired(true))
    )
    .addSubcommand(sc=>sc.setName('don')
      .setDescription('Ajouter des ingrédients/mi-produits depuis le vendeur (infini)')
      .addStringOption(o=>o.setName('propriete_id').setDescription('ID propriété').setRequired(true))
      .addStringOption(o=>o.setName('item').setDescription('Nom technique (ex: weed_feuille, jerrican_acide...)').setRequired(true))
      .addIntegerOption(o=>o.setName('quantite').setDescription('Qté').setMinValue(1).setRequired(true))
    ),

  async execute(interaction){
    const sub = interaction.options.getSubcommand();

    if (sub === 'creer-vendeur'){
      if (!isStaffOrImmo(interaction.member)){
        return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.danger).setDescription('⛔ Réservé staff/agent.') ], ephemeral:true });
      }
      const name = interaction.options.getString('nom');
      const type = interaction.options.getString('type'); // weed|coke|meth|crack
      const owner = interaction.options.getUser('owner');
      const id = nextId('PR');

      const data = db();
      data.owned.push({
        id, ownerId: owner.id, name,
        vendor:true, ptype:type,
        access:[], storage:{ items:[] }
      });
      save(data);

      return interaction.reply({ embeds:[ new EmbedBuilder()
        .setColor(C.success).setTitle('🏴 Vendeur illégal créé')
        .setDescription(`ID: \`${id}\`\nNom: **${name}**\nType: **${type}**\nPropriétaire: <@${owner.id}>`)
      ]});
    }

    if (sub === 'don'){
      const pid = interaction.options.getString('propriete_id');
      const item= interaction.options.getString('item');
      const qty = interaction.options.getInteger('quantite');

      const prop = findOwnedById(pid);
      if (!prop) return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.danger).setDescription('Propriété introuvable.') ]});
      if (!prop.vendor) return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.warning).setDescription('Cette propriété n’est pas marquée comme **vendeur illégal**.') ]});

      const ptype = prop.ptype || getIllegalType(prop);
      if (!ptype) return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.danger).setDescription('Type de site illégal inconnu.') ]});
      if (!accepts(ptype, item)) return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.warning).setDescription(`Le site **${ptype}** n’accepte pas **${item}**.`) ]});

      prop.storage = prop.storage || { items:[] };
      const same = prop.storage.items.find(i=> (i.type==='raw'||i.type==='mid') && i.name===item);
      if (same) same.qty += qty;
      else prop.storage.items.push({ type:'raw', name:item, qty });
      setOwned(prop);

      return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.success).setTitle('➕ Don ajouté').setDescription(`**${qty}× ${item}** → **${prop.name}**`)]});
    }
  }
};
