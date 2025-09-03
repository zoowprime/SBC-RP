// src/utils/properties.js
require('dotenv').config({ path: './id.env' });
const fs = require('fs');
const path = require('path');

const { DATA_DIR = '/data' } = process.env;

const ROOT_DIR   = path.join(DATA_DIR, 'properties');
const STORE_FILE = path.join(ROOT_DIR, 'properties.json');
// (optionnel) si tu stockes le contenu des coffres de propriété séparément :
const STORAGE_DIR = path.join(DATA_DIR, 'storage', 'properties');

function ensure() {
  try { if (!fs.existsSync(ROOT_DIR)) fs.mkdirSync(ROOT_DIR, { recursive: true }); } catch {}
  try { if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true }); } catch {}
  if (!fs.existsSync(STORE_FILE)) {
    const empty = { listings: [], owned: [] };
    try { fs.writeFileSync(STORE_FILE, JSON.stringify(empty, null, 2), 'utf8'); } catch {}
  }
}
ensure();

function readStore() {
  try { return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')); }
  catch { return { listings: [], owned: [] }; }
}
function writeStore(s) {
  try { fs.writeFileSync(STORE_FILE, JSON.stringify(s, null, 2), 'utf8'); } catch {}
}

function nextId(prefix = 'ID') {
  const n = Math.floor(Math.random() * 900000) + 100000;
  return `${prefix}-${n}`;
}

// ── ANNONCES
function listListings() {
  return readStore().listings || [];
}
function addListing(ad) {
  const s = readStore();
  s.listings = s.listings || [];
  s.listings.push(ad);
  writeStore(s);
}
function removeListing(id) {
  const s = readStore();
  s.listings = (s.listings || []).filter(a => a.id !== id);
  writeStore(s);
}

// ── PROPRIÉTÉS
function addOwned(p) {
  const s = readStore();
  s.owned = s.owned || [];
  s.owned.push(p);
  writeStore(s);
}
function findOwnedById(id) {
  const s = readStore();
  return (s.owned || []).find(x => x.id === id) || null;
}
function setOwned(updated) {
  const s = readStore();
  s.owned = (s.owned || []).map(x => (x.id === updated.id ? updated : x));
  writeStore(s);
}
function removeOwnedById(id) {
  const s = readStore();
  const before = (s.owned || []).length;
  s.owned = (s.owned || []).filter(x => x.id !== id);
  writeStore(s);

  // 🔐 si tu stockes un coffre par propriété dans un fichier, on le supprime aussi
  try {
    const file = path.join(STORAGE_DIR, `${id}.json`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {}

  return (before !== (s.owned || []).length);
}

module.exports = {
  nextId,
  listListings,
  addListing,
  removeListing,
  addOwned,
  findOwnedById,
  setOwned,
  removeOwnedById
};
