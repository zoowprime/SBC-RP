// src/bot.js (CommonJS) — style OTW, env à la SBC, logs démarrage/arrêt
require('dotenv').config({ path: './id.env' });
const { Client, GatewayIntentBits, Collection, MessageFlags, Events } = require('discord.js');
const fs   = require('fs');
const path = require('path');

// ───────────────────────────────────────────────────────────────────────────────
// 0) Variables d’environnement (IDs depuis id.env, token depuis l’hébergeur)
const {
  BOT_TOKEN,              // fourni par Render/host
  GUILD_ID,               // optionnel (pour log)
  DATA_DIR = '/data',     // optionnel (persist)
  LOG_CHANNEL_ID,         // optionnel (channel de logs)
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
// 2) Utilitaires de log
async function sendLog(msg) {
  console.log(msg);
  if (!LOG_CHANNEL_ID) return;
  try {
    const ch = await client.channels.fetch(LOG_CHANNEL_ID);
    if (ch?.isTextBased()) await ch.send(String(msg).slice(0, 1900));
  } catch (_) { /* ignore */ }
}

// ───────────────────────────────────────────────────────────────────────────────
// 3) Événements globaux (on ne garde QUE ceux qui existent pour SBC)
require('./events/welcome.js')(client);
require('./events/qcmNoCmd')(client);
require('./events/candidature')(client);

// ───────────────────────────────────────────────────────────────────────────────
// 4) Chargement des commandes slash (src/commands/*.js)
client.commands = new Collection();
const commandsPath  = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const mod = require(path.join(commandsPath, file));
    if (mod?.data && mod?.execute) {
      client.commands.set(mod.data.name, mod);
    } else {
      console.warn(`⚠️ Commande ignorée (structure invalide): ${file}`);
    }
  }
  console.log(`🧩 ${client.commands.size} commande(s) chargée(s).`);
}

// ───────────────────────────────────────────────────────────────────────────────
// 5) Démarrage / état du bot
client.once(Events.ClientReady, async () => {
  await sendLog(`✅ Connecté en tant que ${client.user.tag} • Guild: ${GUILD_ID || 'N/A'}`);

  // Optionnel : dossier persistant
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.warn('⚠️ Impossible de créer DATA_DIR :', DATA_DIR, e?.message);
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// 6) Router des interactions
client.on(Events.InteractionCreate, async (interaction) => {
  // Slash-commands
  if (interaction.isChatInputCommand()) {
    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) {
      return interaction.reply({ content: '❓ Commande inconnue.', ephemeral: true }).catch(() => {});
    }
    try {
      await cmd.execute(interaction, client);
    } catch (e) {
      console.error(`❌ Erreur exécution /${interaction.commandName}:`, e?.message);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: '❗ Une erreur est survenue.', ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content: '❗ Une erreur est survenue.', ephemeral: true }).catch(() => {});
      }
    }
    return;
  }

  // (ajoute ici d’autres routers quand tu crées des modules)
});

// ───────────────────────────────────────────────────────────────────────────────
// 7) Lancement
client.login(BOT_TOKEN)
  .then(() => console.log('🚀 Bot en cours de connexion…'))
  .catch((e) => { console.error('❌ Login raté :', e?.message); process.exit(1); });

// ───────────────────────────────────────────────────────────────────────────────
// 8) Arrêt propre (utile Render/hosting)
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
