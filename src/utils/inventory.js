const { readJSON, writeJSON } = require('./store');
const { displayName } = require('./items');

// Structure complète par joueur :
// {
//   liquide: number,
//   permits: string[],
//   items: [{ type, name, base?, custom?, qty, quality?, batch? }],  // food/water/soda/drug_final/...
//   weapons: [{ name, serial?, ammo? }],                              // saisie manuelle
//   vehicles: [{ model, plate?, insured? }]                           // saisie manuelle
// }
function loadInventories() { return readJSON('inventory.json', { users: {} }); }
function saveInventories(db) { writeJSON('inventory.json', db); }

function ensureUser(invDb, userId) {
  if (!invDb.users[userId]) {
    invDb.users[userId] = {
      liquide: 0,
      permits: [],
      items: [],
      weapons: [],
      vehicles: []
    };
  } else {
    // migrations légères si anciens champs manquants
    const u = invDb.users[userId];
    if (!Array.isArray(u.items)) u.items = [];
    if (!Array.isArray(u.permits)) u.permits = [];
    if (!Array.isArray(u.weapons)) u.weapons = [];
    if (!Array.isArray(u.vehicles)) u.vehicles = [];
    if (typeof u.liquide !== 'number') u.liquide = Number(u.liquide || 0);
  }
}

function getUserInv(userId) {
  const db = loadInventories();
  ensureUser(db, userId);
  saveInventories(db);
  return db.users[userId];
}
function setUserInv(userId, inv) {
  const db = loadInventories();
  db.users[userId] = inv;
  saveInventories(db);
}

// ---------- ITEMS (food/water/soda/drug_final/etc.)
function stackKey(it) {
  return JSON.stringify({
    type: it.type || 'item',
    name: it.name || null,
    base: it.base || null,
    custom: it.custom || null,
    quality: it.quality || null,
    batch: it.batch || null
  });
}
function addToInventory(userId, item) {
  const inv = getUserInv(userId);
  item.qty = Number(item.qty || 0);
  if (item.qty <= 0) return false;
  const key = stackKey(item);
  const idx = inv.items.findIndex(x => stackKey(x) === key);
  if (idx >= 0) inv.items[idx].qty += item.qty;
  else inv.items.push(item);
  setUserInv(userId, inv);
  return true;
}
function removeFromInventory(userId, item, qty) {
  const inv = getUserInv(userId);
  const key = stackKey(item);
  const idx = inv.items.findIndex(x => stackKey(x) === key);
  if (idx === -1 || inv.items[idx].qty < qty) return false;
  inv.items[idx].qty -= qty;
  if (inv.items[idx].qty === 0) inv.items.splice(idx, 1);
  setUserInv(userId, inv);
  return true;
}

// ---------- WEAPONS (manuel)
function addWeapon(userId, w) {
  const inv = getUserInv(userId);
  inv.weapons.push({ name: w.name, serial: w.serial || null, ammo: Number(w.ammo || 0) });
  setUserInv(userId, inv);
  return true;
}
function removeWeapon(userId, name, serial=null) {
  const inv = getUserInv(userId);
  const before = inv.weapons.length;
  inv.weapons = inv.weapons.filter(w => !(w.name.toLowerCase() === name.toLowerCase() && (serial ? w.serial === serial : true)));
  setUserInv(userId, inv);
  return inv.weapons.length < before;
}

// ---------- VEHICLES (manuel)
function addVehicle(userId, v) {
  const inv = getUserInv(userId);
  inv.vehicles.push({ model: v.model, plate: v.plate || null, insured: !!v.insured });
  setUserInv(userId, inv);
  return true;
}
function removeVehicle(userId, model, plate=null) {
  const inv = getUserInv(userId);
  const before = inv.vehicles.length;
  inv.vehicles = inv.vehicles.filter(vc => !(vc.model.toLowerCase() === model.toLowerCase() && (plate ? vc.plate === plate : true)));
  setUserInv(userId, inv);
  return inv.vehicles.length < before;
}

// ---------- Listing par catégories pour l'affichage
function listByCategory(userId) {
  const inv = getUserInv(userId);
  const cats = { Nourriture: [], Eau: [], Soda: [], Drogues: [], Autres: [] };
  for (const it of inv.items) {
    if (it.type === 'drug_final') cats.Drogues.push({ ...it, label: displayName(it) });
    else if (it.type === 'food') cats.Nourriture.push({ ...it, label: displayName(it) });
    else if (it.type === 'water') cats.Eau.push({ ...it, label: displayName(it) });
    else if (it.type === 'soda') cats.Soda.push({ ...it, label: displayName(it) });
    else cats.Autres.push({ ...it, label: displayName(it) });
  }
  return {
    cats,
    liquide: inv.liquide,
    permits: inv.permits,
    weapons: inv.weapons,
    vehicles: inv.vehicles
  };
}

module.exports = {
  loadInventories, saveInventories, getUserInv, setUserInv,
  addToInventory, removeFromInventory, listByCategory,
  addWeapon, removeWeapon, addVehicle, removeVehicle
};
