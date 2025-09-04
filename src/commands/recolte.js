// src/commands/recolte.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { setBag } = require('../utils/harvest');

const C = { primary:0x5865F2, success:0x57F287, warning:0xFEE75C, danger:0xED4245 };
const ZONES = { weed:['mont chiliad','chiliad','mt chiliad','mont chiliad'], coke:['grapeseed'] };
const norm = s => (s||'').toString().trim().toLowerCase();
const zoneOk = (type, lieu) => (ZONES[type]||[]).includes(norm(lieu));

const SESS = new Map(); // uid -> { type, startAt, total, timer, chanId }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('recolte')
    .setDescription('Récolte (+2 toutes les 30s) vers le Sac')
    .addSubcommand(sc=>sc.setName('demarrer')
      .setDescription('Démarrer une session de récolte')
      .addStringOption(o=>o.setName('type').setDescription('weed|coke').setRequired(true).setAutocomplete(true))
      .addStringOption(o=>o.setName('lieu').setDescription('Zone de récolte').setRequired(true).setAutocomplete(true))
    )
    .addSubcommand(sc=>sc.setName('stop').setDescription('Stopper la session & récap')),

  async execute(interaction){
    const sub = interaction.options.getSubcommand();
    const uid = interaction.user.id;

    if (sub === 'demarrer'){
      const type = interaction.options.getString('type');
      const lieu = interaction.options.getString('lieu');
      if (!zoneOk(type, lieu)) {
        return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.danger).setTitle('⛔ Zone invalide').setDescription(type==='weed'?'Weed → **Mont Chiliad**':'Coke → **Grapeseed**') ]});
      }
      if (SESS.has(uid)) return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.warning).setDescription('Session en cours. Utilise **/recolte stop**.')]});

      await interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.primary).setTitle('🌱 Récolte démarrée').setDescription(`Type: **${type}** — zone: **${lieu}**\n+2 toutes les **30s**.\nUtilise **/recolte stop** pour terminer.`).setFooter({ text:'Les matières vont dans ton Sac (non échangeable).' }) ]});

      const chanId = interaction.channelId;
      const timer = setInterval(async () => {
        const s = SESS.get(uid); if (!s) return;
        s.total += 2;
        setBag(uid, (b)=>{ if(type==='weed') b.weed_feuille+=2; else b.coca_feuille+=2; });
        try {
          const ch = await interaction.client.channels.fetch(chanId);
          await ch.send({ embeds:[ new EmbedBuilder().setColor(C.success).setDescription(`➕ **+2** ${type==='weed'?'weed_feuille':'coca_feuille'} (total session: **${s.total}**)`) ]});
        } catch {}
      }, 30000);

      SESS.set(uid, { type, startAt:Date.now(), total:0, timer, chanId });
      return;
    }

    if (sub === 'stop'){
      const s = SESS.get(uid);
      if (!s) return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.warning).setDescription('Aucune session active.')]});
      clearInterval(s.timer); SESS.delete(uid);
      const dur = Math.max(1, Math.round((Date.now()-s.startAt)/1000));
      return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.success).setTitle('🛑 Récolte stoppée').setDescription(`Type: **${s.type}**\nTotal récolté: **${s.total}**\nDurée: **${dur}s**`).setFooter({ text:'Dépose ensuite dans le bon entrepôt via /sac-de-recolte deposer.' }) ]});
    }
  }
};
