// src/bot.js — SBC (CommonJS)
require('dotenv').config({ path: './id.env' });

const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const fs   = require('fs');
const path = require('path');

const {
  BOT_TOKEN, CLIENT_ID, GUILD_ID,
  DATA_DIR = '/data', LOG_CHANNEL_ID,
} = process.env;

if (!BOT_TOKEN) { console.error('❌ BOT_TOKEN manquant.'); process.exit(1); }

const client = new Client({
  intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers,
             GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent ],
});

// Logs
async function sendLog(msg) {
  console.log(msg);
  if (!LOG_CHANNEL_ID) return;
  try {
    const ch = await client.channels.fetch(LOG_CHANNEL_ID);
    if (ch?.isTextBased()) await ch.send(String(msg).slice(0,1900));
  } catch {}
}

// Événements SBC (existants)
require('./events/starterPack')(client);
require('./events/welcome.js')(client);
require('./events/qcmNoCmd')(client);
try { require('./events/candidature')(client); } catch {}

// Tickets
const { handleTicketInteraction, initTicketPanel } = require('./ticket');

// Autocomplete imports
const {
  autoDrogueLieux, autoDrogueTypes, autoOwnedIllegalProps,
  autoSacItems, autoRecettesForProperty, autoRecolteType,
  autoRecolteLieu, autoIllegalOrderItems,
} = require('./auto');
const { db } = require('./utils/properties');
const { getIllegalType, recipeAllowed } = require('./utils/illegal');

// Chargement des commandes
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const mod = require(path.join(commandsPath, file));
    if (mod?.data && mod?.execute) client.commands.set(mod.data.name, mod);
  }
  console.log(`🧩 ${client.commands.size} commande(s) chargée(s).`);
}

// Ready
client.once(Events.ClientReady, async () => {
  await sendLog(`✅ Connecté en tant que ${client.user.tag} • App: ${CLIENT_ID || 'N/A'} • Guild: ${GUILD_ID || 'N/A'}`);
  try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
  await initTicketPanel(client);

  // Debug propriétés au boot
  try {
    const pdb = db();
    console.log(`🏠 Propriétés: listings=${pdb.listings.length}, owned=${pdb.owned.length} (seq=${pdb.seq})`);
  } catch {}
});

// Router des interactions
client.on(Events.InteractionCreate, async (interaction) => {
  // Tickets
  await handleTicketInteraction(interaction);

  // ───────────── Autocomplete ─────────────
  if (interaction.isAutocomplete()) {
    try {
      const cmd = interaction.commandName;
      const focused = interaction.options.getFocused(true);
      let choices = [];

      if (cmd === 'drogue') {
        if (focused.name === 'type') choices = autoDrogueTypes(focused.value);
        else if (focused.name === 'lieu') choices = autoDrogueLieux(focused.value);
      }

      if (cmd === 'sac-de-recolte') {
        if (focused.name === 'item') choices = autoSacItems(interaction.user.id, focused.value);
        else if (focused.name === 'propriete_id') choices = autoOwnedIllegalProps(interaction.user.id, focused.value, null);
      }

      if (cmd === 'recolte') {
        if (focused.name === 'type') choices = autoRecolteType(focused.value);
        else if (focused.name === 'lieu') {
          const type = interaction.options.getString('type');
          choices = autoRecolteLieu(type, focused.value);
        }
      }

      if (cmd === 'traitement') {
        if (focused.name === 'propriete_id') choices = autoOwnedIllegalProps(interaction.user.id, focused.value, null);
        else if (focused.name === 'recette') {
          const propId = interaction.options.getString('propriete_id');
          if (propId) {
            const store = db();
            const prop = (store.owned || []).find(p => p.id === propId);
            const ptype = prop ? (prop.ptype || getIllegalType(prop)) : null;
            const all = ['weed_pochon','weed_final','coke_poudre','coke_final','meth_pierre','meth_final','crack_roche','crack_final'];
            const filtered = ptype ? all.filter(r => recipeAllowed(ptype, r)) : all;
            choices = filtered.filter(x => !focused.value || x.includes(focused.value.toLowerCase())).slice(0,25).map(x=>({name:x,value:x}));
          } else {
            choices = autoRecettesForProperty(null, focused.value);
          }
        }
      }

      if (cmd === 'commande-illegale') {
        if (focused.name === 'item') choices = autoIllegalOrderItems(focused.value);
        else if (focused.name === 'propriete_id') {
          const item = interaction.options.getString('item');
          const map = { jerrican_acide:'meth', meth_liquide:'meth', bicarbonate:'crack', crack_precurseur:'crack' };
          const filterType = map[item] || null;
          choices = autoOwnedIllegalProps(interaction.user.id, focused.value, filterType);
        }
      }

      await interaction.respond(choices);
    } catch (e) {
      try { await interaction.respond([]); } catch {}
    }
    return;
  }

  // ───────────── Pickers (sélecteurs propriétés / accès) ─────────────
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('PROP_PICK:')) {
    const action = interaction.customId.split(':')[1];
    const [propId] = interaction.values;
    try {
      if (action === 'stockage_ouvrir') {
        const mod = require('./commands/stockage');
        await mod.openFromPicker?.(interaction, propId);
      } else if (action === 'traitement_start') {
        const mod = require('./commands/traitement');
        await mod.startFromPicker?.(interaction, propId);
      } else if (action === 'sac_deposer') {
        const mod = require('./commands/sac-de-recolte');
        await mod.depositFromPicker?.(interaction, propId);
      } else if (action === 'propriete_access_panel') {
        const mod = require('./commands/propriete');
        await mod.panelFromPicker?.(interaction, propId);
      } else {
        await interaction.update({ content: 'Action inconnue.', components: [] }).catch(()=>{});
      }
    } catch (e) {
      await interaction.update({ content: 'Erreur interne.', components: [] }).catch(()=>{});
    }
    return;
  }

  if (interaction.isUserSelectMenu() && interaction.customId.startsWith('ACC_USER:')) {
    const propId = interaction.customId.split(':')[1];
    interaction.message._acc = interaction.message._acc || {};
    interaction.message._acc[propId] = interaction.values[0];
    return interaction.update({ content:`👤 Joueur sélectionné: <@${interaction.values[0]}>`, components:interaction.message.components, embeds:interaction.message.embeds });
  }
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ACC_RIGHTS:')) {
    const propId = interaction.customId.split(':')[1];
    interaction.message._acc = interaction.message._acc || {};
    interaction.message._acc[`${propId}:rights`] = interaction.values;
    return interaction.update({ content:`🔧 Droits: ${interaction.values.join(', ')}`, components:interaction.message.components, embeds:interaction.message.embeds });
  }
  if (interaction.isButton() && (interaction.customId.startsWith('ACC_APPLY:') || interaction.customId.startsWith('ACC_REMOVE:'))) {
    const propId = interaction.customId.split(':')[1];
    const state = interaction.message._acc || {};
    const userId = state[propId];
    const rights = state[`${propId}:rights`] || [];
    const isRemove = interaction.customId.startsWith('ACC_REMOVE:');

    const { findOwnedById, grantAccess, revokeAccess } = require('./utils/properties');
    const p = findOwnedById(propId);
    if (!p) return interaction.update({ content:'Propriété introuvable.', components:[], embeds:[] });
    if (interaction.user.id !== p.ownerId) return interaction.update({ content:'Seul le propriétaire peut gérer les accès.', components:[], embeds:[] });
    if (!userId) return interaction.reply({ content:'Sélectionne un joueur.', ephemeral:true });

    if (isRemove) {
      revokeAccess(propId, userId);
      return interaction.update({ content:`🗝️ Accès retiré pour <@${userId}>.`, components:[], embeds:[] });
    } else {
      if (!rights.length) return interaction.reply({ content:'Sélectionne au moins un droit.', ephemeral:true });
      grantAccess(propId, userId, rights);
      return interaction.update({ content:`✅ Accès appliqué: <@${userId}> (${rights.join(', ')})`, components:[], embeds:[] });
    }
  }

  // ───────────── Slash commands ─────────────
  if (interaction.isChatInputCommand()) {
    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) return interaction.reply({ content: '❓ Commande inconnue.', ephemeral: true }).catch(() => {});
    try { await cmd.execute(interaction, client); }
    catch (e) {
      console.error(`❌ /${interaction.commandName}:`, e?.message || e);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: '❗ Erreur.', ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content: '❗ Erreur.', ephemeral: true }).catch(() => {});
      }
    }
  }
});

client.login(BOT_TOKEN).then(()=>console.log('🚀 Bot en cours de connexion…'))
  .catch((e)=>{ console.error('❌ Login raté:', e?.message); process.exit(1); });

const shutdown = async (code = 0) => { try { await sendLog('🛑 Arrêt du bot…'); await client.destroy(); } catch {} process.exit(code); };
process.on('SIGINT',  () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('unhandledRejection', (r) => console.error('🚨 UnhandledRejection:', r));
process.on('uncaughtException', (e) => console.error('🔥 UncaughtException:', e));
