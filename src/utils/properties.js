// src/utils/properties.js
// Persistance des propriétés (listings + owned) — robuste, aucun reset au require
const { readJSON, writeJSON } = require('./store');

const FILE = 'properties.json';

// Format: { seq: number, listings: [], owned: [] }
function load() {
  const db = readJSON(FILE, { seq: 1, listings: [], owned: [] });
  if (typeof db.seq !== 'number') db.seq = 1;
  if (!Array.isArray(db.listings)) db.listings = [];
  if (!Array.isArray(db.owned)) db.owned = [];
  return db;
}
function save(db) { writeJSON(FILE, db); }

// ID helper
function nextId(prefix = 'PR') {
  const db = load();
  const id = `${prefix}${String(db.seq).padStart(5, '0')}`;
  db.seq += 1;
  save(db);
  return id;
}

// ───────────────────────────────────────────────────────────────────────────────
// LISTINGS (annonces agence)
function listListings() {
  const db = load();
  return db.listings.slice();
}
function addListing(listing /* {id?, name, mode, price, image?, contactId} */) {
  const db = load();
  const id = listing.id || nextId('AN'); // si pas fourni
  db.listings.push({ ...listing, id });
  save(db);
  return id;
}
function removeListing(id) {
  const db = load();
  db.listings = db.listings.filter(l => l.id !== id);
  save(db);
}

// ───────────────────────────────────────────────────────────────────────────────
// OWNED (propriétés acquises ou illégales)
function listOwned() {
  const db = load();
  return db.owned.slice();
}
function addOwned(p /* { id?, ownerId, name, access?, storage?, rent?, vendor?, ptype? } */) {
  const db = load();
  const id = p.id || nextId('PR');
  // valeur par défaut propre
  const entry = {
    id,
    ownerId: p.ownerId,
    name: p.name || id,
    access: Array.isArray(p.access) ? p.access : [],
    storage: p.storage && typeof p.storage === 'object' ? p.storage : { items: [] },
    rent: p.rent || null,
    vendor: !!p.vendor,
    ptype: p.ptype || null,  // weed|coke|meth|crack pour les sites illégaux
  };
  db.owned.push(entry);
  save(db);
  return id;
}
function findOwnedById(id) {
  const db = load();
  return db.owned.find(p => p.id === id) || null;
}
function setOwned(updated /* objet propriété complet */) {
  const db = load();
  const idx = db.owned.findIndex(p => p.id === updated.id);
  if (idx === -1) return false;
  // petite sanitation
  if (!updated.storage || typeof updated.storage !== 'object') updated.storage = { items: [] };
  if (!Array.isArray(updated.storage.items)) updated.storage.items = [];
  db.owned[idx] = updated;
  save(db);
  return true;
}
function removeOwned(id) {
  const db = load();
  db.owned = db.owned.filter(p => p.id !== id);
  save(db);
  return true;
}

// ───────────────────────────────────────────────────────────────────────────────
// Accès / droits
function grantAccess(propId, userId, rights /* array ex: ['voir','depôt','retrait'] */) {
  const p = findOwnedById(propId);
  if (!p) return false;
  p.access = p.access || [];
  const ex = p.access.find(a => a.userId === userId);
  if (ex) ex.rights = rights;
  else p.access.push({ userId, rights });
  return setOwned(p);
}
function revokeAccess(propId, userId) {
  const p = findOwnedById(propId);
  if (!p) return false;
  p.access = (p.access || []).filter(a => a.userId !== userId);
  return setOwned(p);
}

// ───────────────────────────────────────────────────────────────────────────────
// Exports
module.exports = {
  // bas niveau
  db: load,
  save,
  nextId,

  // listings
  listListings,
  addListing,
  removeListing,

  // owned
  listOwned,
  addOwned,
  findOwnedById,
  setOwned,
  removeOwned,

  // access helpers
  grantAccess,
  revokeAccess,
};