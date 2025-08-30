// src/economy.js
require('dotenv').config({ path: './id.env' });
const fs   = require('fs');
const path = require('path');

const {
  DATA_DIR = '/data',
  STAFF_ROLE_ID,
  BANQUIER_ROLE_ID,
  LOG_CHANNEL_ID,
} = process.env;

// ───────────────────────────────────────────────────────────────────────────────
// Persistance
const STORE_DIR  = DATA_DIR;
const STORE_FILE = path.join(STORE_DIR, 'economy.json');

function ensureStore() {
  try {
    if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
    if (!fs.existsSync(STORE_FILE)) fs.writeFileSync(STORE_FILE, JSON.stringify({ guilds: {} }, null, 2));
  } catch (e) {
    console.error('economy.ensureStore error:', e?.message || e);
  }
}
ensureStore();

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  } catch (e) {
    console.error('economy.readStore error:', e?.message || e);
    return { guilds: {} };
  }
}
function writeStore(store) {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
  } catch (e) {
    console.error('economy.writeStore error:', e?.message || e);
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// Modèle
function emptyUser() {
  return {
    frozen: false, // gèle courant+entreprise (sauf liquide courant autorisé)
    current:   { liquid: 0, bank: 0 },   // compte courant
    business:  { liquid: 0, bank: 0 },   // compte entreprise
  };
}

function ensureUser(store, guildId, userId) {
  if (!store.guilds[guildId]) store.guilds[guildId] = { users: {} };
  if (!store.guilds[guildId].users[userId]) store.guilds[guildId].users[userId] = emptyUser();
  return store.guilds[guildId].users[userId];
}

function getUser(guildId, userId) {
  const store = readStore();
  return ensureUser(store, guildId, userId);
}
function setUser(guildId, userId, updaterFn) {
  const store = readStore();
  const u = ensureUser(store, guildId, userId);
  updaterFn(u);
  writeStore(store);
  return u;
}

// ───────────────────────────────────────────────────────────────────────────────
// Helpers
const VIOLET = 0x9B59B6;

function fmt(n) {
  try {
    return new Intl.NumberFormat('fr-FR').format(Math.trunc(n));
  } catch {
    return String(n);
  }
}

function totals(u) {
  return {
    current:   { liquid: u.current.liquid, bank: u.current.bank,   total: u.current.liquid + u.current.bank },
    business:  { liquid: u.business.liquid, bank: u.business.bank, total: u.business.liquid + u.business.bank },
    grand:     u.current.liquid + u.current.bank + u.business.liquid + u.business.bank,
  };
}

function accountKeyFromChoice(choice) {
  // "courant" | "entreprise"
  return choice === 'entreprise' ? 'business' : 'current';
}
function fieldFromChoice(choice) {
  // "banque" | "liquide"
  return choice === 'banque' ? 'bank' : 'liquid';
}

function canManage(interaction) {
  const m = interaction.member;
  return m?.roles?.cache?.has(STAFF_ROLE_ID) || m?.roles?.cache?.has(BANQUIER_ROLE_ID);
}
function isStaff(interaction) {
  return interaction.member?.roles?.cache?.has(STAFF_ROLE_ID);
}
function isBankerOrStaff(interaction) {
  return canManage(interaction);
}

// Débit depuis un compte (peut puiser sur bank puis liquid, ou l'inverse)
function debit(userData, account /*'current'|'business'*/, amount, opts = { bankFirst: true, liquidOnly: false }) {
  const acc = userData[account];
  if (amount < 0) return { ok: false, takenBank: 0, takenLiquid: 0, reason: 'Montant négatif' };

  let remaining = Math.trunc(amount);
  let takenBank = 0;
  let takenLiquid = 0;

  if (opts.liquidOnly) {
    const takeL = Math.min(acc.liquid, remaining);
    acc.liquid -= takeL;
    takenLiquid += takeL;
    remaining -= takeL;
  } else if (opts.bankFirst) {
    const takeB = Math.min(acc.bank, remaining);
    acc.bank -= takeB;
    takenBank += takeB;
    remaining -= takeB;

    if (remaining > 0) {
      const takeL = Math.min(acc.liquid, remaining);
      acc.liquid -= takeL;
      takenLiquid += takeL;
      remaining -= takeL;
    }
  } else {
    const takeL = Math.min(acc.liquid, remaining);
    acc.liquid -= takeL;
    takenLiquid += takeL;
    remaining -= takeL;

    if (remaining > 0) {
      const takeB = Math.min(acc.bank, remaining);
      acc.bank -= takeB;
      takenBank += takeB;
      remaining -= takeB;
    }
  }

  if (remaining > 0) {
    // rollback
    acc.bank   += takenBank;
    acc.liquid += takenLiquid;
    return { ok: false, takenBank: 0, takenLiquid: 0, reason: 'Fonds insuffisants' };
  }
  return { ok: true, takenBank, takenLiquid };
}

function credit(userData, account /*'current'|'business'*/, field /*'bank'|'liquid'*/, amount) {
  const acc = userData[account];
  acc[field] += Math.trunc(amount);
}

// Joli embed de compte
function buildAccountEmbed({ user, tag, data }) {
  const t = totals(data);
  const frozen = data.frozen;

  return {
    color: VIOLET,
    title: `💼 Comptes de ${tag}`,
    description: frozen ? '🧊 **Comptes gelés** : opérations limitées (voir règles).' : '✅ Comptes actifs.',
    fields: [
      {
        name: '👤 Compte courant',
        value:
          `💵 Liquide : **${fmt(t.current.liquid)}**\n` +
          `🏦 Banque : **${fmt(t.current.bank)}**\n` +
          `📊 Total  : **${fmt(t.current.total)}**`,
        inline: true,
      },
      {
        name: '🏢 Compte entreprise',
        value:
          `💵 Liquide : **${fmt(t.business.liquid)}**\n` +
          `🏦 Banque : **${fmt(t.business.bank)}**\n` +
          `📊 Total  : **${fmt(t.business.total)}**`,
        inline: true,
      },
      {
        name: '🧮 Total global',
        value: `**${fmt(t.grand)}**`,
        inline: false,
      }
    ],
    footer: { text: 'SBC Économie' }
  };
}

// Petits logs vers un salon si défini
async function logEconomy(client, text) {
  if (!LOG_CHANNEL_ID) return;
  try {
    const ch = await client.channels.fetch(LOG_CHANNEL_ID);
    if (ch?.isTextBased()) await ch.send(text.slice(0, 1900));
  } catch { /* ignore */ }
}

module.exports = {
  getUser,
  setUser,
  totals,
  accountKeyFromChoice,
  fieldFromChoice,
  debit,
  credit,
  VIOLET,
  fmt,
  canManage,
  isStaff,
  isBankerOrStaff,
  buildAccountEmbed,
  logEconomy,
};
