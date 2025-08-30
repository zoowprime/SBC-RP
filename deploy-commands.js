// deploy-commands.js — publication des slash-commands (CommonJS, discord.js v14)
require('dotenv').config({ path: './id.env' });
const fs   = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const {
  BOT_TOKEN,   // token du bot (env du PC ou id.env)
  CLIENT_ID,   // application id du bot
  GUILD_ID,    // guilde de test (optionnelle pour déploiement rapide)
} = process.env;

// ───────────────────────────────────────────────────────────────────────────────
// 1) Lecture des flags CLI
//    --guild  => publie dans la guilde GUILD_ID
//    --global => publie globalement (dispo partout, propagation plus lente)
//    (par défaut: --guild si GUILD_ID présent, sinon --global)
const args = process.argv.slice(2);
const wantsGuild  = args.includes('--guild');
const wantsGlobal = args.includes('--global');

let mode = null;
if (wantsGuild && !GUILD_ID) {
  console.warn('⚠️ --guild demandé mais GUILD_ID est manquant. Bascule en global.');
}
if (wantsGlobal) mode = 'global';
else if (wantsGuild || GUILD_ID) mode = 'guild';
else mode = 'global';

// ───────────────────────────────────────────────────────────────────────────────
// 2) Sanity checks
if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN absent. Ajoute-le dans id.env ou tes variables d’environnement.');
  process.exit(1);
}
if (!CLIENT_ID) {
  console.error('❌ CLIENT_ID (Application ID) absent. Ajoute-le dans id.env.');
  process.exit(1);
}
if (mode === 'guild' && !GUILD_ID) {
  console.error('❌ GUILD_ID manquant pour un déploiement en guilde. Ajoute-le dans id.env ou utilise --global.');
  process.exit(1);
}

// ───────────────────────────────────────────────────────────────────────────────
// 3) Charge toutes les commandes depuis src/commands/*.js
const commandsDir = path.join(__dirname, 'src', 'commands');
let body = [];

if (fs.existsSync(commandsDir)) {
  const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const fullPath = path.join(commandsDir, file);
    const mod = require(fullPath);

    // Attendu: mod.data (SlashCommandBuilder) et mod.execute (fn)
    if (!mod?.data || !mod?.execute) {
      console.warn(`⚠️ Ignorée (structure invalide): ${file} (besoin de 'data' et 'execute')`);
      continue;
    }

    try {
      // SlashCommandBuilder → toJSON()
      const json = mod.data.toJSON();
      body.push(json);
    } catch (e) {
      console.warn(`⚠️ Impossible de sérialiser ${file}:`, e?.message || e);
    }
  }
} else {
  console.warn('⚠️ Dossier src/commands introuvable — aucune commande chargée.');
}

console.log(`🧩 ${body.length} commande(s) prête(s) à publier. Mode: ${mode}`);

// ───────────────────────────────────────────────────────────────────────────────
// 4) Publication via REST
const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

(async () => {
  try {
    console.log('🚀 Déploiement en cours…');

    let route;
    if (mode === 'guild') {
      route = Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID);
    } else {
      route = Routes.applicationCommands(CLIENT_ID);
    }

    // PUT = remplacement (idempotent). Pour supprimer toutes les commandes: body = []
    const result = await rest.put(route, { body });

    // Petit résumé
    const count = Array.isArray(result) ? result.length : 0;
    console.log(`✅ Publication OK (${count} commande(s)).`);

    if (mode === 'global') {
      console.log('⏳ Global: la propagation peut prendre quelques minutes.');
    } else {
      console.log(`🏷️ Guild: instantané sur la guilde ${GUILD_ID}.`);
    }
  } catch (err) {
    const msg = err?.message || String(err);
    console.error('❌ Échec de la publication :', msg);
    if (err?.rawError?.errors) {
      console.error('📄 Détails:', JSON.stringify(err.rawError.errors, null, 2));
    }
    process.exit(1);
  }
})();
