// src/utils/properties.js
// Persistance & gestion des propriétés (annonces, propriétés possédées, accès)

require('dotenv').config({ path: './id.env' });
const fs = require('fs');
const path = require('path');

const { DATA_DIR = '/data' } = process.env;

// ---------- Store ----------
const STORE_DIR  = DATA_DIR;
const STORE_FILE = path.join(STORE_DIR, 'properties.json');

function ensureStore() {
  if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
  if (!fs.existsSync(STORE_FILE)) {
    const init = { listings: [], owned: [], _seq: 0 };
    fs.writeFileSync(STORE_FILE, JSON.stringify(init, null, 2));
  }
}
function readStore() {
  try { ensureStore(); return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')); }
  catch (_) { return { listings: [], owned: [], _seq: 0 }; }
}
function writeStore(s) { ensureStore(); fs.writeFileSync(STORE_FILE, JSON.stringify(s, null, 2)); }

// ---------- Helpers ----------
function nextId(prefix = 'PR') {
  const s = readStore();
  s._seq = (s._seq || 0) + 1;
  const id = `${prefix}${String(s._seq).padStart(5, '0')}`;
  writeStore(s);
  return id;
}

// ---------- Listings (agence immo) ----------
function listListings() { return readStore().listings || []; }
function addListing(ad) { const s = readStore(); s.listings = s.listings || []; s.listings.push(ad); writeStore(s); }
function removeListing(id) { const s = readStore(); s.listings = (s.listings || []).filter(a => a.id !== id); writeStore(s); }

// ---------- Owned (propriétés) ----------
function getOwnedAll() { return readStore().owned || []; }
function setOwnedAll(arr) { const s = readStore(); s.owned = arr; writeStore(s); }
function addOwned(p) { const s = readStore(); s.owned = s.owned || []; s.owned.push(p); writeStore(s); }
function findOwnedById(id) { return (readStore().owned || []).find(p => p.id === id) || null; }
function setOwned(prop) { const s = readStore(); s.owned = (s.owned || []).map(p => p.id === prop.id ? prop : p); writeStore(s); }

// Renvoie les propriétés auxquelles un user a accès (owner OU invité)
function listAccessibleForUser(userId) {
  const all = getOwnedAll();
  const out = [];
  for (const p of all) {
    const isOwner = p.ownerId === userId;
    const guest = (p.access || []).some(a => a.userId === userId);
    if (isOwner || guest) {
      out.push({
        id: p.id,
        name: p.name || p.id,
        type: p.type || null, // "legal" | "illegal_weed" | "illegal_coke" | "illegal_meth" | "illegal_crack" | null
        role: isOwner ? 'propriétaire' : 'invité',
        rights: isOwner ? ['voir','depôt','retrait'] : ((p.access.find(a=>a.userId===userId)?.rights)||[]),
      });
    }
  }
  return out;
}
function listOwnedByUser(userId) { return (getOwnedAll() || []).filter(p => p.ownerId === userId); }

module.exports = {
  nextId,
  listListings, addListing, removeListing,
  getOwnedAll, addOwned, findOwnedById, setOwned, setOwnedAll,
  listAccessibleForUser, listOwnedByUser,
};
