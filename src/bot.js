// src/bot.js — SBC (CommonJS)
require('dotenv').config({ path: './id.env' });

const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const fs   = require('fs');
const path = require('path');

// ───────────────────────────────────────────────────────────────────────────────
// 0) Variables d’environnement
const {
  BOT_TOKEN,              // Token (Render/host ou id.env en local)
  CLIENT_ID,              // Optionnel (utile pour logs/déploiement)
  GUILD_ID,               // Optionnel (pour log)
  DATA_DIR = '/data',     // Dossier persistant (Render)
  LOG_CHANNEL_ID,         // Channel de logs (optionnel)
} = process.env;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN manquant. Ajoute-le dans les variables d’environnement.');
  process.exit(1);
}

// ───────────────────────────────────────────────────────────────────────────────
// 1) Client Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ───────────────────────────────────────────────────────────────────────────────
// 2) Utilitaires
async function sendLog(msg) {
  console.log(msg);
  if (!LOG_CHANNEL_ID) return;
  try {
    const ch = await client.channels.fetch(LOG_CHANNEL_ID);
    if (ch?.isTextBased()) await ch.send(String(msg).slice(0, 1900));
  } catch (_) { /* ignore */ }
}

// ───────────────────────────────────────────────────────────────────────────────
// 3) Événements globaux (spécifiques SBC)
require('./events/starterPack')(client);
require('./events/welcome.js')(client);
require('./events/qcmNoCmd')(client);
try {
  // facultatif si le fichier existe
  require('./events/candidature')(client);
} catch (_) {
  console.warn('ℹ️ events/candidature non chargé (fichier manquant ?)');
}

// Tickets (panel auto + handler interactions)
const { handleTicketInteraction, initTicketPanel } = require('./ticket');

// ───────────────────────────────────────────────────────────────────────────────
// 4) Chargement des commandes slash (src/commands/*.js)
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {
  const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      const mod = require(path.join(commandsPath, file));
      if (mod?.data && mod?.execute) {
        client.commands.set(mod.data.name, mod);
      } else {
        console.warn(`⚠️ Commande ignorée (structure invalide): ${file}`);
      }
    } catch (e) {
      console.error(`❌ Erreur au chargement de ${file}:`, e?.message || e);
    }
  }
  console.log(`🧩 ${client.commands.size} commande(s) chargée(s).`);
} else {
  console.log('ℹ️ Aucun dossier src/commands — skip.');
}

// ───────────────────────────────────────────────────────────────────────────────
// 5) Ready
client.once(Events.ClientReady, async () => {
  await sendLog(`✅ Connecté en tant que ${client.user.tag} • App: ${CLIENT_ID || 'N/A'} • Guild: ${GUILD_ID || 'N/A'}`);

  // DATA_DIR (persist)
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.warn('⚠️ Impossible de créer DATA_DIR :', DATA_DIR, e?.message);
  }

  // Panel Tickets (post unique / évite doublons)
  await initTicketPanel(client);
});

// ───────────────────────────────────────────────────────────────────────────────
// 6) Router des interactions
client.on(Events.InteractionCreate, async (interaction) => {
  // Tickets (selects + boutons) — ne renvoie rien si non concerné
  await handleTicketInteraction(interaction);

  // Slash-commands
  if (interaction.isChatInputCommand()) {
    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) {
      return interaction.reply({ content: '❓ Commande inconnue.', ephemeral: true }).catch(() => {});
    }
    try {
      await cmd.execute(interaction, client);
    } catch (e) {
      console.error(`❌ Erreur exécution /${interaction.commandName}:`, e?.message || e);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: '❗ Une erreur est survenue.', ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content: '❗ Une erreur est survenue.', ephemeral: true }).catch(() => {});
      }
    }
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// 7) Lancement
client.login(BOT_TOKEN)
  .then(() => console.log('🚀 Bot en cours de connexion…'))
  .catch((e) => { console.error('❌ Login raté :', e?.message); process.exit(1); });

// ───────────────────────────────────────────────────────────────────────────────
// 8) Arrêt propre
const shutdown = async (code = 0) => {
  try {
    await sendLog('🛑 Arrêt du bot…');
    await client.destroy();
  } catch (_) {}
  process.exit(code);
};
process.on('SIGINT',  () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('unhandledRejection', (r) => console.error('🚨 UnhandledRejection:', r));
process.on('uncaughtException', (e) => console.error('🔥 UncaughtException:', e));
