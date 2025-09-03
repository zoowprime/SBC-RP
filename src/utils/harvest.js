const { readJSON, writeJSON } = require('./store');

function loadBags(){ return readJSON('harvest_bags.json', { users:{} }); }
function saveBags(db){ writeJSON('harvest_bags.json', db); }

function ensure(db, uid){
  if (!db.users[uid]) db.users[uid] = {
    weed_feuille: 0, coca_feuille: 0, coca_poudre: 0,
    jerrican_acide: 0, meth_liquide: 0
  };
  return db.users[uid];
}
function getBag(uid){ const db=loadBags(); const b=ensure(db,uid); saveBags(db); return b; }
function setBag(uid, fn){ const db=loadBags(); const b=ensure(db,uid); fn(b); saveBags(db); return b; }

module.exports = { getBag, setBag };
