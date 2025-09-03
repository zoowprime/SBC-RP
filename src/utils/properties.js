const { readJSON, writeJSON } = require('./store');

// properties.json:
// { listings:[{id,name,mode:'vente'|'location',price,image,contactId}],
//   owned:[{id,ownerId,name,access:[{userId,rights:['view','deposit','withdraw']}],storage:{items:[]},rent:{active,agencyId,nextAt,weekly}}] }

function db() { return readJSON('properties.json', { listings: [], owned: [], _seq: 0 }); }
function save(data) { writeJSON('properties.json', data); }

function nextId(prefix='PR') {
  const data = db(); data._seq = (data._seq || 0) + 1; save(data);
  return `${prefix}-${String(data._seq).padStart(6,'0')}`;
}

const listListings = () => db().listings;
function addListing(l) { const d = db(); d.listings.push(l); save(d); return l; }
function removeListing(id) { const d = db(); const i = d.listings.findIndex(x=>x.id===id); if(i<0)return false; d.listings.splice(i,1); save(d); return true; }

function addOwned(p) { const d = db(); d.owned.push(p); save(d); return p; }
function findOwnedById(id) { return db().owned.find(p=>p.id===id) || null; }
function listOwnedByUser(userId) { return db().owned.filter(p => p.ownerId===userId || (p.access||[]).some(a=>a.userId===userId)); }
function setOwned(p) { const d = db(); const i = d.owned.findIndex(x=>x.id===p.id); if(i>=0)d.owned[i]=p; else d.owned.push(p); save(d); }

function canAccess(p, userId, right) {
  if (p.ownerId === userId) return true;
  const a = (p.access||[]).find(x=>x.userId===userId);
  return !!(a && a.rights.includes(right));
}
function totalStoredCount(p){ return (p.storage?.items||[]).reduce((s,it)=>s+(it.qty||0),0); }

module.exports = {
  db, save, nextId,
  listListings, addListing, removeListing,
  addOwned, findOwnedById, listOwnedByUser, setOwned,
  canAccess, totalStoredCount
};
