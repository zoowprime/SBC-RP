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
// 3.1) Autocomplete (imports)
const {
  autoDrogueLieux,
  autoDrogueTypes,
  autoOwnedIllegalProps,
  autoSacItems,
  autoRecettesForProperty, // (garde au cas où)
  autoRecolteType,
  autoRecolteLieu,
  autoIllegalOrderItems,
} = require('./auto');
const { db } = require('./utils/properties');
const { getIllegalType, recipeAllowed } = require('./utils/illegal');

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
/** Helper filtre/autocomplete générique */
function toChoices(list, query, getLabel = (x)=>x, getValue = (x)=>x) {
  const q = (query || '').toString().trim().toLowerCase();
  return list
    .filter(x => !q || getLabel(x).toLowerCase().includes(q))
    .slice(0, 25)
    .map(x => ({ name: getLabel(x), value: getValue(x) }));
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

  // ── Autocomplete ────────────────────────────────────────────────────────────
  if (interaction.isAutocomplete()) {
    try {
      const cmd = interaction.commandName;
      const focused = interaction.options.getFocused(true); // { name, value }
      let choices = [];

      // /drogue vendre → type, lieu
      if (cmd === 'drogue') {
        if (focused.name === 'type') {
          choices = autoDrogueTypes(focused.value);
        } else if (focused.name === 'lieu') {
          choices = autoDrogueLieux(focused.value);
        }
      }

      // /sac-de-recolte deposer|jeter → item ; deposer → propriete_id
      if (cmd === 'sac-de-recolte') {
        if (focused.name === 'item') {
          choices = autoSacItems(interaction.user.id, focused.value);
        } else if (focused.name === 'propriete_id') {
          choices = autoOwnedIllegalProps(interaction.user.id, focused.value, null);
        }
      }

      // /recolte demarrer → type & lieu (lieu dépend du type si déjà saisi)
      if (cmd === 'recolte') {
        if (focused.name === 'type') {
          choices = autoRecolteType(focused.value);
        } else if (focused.name === 'lieu') {
          const type = interaction.options.getString('type');
          choices = autoRecolteLieu(type, focused.value);
        }
      }

      // /traitement demarrer → propriete_id & recette (filtre par type si possible)
      if (cmd === 'traitement') {
        if (focused.name === 'propriete_id') {
          choices = autoOwnedIllegalProps(interaction.user.id, focused.value, null);
        } else if (focused.name === 'recette') {
          const propId = interaction.options.getString('propriete_id');
          if (propId) {
            const store = db();
            const prop = (store.owned || []).find(p => p.id === propId);
            const ptype = prop ? (prop.ptype || getIllegalType(prop)) : null;
            const all = [
              'weed_pochon','weed_final',
              'coke_poudre','coke_final',
              'meth_pierre','meth_final',
              'crack_roche','crack_final',
            ];
            const filtered = ptype ? all.filter(r => recipeAllowed(ptype, r)) : all;
            choices = toChoices(filtered, focused.value, x => x, x => x);
          } else {
            choices = autoRecettesForProperty(null, focused.value);
          }
        }
      }

      // /commande-illegale acheter → item + propriete_id (filtré par type selon item)
      if (cmd === 'commande-illegale') {
        if (focused.name === 'item') {
          choices = autoIllegalOrderItems(focused.value);
        } else if (focused.name === 'propriete_id') {
          const item = interaction.options.getString('item');
          const map = {
            jerrican_acide: 'meth',
            meth_liquide: 'meth',
            bicarbonate: 'crack',
            crack_precurseur: 'crack',
          };
          const filterType = map[item] || null;
          choices = autoOwnedIllegalProps(interaction.user.id, focused.value, filterType);
        }
      }

      await interaction.respond(choices);
    } catch (e) {
      console.error('⚠️ Autocomplete error:', e?.message || e);
      try { await interaction.respond([]); } catch {}
    }
    return;
  }

  // ── Slash-commands ──────────────────────────────────────────────────────────
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