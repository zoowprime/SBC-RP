// src/commands/recolte.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { setBag } = require('../utils/harvest');

const C = { primary:0x5865F2, success:0x57F287, warning:0xFEE75C, danger:0xED4245 };
const ZONES = { weed:['mont chiliad','chiliad','mt chiliad'], coke:['grapeseed'] };
function norm(s){ return (s||'').toString().trim().toLowerCase(); }
function zoneOk(type, lieu){ return (ZONES[type]||[]).includes(norm(lieu)); }

const SESS = new Map(); // userId -> { type, startAt, total, timer, chanId }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('recolte')
    .setDescription('Récolte en session (+2 toutes les 30s, Sac)')
    .addSubcommand(sc=>sc.setName('demarrer')
      .setDescription('Démarrer une session de récolte')
      .addStringOption(o=>o.setName('type').setDescription('weed|coke').setRequired(true).setAutocomplete(true))
      .addStringOption(o=>o.setName('lieu').setDescription('Choisis la zone de récolte').setRequired(true).setAutocomplete(true))
    )
    .addSubcommand(sc=>sc.setName('stop').setDescription('Stopper et afficher le récap')),

  async execute(interaction){
    const sub = interaction.options.getSubcommand();
    const uid = interaction.user.id;

    if (sub === 'demarrer'){
      const type = interaction.options.getString('type'); // weed|coke
      const lieu = interaction.options.getString('lieu');
      if (!zoneOk(type, lieu)){
        return interaction.reply({ embeds:[ new EmbedBuilder()
          .setColor(C.danger)
          .setTitle('⛔ Zone invalide')
          .setDescription(type==='weed' ? 'La weed se récolte au **Mont Chiliad**.' : 'La coca se récolte à **Grapeseed**.')
        ]});
      }
      if (SESS.has(uid)){
        return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.warning).setDescription('Tu as déjà une session en cours. Utilise **/recolte stop**.')]});
      }

      const startAt = Date.now();
      const msg = new EmbedBuilder()
        .setColor(C.primary)
        .setTitle('🌱 Récolte démarrée')
        .setDescription(`Type: **${type}** — zone: **${lieu}**\n+2 toutes les **30s**. Utilise **/recolte stop** pour terminer.`)
        .setFooter({ text:'Les matières vont dans ton Sac (non échangeable).' });
      await interaction.reply({ embeds:[msg] });

      const chanId = interaction.channelId;
      const timer = setInterval(async () => {
        const s = SESS.get(uid); if (!s) return;
        s.total += 2;
        setBag(uid, (b) => {
          if (type === 'weed') b.weed_feuille += 2;
          else b.coca_feuille += 2;
        });
        try {
          const ch = await interaction.client.channels.fetch(chanId);
          await ch.send({ embeds:[ new EmbedBuilder()
            .setColor(C.success)
            .setDescription(`➕ **+2** ${type==='weed'?'weed_feuille':'coca_feuille'} (total session: **${s.total}**)`)
          ]});
        } catch {}
      }, 30000);

      SESS.set(uid, { type, startAt, total:0, timer, chanId });
      return;
    }

    if (sub === 'stop'){
      const s = SESS.get(uid);
      if (!s) return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.warning).setDescription('Aucune session active.')]});
      clearInterval(s.timer);
      SESS.delete(uid);
      const dur = Math.max(1, Math.round((Date.now()-s.startAt)/1000));
      const e = new EmbedBuilder()
        .setColor(C.success)
        .setTitle('🛑 Récolte stoppée')
        .setDescription(`Type: **${s.type}**\nTotal récolté (ajouté au Sac): **${s.total}**\nDurée: **${dur}s**`)
        .setFooter({ text:'Dépose ensuite dans le bon entrepôt via /sac-de-recolte deposer.' });
      return interaction.reply({ embeds:[e] });
    }
  }
};