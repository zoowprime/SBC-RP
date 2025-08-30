// src/inventory.js
require('dotenv').config({ path: './id.env' });
const fs   = require('fs');
const path = require('path');

const {
  DATA_DIR = '/data',
  STAFF_ROLE_ID,
  LOG_CHANNEL_ID,
} = process.env;

// ───────────────────────────────────────────────────────────────────────────────
// Persistance
const STORE_DIR  = DATA_DIR;
const STORE_FILE = path.join(STORE_DIR, 'inventory.json');

function ensureStore() {
  try {
    if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
    if (!fs.existsSync(STORE_FILE)) fs.writeFileSync(STORE_FILE, JSON.stringify({ guilds: {} }, null, 2));
  } catch (e) {
    console.error('inventory.ensureStore error:', e?.message || e);
  }
}
ensureStore();

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  } catch (e) {
    console.error('inventory.readStore error:', e?.message || e);
    return { guilds: {} };
  }
}
function writeStore(store) {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
  } catch (e) {
    console.error('inventory.writeStore error:', e?.message || e);
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// Modèle
function emptyUser() {
  return {
    voitures: [], // 🚗
    armes:    [], // 🗡️
    permis:   [], // 🪪
  };
}
function ensureUser(store, guildId, userId) {
  if (!store.guilds[guildId]) store.guilds[guildId] = { users: {} };
  if (!store.guilds[guildId].users[userId]) store.guilds[guildId].users[userId] = emptyUser();
  return store.guilds[guildId].users[userId];
}
function getInv(guildId, userId) {
  const store = readStore();
  return ensureUser(store, guildId, userId);
}
function setInv(guildId, userId, updaterFn) {
  const store = readStore();
  const inv = ensureUser(store, guildId, userId);
  updaterFn(inv);
  writeStore(store);
  return inv;
}

// ───────────────────────────────────────────────────────────────────────────────
// Helpers
const BLACK = 0x000000;

const CAT_CHOICES = [
  { key: 'voitures', label: 'Voitures', emoji: '🚗' },
  { key: 'armes',    label: 'Armes',    emoji: '🗡️' },
  { key: 'permis',   label: 'Permis',   emoji: '🪪' },
];

function validCategory(key) {
  return CAT_CHOICES.find(c => c.key === key);
}
function sanitize(text) {
  return String(text)
    .trim()
    .slice(0, 128)
    .replace(/@everyone/g, '@\u200beveryone')
    .replace(/@here/g, '@\u200bhere');
}
function formatList(arr) {
  if (!arr || arr.length === 0) return '— Aucun —';
  return arr.map((v, i) => `• ${v}`).join('\n');
}
function buildInventoryEmbed({ tag, inv }) {
  const cats = CAT_CHOICES.map(c => ({
    name: `${c.emoji} ${c.label}`,
    value: formatList(inv[c.key]),
    inline: true,
  }));
  return {
    color: BLACK,
    title: `🗃️ Inventaire de ${tag}`,
    fields: cats,
    footer: { text: 'SBC Inventaire' },
    timestamp: new Date(),
  };
}
function isStaff(interaction) {
  return interaction.member?.roles?.cache?.has(STAFF_ROLE_ID);
}
async function logInventory(client, text) {
  if (!LOG_CHANNEL_ID) return;
  try {
    const ch = await client.channels.fetch(LOG_CHANNEL_ID);
    if (ch?.isTextBased()) await ch.send(text.slice(0, 1900));
  } catch { /* ignore */ }
}

module.exports = {
  BLACK,
  CAT_CHOICES,
  validCategory,
  sanitize,
  getInv,
  setInv,
  buildInventoryEmbed,
  isStaff,
  logInventory,
};
