// src/utils/harvest.js — Sac de récolte
const { readJSON, writeJSON } = require('./store');
const FILE = 'harvest_bags.json';

function load(){ const db = readJSON(FILE, { users:{} }); if(!db.users) db.users={}; return db; }
function save(db){ writeJSON(FILE, db); }

function getBag(userId){
  const db = load(); db.users[userId] = db.users[userId] || {
    weed_feuille:0, coca_feuille:0, coca_poudre:0, jerrican_acide:0, meth_liquide:0
  };
  save(db); return db.users[userId];
}
function setBag(userId, mutator){
  const db = load(); db.users[userId] = db.users[userId] || {
    weed_feuille:0, coca_feuille:0, coca_poudre:0, jerrican_acide:0, meth_liquide:0
  };
  mutator(db.users[userId]); save(db);
}

module.exports = { getBag, setBag };
