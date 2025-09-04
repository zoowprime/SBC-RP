// src/auto.js — Central autocomplete
const { listZones } = require('./utils/pricing');
const { db } = require('./utils/properties');
const { getBag } = require('./utils/harvest');
const { getIllegalType, recipeAllowed } = require('./utils/illegal');

const norm = (s) => (s||'').toString().trim().toLowerCase();
const matchFilter = (arr, q, map = x => x) => {
  const query = norm(q);
  return arr.filter(x => !query || norm(map(x)).includes(query)).slice(0,25);
};

function autoDrogueLieux(query) {
  const z = listZones();
  const raw = [
    ...z.weed.valid, ...z.meth.valid, ...z.coke.valid, ...z.crack.valid,
    'Mont Chiliad','Grapeseed','Rue de la Casse','Sandy Shores','Vinewood','Long Beach','Maze Bank Arena','Paleto',
  ];
  const uniq = [...new Set(raw)];
  return matchFilter(uniq, query).map(n => ({ name:n, value:n }));
}

function autoDrogueTypes(query) {
  return matchFilter(['weed','coke','meth','crack'], query).map(x=>({name:x,value:x}));
}

function autoOwnedIllegalProps(userId, query, filterType = null) {
  const store = db();
  const mine = (store.owned || []).filter(p => p.ownerId === userId);
  const arr = mine
    .filter(p => !filterType || p.ptype === filterType)
    .map(p => ({ name: `[${p.id}] ${p.name}${p.ptype?` (${p.ptype})`:''}`, value: p.id }));
  return matchFilter(arr, query, x=>x.name);
}

function autoSacItems(userId, query) {
  const bag = getBag(userId);
  const keys = Object.keys(bag).filter(k => (bag[k]||0)>0);
  const arr = keys.map(k => ({ name:`${k} — ${bag[k]}`, value:k }));
  return matchFilter(arr, query, x=>x.name);
}

function autoRecettesForProperty(_propId, query) {
  const all = ['weed_pochon','weed_final','coke_poudre','coke_final','meth_pierre','meth_final','crack_roche','crack_final'];
  return matchFilter(all, query).map(x=>({name:x,value:x}));
}

function autoRecolteType(query) { return matchFilter(['weed','coke'], query).map(x=>({name:x,value:x})); }
function autoRecolteLieu(type, query) {
  const map = { weed:['Mont Chiliad','Chiliad','Mt Chiliad'], coke:['Grapeseed'] };
  return matchFilter(map[type]||[], query).map(x=>({name:x,value:x}));
}

function autoIllegalOrderItems(query) {
  const items = [
    { key:'jerrican_acide', label:'Jerrican d’Acide (METH)' },
    { key:'meth_liquide',   label:'Meth (liquide) (METH)' },
    { key:'bicarbonate',    label:'Bicarbonate (CRACK)' },
    { key:'crack_precurseur',label:'Précurseur Crack (CRACK)' },
  ];
  return matchFilter(items, query, x=>x.label).map(i=>({ name:i.label, value:i.key }));
}

module.exports = {
  autoDrogueLieux, autoDrogueTypes, autoOwnedIllegalProps, autoSacItems,
  autoRecettesForProperty, autoRecolteType, autoRecolteLieu, autoIllegalOrderItems,
};
