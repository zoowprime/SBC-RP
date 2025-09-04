// src/commands/drogue.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUserInv, setUserInv } = require('../utils/inventory');
const { unitPrice, listZones, mapLocation } = require('../utils/pricing');
const { readJSON, writeJSON } = require('../utils/store');
const { getUser, setUser } = require('../economy');

const C = { primary: 0x5865F2, success: 0x57F287, warning: 0xFEE75C, danger: 0xED4245 };

function loadQuota() { return readJSON('drug_sales.json', { users: {} }); }
function saveQuota(db) { writeJSON('drug_sales.json', db); }
function todayKey() { const d = new Date(); return [d.getUTCFullYear(), d.getUTCMonth()+1, d.getUTCDate()].join('-'); }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('drogue')
    .setDescription('Vente & tarifs des drogues')
    .addSubcommand(sc => sc.setName('tarifs').setDescription('Affiche les zones et barèmes de vente'))
    .addSubcommand(sc =>
      sc.setName('vendre')
        .setDescription('Vendre des pochons depuis ton inventaire')
        .addStringOption(o => o.setName('type').setDescription('weed|coke|meth|crack').setRequired(true).setAutocomplete(true))
        .addIntegerOption(o => o.setName('quantite').setDescription('Qté de pochons').setMinValue(1).setRequired(true))
        .addStringOption(o => o.setName('lieu').setDescription('Choisis un lieu de vente').setRequired(true).setAutocomplete(true))
    )
    .addSubcommand(sc => sc.setName('stop').setDescription('Stopper vente continue (placeholder)')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'tarifs') {
      const z = listZones();
      const e = new EmbedBuilder().setColor(C.primary).setTitle('📍 Tarifs & Zones (SBC Drogues)')
        .addFields(
          { name: 'Weed', value: `Zones valides: **${z.weed.valid.join('**, **')}**\nBarème: **${z.weed.range[0]}–${z.weed.range[1]} $** / pochon\nHors zone: ×${z.weed.off}` },
          { name: 'Méthamphétamine', value: `Zones valides: **${z.meth.valid.join('**, **')}**\nBarème: **${z.meth.range[0]}–${z.meth.range[1]} $** / pochon\nHors zone: ×${z.meth.off}` },
          { name: 'Cocaïne', value: `Zones valides: **${z.coke.valid.join('**, **')}**\nBarème: **${z.coke.range[0]}–${z.coke.range[1]} $** / pochon\nHors zone: ×${z.coke.off}` },
          { name: 'Crack', value: `Zones valides: **${z.crack.valid.join('**, **')}**\nBarème: **${z.crack.range[0]}–${z.crack.range[1]} $** / pochon\nHors zone: ×${z.crack.off}` },
        )
        .setFooter({ text: 'Vente limitée à 400 pochons / joueur / jour.' })
        .setTimestamp();
      return interaction.reply({ embeds: [e] });
    }

    if (sub === 'vendre') {
      const base = interaction.options.getString('type');
      const qty  = interaction.options.getInteger('quantite');
      const lieu = interaction.options.getString('lieu');

      if (!['weed','coke','meth','crack'].includes(base)) {
        return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.danger).setDescription('Type invalide.')]});
      }

      const qdb = loadQuota(); const k = todayKey();
      if (!qdb.users[interaction.user.id]) qdb.users[interaction.user.id] = {};
      const used = qdb.users[interaction.user.id][k] || 0;
      if (used + qty > 400) {
        const left = Math.max(0, 400 - used);
        return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.warning).setTitle('⏳ Limite journalière').setDescription(`Il te reste **${left}** pochon(s) aujourd’hui.`) ]});
      }

      const inv = getUserInv(interaction.user.id);
      const lines = inv.items.filter(i => i.type === 'drug_final' && i.base === base);
      const totalHave = lines.reduce((a,b) => a + b.qty, 0);
      if (totalHave < qty) {
        return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.warning).setDescription(`Tu n’as que **${totalHave}** pochon(s) de **${base}**.`) ]});
      }

      const { price, applied } = unitPrice(base, lieu);
      if (price <= 0) return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.danger).setDescription('Lieu invalide.') ]});

      let remain = qty;
      for (const row of lines) { if (!remain) break; const take = Math.min(row.qty, remain); row.qty -= take; remain -= take; }
      inv.items = inv.items.filter(i => !(i.type==='drug_final' && i.base===base && i.qty<=0));
      setUserInv(interaction.user.id, inv);

      qdb.users[interaction.user.id][k] = used + qty; saveQuota(qdb);
      const total = price * qty;

      const econ = getUser(interaction.guildId, interaction.user.id);
      econ.current.liquid += total;
      setUser(interaction.guildId, interaction.user.id, (u)=>{ u.frozen=econ.frozen; u.current=econ.current; u.business=econ.business; });

      const e = new EmbedBuilder()
        .setColor(applied === 'zone_valide' ? C.success : C.warning)
        .setTitle('💰 Vente effectuée')
        .setDescription(`**${qty}** pochon(s) — **${base}**\nLieu: **${mapLocation(lieu)}** (${applied==='zone_valide' ? 'zone valide' : 'hors zone'})\nPrix unitaire: **${price}$** — Total: **${total}$**`)
        .setFooter({ text: `Quota du jour: ${qdb.users[interaction.user.id][k]}/400` })
        .setTimestamp();
      return interaction.reply({ embeds: [e] });
    }

    if (sub === 'stop') {
      return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.primary).setDescription('Pas de vente continue active.')] });
    }
  }
};
