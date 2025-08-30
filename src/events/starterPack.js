// src/events/starterPack.js
require('dotenv').config({ path: './id.env' });
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const fs   = require('fs');
const path = require('path');

// ⚙️ Économie SBC
const { getUser, setUser, VIOLET, fmt } = require('../economy');

// ───────────────────────────────────────────────────────────────────────────────
// Persistance des claims
const dataDir     = process.env.DATA_DIR || '/data';
const CLAIMS_PATH = path.join(dataDir, 'starterClaims.json');

function ensureDataDir() {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(CLAIMS_PATH)) fs.writeFileSync(CLAIMS_PATH, JSON.stringify({}), 'utf8');
  } catch {}
}
ensureDataDir();

function loadClaims() {
  try {
    return JSON.parse(fs.readFileSync(CLAIMS_PATH, 'utf8') || '{}');
  } catch {
    return {};
  }
}
function saveClaims(obj) {
  try {
    fs.writeFileSync(CLAIMS_PATH, JSON.stringify(obj, null, 2), 'utf8');
  } catch {}
}

// Anti double-clic simultané
const processing = new Set();

// ───────────────────────────────────────────────────────────────────────────────

module.exports = (client) => {
  client.once('ready', async () => {
    const chId = process.env.STARTER_PACK_CHANNEL;
    if (!chId) return console.error('STARTER_PACK_CHANNEL non défini');
    const ch = await client.channels.fetch(chId).catch(() => null);
    if (!ch || !ch.isTextBased()) return console.error('Salon Starter Pack introuvable / non textuel');

    // Eviter le doublon d’envoi du panel
    const fetched = await ch.messages.fetch({ limit: 50 }).catch(() => null);
    if (fetched?.some(m => m.embeds[0]?.title === '🎒 Starter Pack')) return;

    const embed = new EmbedBuilder()
      .setTitle('🎒 Starter Pack')
      .setColor(VIOLET)
      .setDescription(
        [
          'Bienvenue ! Clique sur le bouton ci-dessous pour récupérer ton pack de bienvenue :',
          `• **${fmt(1000)} $** en **💵 liquide (compte courant)**`,
          `• **${fmt(1000)} $** en **🏦 banque (compte courant)**`,
          '',
          '_Une seule fois. Après ton clic, ce salon devient caché pour toi._',
        ].join('\n')
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('starter_pack_claim')
        .setLabel('🎒 Récupérer mon starter pack')
        .setStyle(ButtonStyle.Success)
    );

    await ch.send({ embeds: [embed], components: [row] });
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() || interaction.customId !== 'starter_pack_claim') return;

    const channel = interaction.channel;
    const user    = interaction.user;
    const userId  = user.id;
    const guildId = interaction.guildId;
    const claimKey = `${guildId}:${userId}`; // unique par guilde

    if (processing.has(claimKey)) {
      return interaction.reply({ content: '⏳ Patiente, ta demande est en cours…', ephemeral: true });
    }
    processing.add(claimKey);

    try {
      const claims = loadClaims();
      if (claims[claimKey]) {
        return interaction.reply({ content: '⚠️ Tu as **déjà** pris le Starter Pack.', ephemeral: true });
      }

      // 1) Créditer l’économie : 1000$ liquide + 1000$ banque (compte courant)
      let data = getUser(guildId, userId);
      data.current.liquid += 1000;
      data.current.bank   += 1000;
      setUser(guildId, userId, (u) => {
        u.frozen  = data.frozen;
        u.current = data.current;
        u.business= data.business;
      });

      // 2) Marquer la claim
      claims[claimKey] = { claimedAt: Date.now() };
      saveClaims(claims);

      // 3) DM stylé
      const dmEmbed = new EmbedBuilder()
        .setColor(VIOLET)
        .setTitle('🎁 Starter Pack — SBC')
        .setDescription(
          [
            `Bienvenue, **${user.username}** !`,
            '',
            `Tu viens de recevoir :`,
            `• **${fmt(1000)} $** en 💵 **liquide (compte courant)**`,
            `• **${fmt(1000)} $** en 🏦 **banque (compte courant)**`,
            '',
            'Bonne aventure ✨',
          ].join('\n')
        );
      try { await user.send({ embeds: [dmEmbed] }); } catch {}

      // 4) Rendre le salon invisible pour ce joueur
      try {
        await channel.permissionOverwrites.edit(userId, { ViewChannel: false }, { reason: 'Starter Pack consommé' });
      } catch (e) {
        console.error('Impossible de masquer le salon pour', userId, e?.message);
      }

      // 5) Réponse de confirmation (discrète)
      await interaction.reply({
        content: `✅ Starter Pack récupéré ! Tu as reçu **${fmt(1000)} $** en liquide et **${fmt(1000)} $** en banque (compte courant). Regarde tes **MP** 📬`,
        ephemeral: true
      });
    } catch (err) {
      console.error('Erreur Starter Pack :', err);
      try {
        await interaction.reply({ content: '❗ Erreur. Réessaie plus tard.', ephemeral: true });
      } catch {}
    } finally {
      processing.delete(claimKey);
    }
  });
};
