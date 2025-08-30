// src/bot.js
import dotenv from 'dotenv';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  Client,
  GatewayIntentBits,
  Collection,
  Partials,
  Events,
} from 'discord.js';

// ───────────────────────────────────────────────────────────────────────────────
// Résolution de chemin ESM (équivalent __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Charge id.env à la racine du projet (../id.env)
dotenv.config({ path: join(__dirname, '..', 'id.env') });

// ───────────────────────────────────────────────────────────────────────────────
// Variables d'environnement (IDs depuis id.env, token depuis Render)
const {
  BOT_TOKEN,                    // (Render uniquement)
  CLIENT_ID,
  GUILD_ID,
  DATA_DIR = '/data',
  LOG_CHANNEL_ID,               // optionnel
} = process.env;

// Sanity checks
if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN manquant. Ajoute-le dans les variables d’environnement Render (ou en local pour tester).');
  process.exit(1);
}
if (!CLIENT_ID || !GUILD_ID) {
  console.warn('⚠️ CLIENT_ID/GUILD_ID absents. Le bot peut démarrer, mais le déploiement de slash-commands pourra échouer.');
}

// Crée le dossier data si besoin
try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (e) {
  console.warn('⚠️ Impossible de créer DATA_DIR :', DATA_DIR, e?.message);
}

// ───────────────────────────────────────────────────────────────────────────────
// Client Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

// Petite aide log (envoie aussi dans LOG_CHANNEL_ID si présent)
async function sendLog(msg) {
  console.log(msg);
  if (!LOG_CHANNEL_ID) return;
  try {
    const ch = await client.channels.fetch(LOG_CHANNEL_ID);
    if (ch && ch.isTextBased()) await ch.send(String(msg).slice(0, 1900));
  } catch (_e) {/* ignore */}
}

// ───────────────────────────────────────────────────────────────────────────────
// Chargement des commandes (src/commands/*.js)
// Chaque commande doit exporter: `export const data = new SlashCommandBuilder(...); export async function execute(interaction) {}`
client.commands = new Collection();

async function loadCommands() {
  const commandsPath = join(__dirname, 'commands');
  if (!fs.existsSync(commandsPath)) return;

  const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
  for (const f of files) {
    try {
      const mod = await import(join(commandsPath, f));
      if (mod?.data && mod?.execute) {
        client.commands.set(mod.data.name, mod);
      } else {
        console.warn(`⚠️ Commande ignorée (structure invalide): ${f}`);
      }
    } catch (e) {
      console.error(`❌ Erreur chargement commande ${f}:`, e?.message);
    }
  }
  await sendLog(`🧩 ${client.commands.size} commande(s) chargée(s).`);
}

// ───────────────────────────────────────────────────────────────────────────────
// Chargement des événements (src/events/*.js)
// Chaque event doit exporter: `export const name='ready'; export const once=true|false; export async function execute(...args) {}`
async function loadEvents() {
  const eventsPath = join(__dirname, 'events');
  if (!fs.existsSync(eventsPath)) return;

  const files = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));
  for (const f of files) {
    try {
      const ev = await import(join(eventsPath, f));
      if (!ev?.name || !ev?.execute) {
        console.warn(`⚠️ Événement ignoré (structure invalide): ${f}`);
        continue;
      }
      if (ev.once) client.once(ev.name, (...args) => ev.execute(...args, client));
      else client.on(ev.name, (...args) => ev.execute(...args, client));
    } catch (e) {
      console.error(`❌ Erreur chargement event ${f}:`, e?.message);
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// Événements de base
client.once(Events.ClientReady, async () => {
  await sendLog(`✅ Connecté en tant que ${client.user.tag} • Guild: ${GUILD_ID || 'N/A'}`);
});

client.on(Events.Error, (e) => console.error('💥 Client error:', e));
client.on(Events.ShardError, (e) => console.error('🔻 Shard error:', e));
process.on('unhandledRejection', (r) => console.error('🚨 UnhandledRejection:', r));
process.on('uncaughtException', (e) => console.error('🔥 UncaughtException:', e));

// Router des slash-commands
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
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
});

// ───────────────────────────────────────────────────────────────────────────────
// Bootstrap
(async () => {
  await loadCommands();
  await loadEvents();
  await client.login(BOT_TOKEN);
})();

// Fermeture propre (utile sur Render)
const shutdown = async (code = 0) => {
  try {
    await sendLog('🛑 Arrêt du bot…');
    await client.destroy();
  } catch (_) {}
  process.exit(code);
};
process.on('SIGINT',  () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
