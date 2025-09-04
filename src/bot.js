// src/bot.js — SBC (CommonJS)
require('dotenv').config({ path: './id.env' });

const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const fs   = require('fs');
const path = require('path');

const {
  BOT_TOKEN,
  CLIENT_ID,
  GUILD_ID,
  DATA_DIR = '/data',
  LOG_CHANNEL_ID,
} = process.env;

if (!BOT_TOKEN) { console.error('❌ BOT_TOKEN manquant.'); process.exit(1); }

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

async function sendLog(msg) {
  console.log(msg);
  if (!LOG_CHANNEL_ID) return;
  try {
    const ch = await client.channels.fetch(LOG_CHANNEL_ID);
    if (ch?.isTextBased()) await ch.send(String(msg).slice(0, 1900));
  } catch (_) {}
}

// Events custom (si absents, on ignore)
try { require('./events/starterPack')(client); } catch (_) {}
try { require('./events/welcome.js')(client); } catch (_) {}
try { require('./events/qcmNoCmd')(client); } catch (_) {}
try { require('./events/candidature')(client); } catch (_) {}

// Tickets
const { handleTicketInteraction, initTicketPanel } = require('./ticket');

// Chargement des commandes
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      const mod = require(path.join(commandsPath, file));
      if (mod?.data && mod?.execute) client.commands.set(mod.data.name, mod);
      else console.warn(`⚠️ Commande ignorée: ${file}`);
    } catch (e) {
      console.error(`❌ Erreur chargement ${file}:`, e?.message || e);
    }
  }
  console.log(`🧩 ${client.commands.size} commande(s) chargée(s).`);
}

// READY
client.once(Events.ClientReady, async () => {
  await sendLog(`✅ Connecté en tant que ${client.user.tag} • App: ${CLIENT_ID || 'N/A'} • Guild: ${GUILD_ID || 'N/A'}`);
  try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
  await initTicketPanel(client);
});

// ───────────────────────────────────────────────────────────────────────────────
//  AUTOCOMPLETE GLOBAL  (NOMS visibles, IDs sous le capot)
const { listAccessibleForUser } = require('./utils/properties');
const { getBag } = require('./utils/harvest');

const RECIPES = [
  { key:'weed_pochon', label:'Weed — 5× feuilles → 1 pochon (entrepôt weed)' },
  { key:'weed_final',  label:'Weed — 1 pochon → 1 weed (inventaire)' },
  { key:'coke_poudre', label:'Cocaïne — 3× feuilles → 1 poudre (entrepôt coke)' },
  { key:'coke_final',  label:'Cocaïne — 2× poudres → 1 pochon (inventaire)' },
  { key:'meth_pierre', label:'Meth — acide + liquide → 1 pierre (Brickade)' },
  { key:'meth_final',  label:'Meth — 2× pierres → 1 pochon (inventaire)' },
  { key:'crack_roche', label:'Crack — poudre + bicarbonate → 1 roche (petit labo)' },
  { key:'crack_final', label:'Crack — 2× roches → 1 pochon (inventaire)' },
];

client.on(Events.InteractionCreate, async (interaction) => {
  await handleTicketInteraction(interaction);

  // ---------- AUTOCOMPLETE ----------
  if (interaction.isAutocomplete()) {
    try {
      const focused = interaction.options.getFocused(true); // { name, value }
      const uid = interaction.user.id;

      // 1) propriete_id : liste des propriétés accessibles, affichage = NOM (renommé)
      if (focused.name === 'propriete_id') {
        const icon = (t) => {
          if (!t) return '🏠';
          if (t === 'legal') return '🏠';
          if (t.includes('weed')) return '🌿';
          if (t.includes('coke')) return '❄️';
          if (t.includes('meth')) return '⚗️';
          if (t.includes('crack')) return '💊';
          return '🏠';
        };

        const props = listAccessibleForUser(uid);
        const q = String(focused.value || '').toLowerCase();

        const choices = props
          .filter(p => !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
          .slice(0, 25)
          .map(p => ({
            // 👇 NOM AVANT, ID visible en petit entre crochets pour s’y retrouver
            name: `${icon(p.type)} ${p.name}  [${p.id}] — ${p.role}`,
            value: p.id, // valeur envoyée au bot = ID fiable
          }));

        return interaction.respond(choices);
      }

      // 2) item (sac-de-recolte) → items présents dans le sac
      if (interaction.commandName === 'sac-de-recolte' && focused.name === 'item') {
        const bag = getBag(uid);
        const entries = Object.entries(bag)
          .filter(([,qty]) => qty > 0)
          .map(([name, qty]) => ({ name: `${name} — x${qty}`, value: name }))
          .slice(0, 25);
        return interaction.respond(entries);
      }

      // 3) recette (traitement)
      if (interaction.commandName === 'traitement' && focused.name === 'recette') {
        const q = String(focused.value || '').toLowerCase();
        const choices = RECIPES
          .filter(r => !q || r.key.includes(q) || r.label.toLowerCase().includes(q))
          .slice(0, 25)
          .map(r => ({ name: r.label, value: r.key }));
        return interaction.respond(choices);
      }

      // par défaut
      return interaction.respond([]);
    } catch (e) {
      console.error('autocomplete error:', e?.message || e);
      try { await interaction.respond([]); } catch {}
      return;
    }
  }

  // ---------- SLASH COMMANDS ----------
  if (interaction.isChatInputCommand()) {
    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) return interaction.reply({ content: '❓ Commande inconnue.', ephemeral: true }).catch(() => {});
    try {
      await cmd.execute(interaction, client);
    } catch (e) {
      console.error(`❌ Erreur /${interaction.commandName}:`, e?.message || e);
      const payload = { content: '❗ Une erreur est survenue.', ephemeral: true };
      if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => {});
      else await interaction.reply(payload).catch(() => {});
    }
  }
});

client.login(BOT_TOKEN)
  .then(() => console.log('🚀 Bot en cours de connexion…'))
  .catch((e) => { console.error('❌ Login raté :', e?.message); process.exit(1); });

const shutdown = async (code = 0) => { try { await sendLog('🛑 Arrêt du bot…'); await client.destroy(); } catch (_) {} process.exit(code); };
process.on('SIGINT',  () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('unhandledRejection', (r) => console.error('🚨 UnhandledRejection:', r));
process.on('uncaughtException', (e) => console.error('🔥 UncaughtException:', e));
