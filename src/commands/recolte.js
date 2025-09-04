// src/commands/recolte.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBag, setBag } = require('../utils/harvest');

const C = { primary:0x5865F2, success:0x57F287, warning:0xFEE75C, danger:0xED4245 };
const SESS = new Map(); // uid -> { type, lieu, started, total, timer, chanId }

const LIEUX = {
  weed: [
    { name: 'Mont Chiliad', value: 'mont_chiliad' },
  ],
  coke: [
    { name: 'Grapeseed', value: 'grapeseed' },
  ],
};

function addToBag(uid, key, qty) {
  setBag(uid, (b) => { b[key] = (b[key] || 0) + qty; });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('recolte')
    .setDescription('Récolte (30 sec → +2 items)')
    .addSubcommand(sc => sc.setName('demarrer')
      .setDescription('Démarrer une session de récolte')
      .addStringOption(o => o.setName('type')
        .setDescription('Type de récolte')
        .addChoices(
          { name: 'Weed', value: 'weed' },
          { name: 'Cocaïne', value: 'coke' },
        )
        .setRequired(true))
      .addStringOption(o => o.setName('lieu')
        .setDescription('Lieu de récolte')
        .addChoices(
          // on met tous les lieux, mais on validera côté code en fonction du type
          { name: 'Mont Chiliad (weed)', value: 'mont_chiliad' },
          { name: 'Grapeseed (cocaïne)', value: 'grapeseed' },
        )
        .setRequired(true))
    )
    .addSubcommand(sc => sc.setName('stop')
      .setDescription('Arrêter la récolte et afficher le récap')
    ),

  async execute(interaction){
    const sub = interaction.options.getSubcommand();
    const uid = interaction.user.id;

    if (sub === 'demarrer') {
      if (SESS.has(uid)) {
        return interaction.reply({ embeds:[new EmbedBuilder().setColor(C.warning).setDescription('Tu as déjà une session active. Utilise **/recolte stop**.')]});
      }
      const type = interaction.options.getString('type');   // weed | coke
      const lieu = interaction.options.getString('lieu');   // mont_chiliad | grapeseed

      // Validation type/lieu
      const okLieu = (type === 'weed' && lieu === 'mont_chiliad') ||
                     (type === 'coke' && lieu === 'grapeseed');
      if (!okLieu) {
        return interaction.reply({
          embeds:[ new EmbedBuilder()
            .setColor(C.warning)
            .setDescription("❌ Ce lieu n'est pas valide pour ce type de récolte.\n• **Weed** → Mont Chiliad\n• **Cocaïne** → Grapeseed")
          ]
        });
      }

      const label = type === 'weed' ? 'feuilles de weed' : 'feuilles de coca';
      const bagKey = type === 'weed' ? 'weed_feuille' : 'coca_feuille';

      SESS.set(uid, {
        type, lieu, started: Date.now(), total: 0, chanId: interaction.channelId,
        timer: setInterval(async () => {
          // +2 toutes les 30 secondes
          addToBag(uid, bagKey, 2);
          const s = SESS.get(uid); if (!s) return;
          s.total += 2;

          const minutes = Math.floor((Date.now() - s.started) / 60000);
          const seconds = Math.floor(((Date.now() - s.started) % 60000) / 1000);

          try {
            const ch = await interaction.client.channels.fetch(s.chanId);
            await ch.send({
              embeds: [ new EmbedBuilder()
                .setColor(C.success)
                .setDescription(`✅ Vous avez récolté **2 ${label}** (+ total **${s.total}**)\n⏱️ Temps: **${minutes}m ${seconds}s**`)
              ]
            });
          } catch {}
        }, 30000)
      });

      return interaction.reply({
        embeds:[ new EmbedBuilder()
          .setColor(C.primary)
          .setTitle('🌿 Récolte démarrée')
          .setDescription(`Type: **${type === 'weed' ? 'Weed' : 'Cocaïne'}**\nLieu: **${lieu === 'mont_chiliad' ? 'Mont Chiliad' : 'Grapeseed'}**\nTick: **30s** → **+2**\nUtilise **/recolte stop** pour arrêter.`)
          .setTimestamp()
        ]
      });
    }

    if (sub === 'stop') {
      const s = SESS.get(uid);
      if (!s) {
        return interaction.reply({ embeds:[ new EmbedBuilder().setColor(C.warning).setDescription('Aucune session active.')]});
      }
      clearInterval(s.timer);
      SESS.delete(uid);

      const durSec = Math.max(1, Math.round((Date.now() - s.started) / 1000));
      const m = Math.floor(durSec/60), sec = durSec%60;

      return interaction.reply({
        embeds:[ new EmbedBuilder()
          .setColor(C.success)
          .setTitle('🛑 Récolte stoppée')
          .setDescription(`Type: **${s.type === 'weed' ? 'Weed' : 'Cocaïne'}**\nLieu: **${s.lieu === 'mont_chiliad' ? 'Mont Chiliad' : 'Grapeseed'}**\nTotal récolté: **${s.total}**\nDurée: **${m}m ${sec}s**`)
        ]
      });
    }
  }
};
