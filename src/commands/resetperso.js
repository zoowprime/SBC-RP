// src/commands/resetperso.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
require('dotenv').config({ path: './id.env' });

const fs   = require('fs');
const path = require('path');

const RED = 0xE74C3C;
const {
  STAFF_ROLE_ID,
  STARTER_PACK_CHANNEL,
  DATA_DIR = '/data',
} = process.env;

// Économie & inventaire (moteurs persistants existants)
const {
  getUser, setUser, fmt, logEconomy,
} = require('../economy');
const {
  setInv, buildInventoryEmbed, logInventory,
} = require('../inventory');

// Fichier de claims du Starter Pack (le même que l'event starterPack)
const CLAIMS_PATH = path.join(DATA_DIR, 'starterClaims.json');

function loadClaims() {
  try {
    if (!fs.existsSync(CLAIMS_PATH)) return {};
    return JSON.parse(fs.readFileSync(CLAIMS_PATH, 'utf8') || '{}');
  } catch {
    return {};
  }
}
function saveClaims(obj) {
  try {
    fs.mkdirSync(path.dirname(CLAIMS_PATH), { recursive: true });
    fs.writeFileSync(CLAIMS_PATH, JSON.stringify(obj, null, 2), 'utf8');
  } catch {}
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetperso')
    .setDescription('STAFF : reset complet d’un joueur (soldes + inventaire) et réactivation du Starter Pack.')
    .addUserOption(o => o.setName('target').setDescription('Joueur à réinitialiser').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison (optionnelle)').setRequired(false))
    .setDMPermission(false),

  async execute(interaction) {
    // Vérification Staff
    if (!interaction.member?.roles?.cache?.has(STAFF_ROLE_ID)) {
      return interaction.reply({ content: '❌ Réservé au staff.' });
    }

    const target = interaction.options.getUser('target', true);
    const reason = (interaction.options.getString('raison') || 'Aucune raison fournie')
      .replace(/@everyone/g, '@\u200beveryone')
      .replace(/@here/g, '@\u200bhere');

    const guildId = interaction.guildId;
    const userId  = target.id;

    // 1) RESET ÉCONOMIE : tous soldes = 0 (courant & entreprise)
    let econ = getUser(guildId, userId);
    econ.current.bank   = 0;
    econ.current.liquid = 0;
    econ.business.bank  = 0;
    econ.business.liquid= 0;

    setUser(guildId, userId, (u) => {
      u.frozen   = econ.frozen; // on ne touche pas à l’état gelé
      u.current  = econ.current;
      u.business = econ.business;
    });

    // 2) RESET INVENTAIRE : vider Voitures / Armes / Permis
    setInv(guildId, userId, (u) => {
      u.voitures = [];
      u.armes    = [];
      u.permis   = [];
    });

    // 3) RÉACTIVER STARTER PACK :
    //    - effacer la claim
    //    - réafficher le salon pour l’utilisateur
    const claimKey = `${guildId}:${userId}`;
    const claims = loadClaims();
    if (claims[claimKey]) {
      delete claims[claimKey];
      saveClaims(claims);
    }

    // réautoriser la vision du salon Starter Pack (si défini)
    let starterPackNote = '♻️ Starter Pack : prêt à re-claim.';
    if (STARTER_PACK_CHANNEL) {
      try {
        const ch = await interaction.client.channels.fetch(STARTER_PACK_CHANNEL).catch(() => null);
        if (ch?.isTextBased()) {
          await ch.permissionOverwrites.edit(userId, { ViewChannel: true }, { reason: 'Reset perso : réactivation Starter Pack' });
          starterPackNote = `♻️ Starter Pack : accès au salon restauré (<#${STARTER_PACK_CHANNEL}>) & claim réactivé.`;
        } else {
          starterPackNote = '♻️ Starter Pack : channel introuvable (ID invalide ?). Claim réactivé malgré tout.';
        }
      } catch (e) {
        starterPackNote = '♻️ Starter Pack : impossible de modifier les permissions du salon. Claim réactivé malgré tout.';
      }
    } else {
      starterPackNote = '♻️ Starter Pack : variable STARTER_PACK_CHANNEL non définie. Claim réactivé malgré tout.';
    }

    // Logs (optionnels)
    await logEconomy(interaction.client, `🧹 RESET PERSO — ${target.tag} par ${interaction.user.tag} • Raison: ${reason}`);
    await logInventory(interaction.client, `🧹 RESET INVENTAIRE — ${target.tag} par ${interaction.user.tag}`);

    // 4) Feedback Embed (public)
    const embed = new EmbedBuilder()
      .setColor(RED)
      .setTitle(`🧹 Reset perso pour ${target.tag}`)
      .setThumbnail(target.displayAvatarURL({ extension: 'png', size: 128 }))
      .addFields(
        {
          name: '💼 Comptes remis à zéro',
          value:
            `👤 Courant → 💵 0 • 🏦 0\n` +
            `🏢 Entreprise → 💵 0 • 🏦 0`,
          inline: false,
        },
        {
          name: '🗃️ Inventaire',
          value: 'Voitures, Armes, Permis : **vidés**.',
          inline: false,
        },
        {
          name: '🎒 Starter Pack',
          value: starterPackNote,
          inline: false,
        },
        {
          name: '📝 Raison',
          value: reason,
          inline: false,
        },
      )
      .setFooter({ text: 'SBC Modération • /resetperso' })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      allowedMentions: { parse: ['users'] },
    });
  }
};
