// src/commands/traitement.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { findOwnedById, setOwned } = require('../utils/properties');
const { getIllegalType, recipeAllowed } = require('../utils/illegal');
const { getUserInv, setUserInv } = require('../utils/inventory');

const C = { primary:0x5865F2, success:0x57F287, warning:0xFEE75C, danger:0xED4245 };

// userId -> { pid, ptype, recipe, started, produced, timer, chanId }
const SESS = new Map();

function canConsume(pool, name, need) {
  const row = pool.find(i => (i.type==='raw'||i.type==='mid') && i.name===name);
  return !!row && row.qty >= need;
}
function consume(pool, name, need, prop) {
  const row = pool.find(i => (i.type==='raw'||i.type==='mid') && i.name===name);
  row.qty -= need;
  if (row.qty <= 0) prop.storage.items = pool.filter(x => x !== row);
}
function addMid(pool, name, qty) {
  const row = pool.find(i => i.type==='mid' && i.name===name);
  if (row) row.qty += qty; else pool.push({ type:'mid', name, qty });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('traitement')
    .setDescription('Sessions de traitement (30s/tick)')
    .addSubcommand(sc => sc.setName('demarrer')
      .setDescription('Démarrer une session de traitement')
      .addStringOption(o=>o.setName('propriete_id').setDescription('Choisis une propriété').setRequired(true).setAutocomplete(true))
      .addStringOption(o=>o.setName('recette').setDescription('Choisis une recette autorisée').setRequired(true).setAutocomplete(true))
    )
    .addSubcommand(sc => sc.setName('stop').setDescription('Arrêter la session & récap')),

  async execute(interaction){
    const sub = interaction.options.getSubcommand();
    const uid = interaction.user.id;

    if (sub === 'demarrer'){
      const pid = interaction.options.getString('propriete_id');
      const recipe = interaction.options.getString('recette');

      if (SESS.has(uid)) {
        return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.warning).setDescription('Tu as déjà une session en cours. Utilise **/traitement stop**.')]});
      }

      const prop = findOwnedById(pid);
      if (!prop) return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.danger).setDescription('Propriété introuvable.') ]});
      const ptype = getIllegalType(prop);
      if (!ptype) return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.danger).setDescription('Ce lieu n’est pas un site illégal reconnu (weed/coke/meth/crack).') ]});
      if (!recipeAllowed(ptype, recipe)) {
        return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.warning).setDescription(`Recette **${recipe}** non autorisée dans un site **${ptype}**.`)]});
      }
      const owner = prop.ownerId === uid;
      const can = owner || (prop.access||[]).some(a => a.userId===uid && (a.rights||[]).includes('voir'));
      if (!can) return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.danger).setDescription('Accès production refusé.')]});

      prop.storage = prop.storage || { items:[] };
      await interaction.reply({
        embeds:[ new EmbedBuilder()
          .setColor(C.primary)
          .setTitle('⚗️ Traitement démarré')
          .setDescription(`Site: **${prop.name}** *(type ${ptype})*\nRecette: **${recipe}**\nTick: **30 secondes**\nUtilise **/traitement stop** pour terminer.`)
          .setFooter({ text:`Propriété ${prop.id}` })
        ]
      });

      const chanId = interaction.channelId;
      const timer = setInterval(async () => {
        const p = findOwnedById(pid); if (!p) { clearInterval(SESS.get(uid)?.timer); SESS.delete(uid); return; }
        p.storage = p.storage || { items:[] };
        const items = p.storage.items;
        let ok = false;

        if (recipe === 'weed_pochon') {
          if (canConsume(items, 'weed_feuille', 5)) { consume(items, 'weed_feuille', 5, p); addMid(items, 'weed_pochon', 1); ok = true; }
        } else if (recipe === 'weed_final') {
          const row = items.find(i=>i.type==='mid' && i.name==='weed_pochon');
          if (row && row.qty >= 1) {
            row.qty -= 1; if (row.qty<=0) p.storage.items = items.filter(x=>x!==row);
            const inv = getUserInv(uid);
            const same = inv.items.find(i=>i.type==='drug_final' && i.base==='weed' && !i.custom);
            if (same) same.qty += 1; else inv.items.push({ type:'drug_final', name:'weed', base:'weed', custom:null, qty:1 });
            setUserInv(uid, inv); ok=true;
          }
        } else if (recipe === 'coke_poudre') {
          if (canConsume(items, 'coca_feuille', 3)) { consume(items, 'coca_feuille', 3, p); addMid(items, 'coca_poudre', 1); ok=true; }
        } else if (recipe === 'coke_final') {
          if (canConsume(items, 'coca_poudre', 2)) {
            consume(items, 'coca_poudre', 2, p);
            const inv = getUserInv(uid);
            const same = inv.items.find(i=>i.type==='drug_final' && i.base==='coke' && !i.custom);
            if (same) same.qty += 1; else inv.items.push({ type:'drug_final', name:'coke_pochon', base:'coke', custom:null, qty:1 });
            setUserInv(uid, inv); ok=true;
          }
        } else if (recipe === 'meth_pierre') {
          if (canConsume(items, 'jerrican_acide', 1) && canConsume(items, 'meth_liquide', 1)) {
            consume(items, 'jerrican_acide', 1, p);
            consume(items, 'meth_liquide', 1, p);
            addMid(items, 'meth_pierre', 1); ok=true;
          }
        } else if (recipe === 'meth_final') {
          if (canConsume(items, 'meth_pierre', 2)) {
            consume(items, 'meth_pierre', 2, p);
            const inv = getUserInv(uid);
            const same = inv.items.find(i=>i.type==='drug_final' && i.base==='meth' && !i.custom);
            if (same) same.qty += 1; else inv.items.push({ type:'drug_final', name:'meth_pochon', base:'meth', custom:null, qty:1 });
            setUserInv(uid, inv); ok=true;
          }
        } else if (recipe === 'crack_roche') {
          if (canConsume(items, 'coca_poudre', 1) && canConsume(items, 'bicarbonate', 1)) {
            consume(items, 'coca_poudre', 1, p);
            consume(items, 'bicarbonate', 1, p);
            addMid(items, 'crack_roche', 1); ok=true;
          }
        } else if (recipe === 'crack_final') {
          if (canConsume(items, 'crack_roche', 2)) {
            consume(items, 'crack_roche', 2, p);
            const inv = getUserInv(uid);
            const same = inv.items.find(i=>i.type==='drug_final' && i.base==='crack' && !i.custom);
            if (same) same.qty += 1; else inv.items.push({ type:'drug_final', name:'crack_pochon', base:'crack', custom:null, qty:1 });
            setUserInv(uid, inv); ok=true;
          }
        }

        if (ok) {
          const s = SESS.get(uid); if (s) s.produced = (s.produced||0) + 1;
          setOwned(p);
          try {
            const ch = await interaction.client.channels.fetch(chanId);
            await ch.send({ embeds:[ new EmbedBuilder().setColor(C.success).setDescription(`✅ +1 **${recipe}** (session: **${SESS.get(uid)?.produced || 0}**) — Site: **${p.name}**`) ]});
          } catch {}
        } else {
          clearInterval(SESS.get(uid)?.timer);
          SESS.delete(uid);
          try {
            const ch = await interaction.client.channels.fetch(chanId);
            await ch.send({ embeds:[ new EmbedBuilder().setColor(C.warning).setTitle('⛔ Session arrêtée (stock insuffisant)').setDescription(`Recette **${recipe}** — Site: **${p.name}**`)]});
          } catch {}
        }
      }, 30000);

      SESS.set(uid, { pid, ptype, recipe, started:Date.now(), produced:0, timer, chanId:interaction.channelId });
      return;
    }

    if (sub === 'stop'){
      const s = SESS.get(uid);
      if (!s) return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.warning).setDescription('Aucune session de traitement active.')]});
      clearInterval(s.timer); SESS.delete(uid);
      const dur = Math.max(1, Math.round((Date.now()-s.started)/1000));
      const prop = findOwnedById(s.pid);
      const e = new EmbedBuilder()
        .setColor(C.success)
        .setTitle('🛑 Traitement stoppé')
        .setDescription(
          `Site: **${prop?.name || s.pid}** *(type ${s.ptype})*\n` +
          `Recette: **${s.recipe}**\n` +
          `Total produit: **${s.produced}**\n` +
          `Durée: **${dur}s**`
        );
      return interaction.reply({ embeds:[e] });
    }
  }
};