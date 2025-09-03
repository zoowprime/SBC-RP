// src/auto.js
// Gestion unique de toutes les suggestions (propriétés, lieux, items, recettes, etc.)

const { listZones } = require('./utils/pricing');
const { db } = require('./utils/properties');
const { getBag } = require('./utils/harvest');
const { getIllegalType, recipeAllowed } = require('./utils/illegal');

// helpers
const norm = (s) => (s || '').toString().trim().toLowerCase();
const matchFilter = (arr, query, map = (x) => x) => {
  const q = norm(query);
  return arr
    .filter((x) => !q || norm(map(x)).includes(q))
    .slice(0, 25); // Discord limite à 25
};

// --- LIEUX de vente (drogue)
function autoDrogueLieux(query) {
  const z = listZones();
  const raw = [
    ...z.weed.valid,
    ...z.meth.valid,
    ...z.coke.valid,
    ...z.crack.valid,
    // On peut garder des alias courants
    'Mont Chiliad', 'Grapeseed', 'Rue de la Casse', 'Sandy Shores',
    'Vinewood', 'Long Beach', 'Maze Bank Arena', 'Paleto',
  ];
  const uniq = [...new Set(raw)];
  return matchFilter(uniq, query).map((label) => ({ name: label, value: label }));
}

// --- TYPES de drogue
function autoDrogueTypes(query) {
  const types = ['weed', 'coke', 'meth', 'crack'];
  return matchFilter(types, query).map((x) => ({ name: x, value: x }));
}

// --- PROPRIÉTÉS illégales possédées par l’utilisateur (filtrables par type)
function autoOwnedIllegalProps(userId, query, filterType /* 'weed'|'coke'|'meth'|'crack'|null */) {
  const store = db();
  const mine = (store.owned || []).filter((p) => p.ownerId === userId);
  const items = mine
    .map((p) => ({ id: p.id, name: p.name || p.id, ptype: p.ptype || null }))
    .filter((p) => !filterType || (p.ptype === filterType))
    .map((p) => ({ name: `[${p.id}] ${p.name}${p.ptype ? ` (${p.ptype})` : ''}`, value: p.id }));
  return matchFilter(items, query, (x) => x.name);
}

// --- ITEMS du sac (pour /sac-de-recolte deposer & jeter)
function autoSacItems(userId, query) {
  const bag = getBag(userId);
  const keys = Object.keys(bag).filter((k) => (bag[k] || 0) > 0);
  const labels = keys.map((k) => `${k} — ${bag[k]}`);
  const choices = keys.map((k, i) => ({ name: labels[i], value: k }));
  return matchFilter(choices, query, (x) => x.name);
}

// --- RECETTES autorisées selon la propriété
function autoRecettesForProperty(propId, query) {
  // on ne lit pas la propriété ici (pas d’access aux options), le handler utilisera extra param
  // => on renverra toutes les recettes courantes et le handler pourra filtrer au minimum
  const all = [
    'weed_pochon','weed_final',
    'coke_poudre','coke_final',
    'meth_pierre','meth_final',
    'crack_roche','crack_final',
  ];
  return matchFilter(all, query).map((x) => ({ name: x, value: x }));
}

// --- TYPES de récolte et LIEUX de récolte
function autoRecolteType(query) {
  return matchFilter(['weed', 'coke'], query).map((x) => ({ name: x, value: x }));
}
function autoRecolteLieu(type, query) {
  const map = {
    weed: ['Mont Chiliad', 'Chiliad', 'Mt Chiliad'],
    coke: ['Grapeseed'],
  };
  const arr = map[type] || [];
  return matchFilter(arr, query).map((x) => ({ name: x, value: x }));
}

// --- ITEMS pour /commande-illegale acheter
function autoIllegalOrderItems(query) {
  const items = [
    { key: 'jerrican_acide', label: 'Jerrican d’Acide (METH)' },
    { key: 'meth_liquide', label: 'Meth (liquide) (METH)' },
    { key: 'bicarbonate', label: 'Bicarbonate (CRACK)' },
    { key: 'crack_precurseur', label: 'Précurseur Crack (CRACK)' },
  ];
  return matchFilter(items, query, (x) => x.label).map((i) => ({ name: i.label, value: i.key }));
}

module.exports = {
  autoDrogueLieux,
  autoDrogueTypes,
  autoOwnedIllegalProps,
  autoSacItems,
  autoRecettesForProperty,
  autoRecolteType,
  autoRecolteLieu,
  autoIllegalOrderItems,
};
