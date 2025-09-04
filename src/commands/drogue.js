// src/commands/drogue.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUserInv, setUserInv } = require('../utils/inventory');
const { fmtMoney } = require('../utils/items'); // si tu n'as pas fmtMoney, remplace par simple formatteur
const { setUser } = require('../economy');       // pour créditer cash courant.liquid

const C = { primary:0x5865F2, success:0x57F287, warning:0xFEE75C, danger:0xED4245 };

// Limite journalière par joueur
const DAILY_LIMIT = 400;
// mémoire simple en RAM : { 'guild:user:yyyymmdd': count }
const DAILY = new Map();

function todayKey(guildId, userId) {
  const now = new Date();
  const d = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  return `${guildId}:${userId}:${d}`;
}

// Barèmes
const BASE_PRICE = {
  weed: { min: 80, max: 310, validZones: ['maze_bank_arena', 'sandy'] },
  meth: { min: 410, max: 580, validZones: ['vinewood'] },
  coke: { min: 450, max: 650, validZones: ['long_beach'] },
  crack:{ min: 90,  max: 320, validZones: ['maze_bank_arena', 'paleto'] },
};
// Pénalités hors-zone
const PENALTY = {
  weed: 0.40,  // -60%
  meth: 0.25,  // -75%
  coke: 0.30,  // -70%
  crack:0.40,  // -60%
};

function pickPrice(base, zoneKey) {
  const inZone = base.validZones.includes(zoneKey);
  const raw = Math.floor(base.min + Math.random() * (base.max - base.min + 1));
  return { unit: raw, inZone };
}

function creditCash(guildId, userId, amount) {
  setUser(guildId, userId, (u) => { u.current.liquid += Math.trunc(amount); });
}

// util simple
function nf(v){ return new Intl.NumberFormat('fr-FR').format(v); }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('drogue')
    .setDescription('Vente de drogues')
    .addSubcommand(sc => sc.setName('vendre')
      .setDescription('Vendre des pochons depuis ton inventaire')
      .addStringOption(o => o.setName('type')
        .setDescription('Type de drogue')
        .addChoices(
          { name:'Weed', value:'weed' },
          { name:'Méthamphétamine', value:'meth' },
          { name:'Cocaïne', value:'coke' },
          { name:'Crack', value:'crack' },
        )
        .setRequired(true))
      .addIntegerOption(o => o.setName('quantite').setDescription('Quantité à vendre').setMinValue(1).setRequired(true))
      .addStringOption(o => o.setName('lieu')
        .setDescription('Zone de vente')
        .addChoices(
          { name:'Davis', value:'davis' },
          { name:'Vinewood', value:'vinewood' },
          { name:'Sandy Shores', value:'sandy' },
          { name:'Paleto', value:'paleto' },
          { name:'Long Beach (Vespucci)', value:'long_beach' },
          { name:'Maze Bank Arena (Rue de la Casse)', value:'maze_bank_arena' },
        )
        .setRequired(true))
    ),

  async execute(interaction){
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const uid = interaction.user.id;

    if (sub === 'vendre') {
      const baseType = interaction.options.getString('type');   // weed|meth|coke|crack
      const qty      = interaction.options.getInteger('quantite');
      const zone     = interaction.options.getString('lieu');

      // Limite journalière
      const key = todayKey(guildId, uid);
      const already = DAILY.get(key) || 0;
      if (already >= DAILY_LIMIT) {
        return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.warning).setDescription(`❌ Limite journalière atteinte (**${DAILY_LIMIT}** pochons).`)]});
      }
      const remaining = Math.max(0, DAILY_LIMIT - already);
      if (qty > remaining) {
        return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.warning).setDescription(`❌ Il te reste **${remaining}** pochons vendables aujourd’hui.`)]});
      }

      // Cherche les pochons finaux dans l’inventaire
      const inv = getUserInv(uid);
      const labelMap = {
        weed: { base:'weed', stdName:'weed' },
        meth: { base:'meth', stdName:'meth_pochon' },
        coke: { base:'coke', stdName:'coke_pochon' },
        crack:{ base:'crack',stdName:'crack_pochon' },
      };
      const wanted = labelMap[baseType];
      if (!wanted) return interaction.reply({ content:'Type invalide.', ephemeral:true });

      // un pochon final = type: 'drug_final' && base === baseType
      let stock = 0;
      for (const it of inv.items) {
        if (it.type === 'drug_final' && it.base === wanted.base) stock += it.qty;
      }
      if (stock < qty) {
        return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.warning).setDescription(`❌ Tu n’as que **${stock}** pochons **${baseType}** dans ton inventaire.`)]});
      }

      // Prix
      const base = BASE_PRICE[baseType];
      const p = pickPrice(base, zone);
      let unit = p.unit;
      if (!p.inZone) unit = Math.floor(unit * (PENALTY[baseType] || 1));

      const total = unit * qty;

      // Débiter l’inventaire (d’abord sur un item sans custom; puis si besoin, sur d’autres items base identique)
      let toRemove = qty;
      for (const it of inv.items) {
        if (toRemove <= 0) break;
        if (it.type === 'drug_final' && it.base === wanted.base) {
          const take = Math.min(it.qty, toRemove);
          it.qty -= take;
          toRemove -= take;
        }
      }
      inv.items = inv.items.filter(i => i.qty > 0);
      setUserInv(uid, inv);

      // Créditer liquide
      creditCash(guildId, uid, total);

      // Log & feedback
      const zoneLabel = {
        davis:'Davis', vinewood:'Vinewood', sandy:'Sandy Shores', paleto:'Paleto',
        long_beach:'Long Beach', maze_bank_arena:'Maze Bank Arena'
      }[zone] || zone;

      DAILY.set(key, already + qty);

      const inZoneTxt = p.inZone ? '✅ Zone **valide** (100%)' : '⚠️ Hors zone (pénalité)';
      const e = new EmbedBuilder()
        .setColor(C.success)
        .setTitle('💰 Vente effectuée')
        .setDescription(
          `Type: **${baseType}**\n` +
          `Zone: **${zoneLabel}** — ${inZoneTxt}\n` +
          `Tarif unitaire: **${nf(unit)} $**\n` +
          `Quantité: **${qty}**\n` +
          `Montant total: **${nf(total)} $** (crédité en 💵 liquide)`
        )
        .setFooter({ text: `Quota restant aujourd’hui: ${DAILY_LIMIT - (already + qty)} pochons` })
        .setTimestamp();

      return interaction.reply({ embeds:[e] });
    }
  }
};
