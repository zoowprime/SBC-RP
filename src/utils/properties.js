// src/utils/properties.js
const { readJSON, writeJSON } = require('./store');
const FILE = 'properties.json';

function load(){ const db = readJSON(FILE,{ seq:1, listings:[], owned:[] }); if(typeof db.seq!=='number') db.seq=1; if(!Array.isArray(db.listings)) db.listings=[]; if(!Array.isArray(db.owned)) db.owned=[]; return db; }
function save(db){ writeJSON(FILE, db); }
function nextId(prefix='PR'){ const db=load(); const id = `${prefix}${String(db.seq).padStart(5,'0')}`; db.seq+=1; save(db); return id; }

// Listings
function listListings(){ return load().listings.slice(); }
function addListing(listing){ const db=load(); const id=listing.id||nextId('AN'); db.listings.push({...listing,id}); save(db); return id; }
function removeListing(id){ const db=load(); db.listings=db.listings.filter(l=>l.id!==id); save(db); }

// Owned
function listOwned(){ return load().owned.slice(); }
function addOwned(p){ const db=load(); const id=p.id||nextId('PR'); const entry={ id, ownerId:p.ownerId, name:p.name||id, access:Array.isArray(p.access)?p.access:[], storage:p.storage&&typeof p.storage==='object'?p.storage:{items:[]}, rent:p.rent||null, vendor:!!p.vendor, ptype:p.ptype||null }; db.owned.push(entry); save(db); return id; }
function findOwnedById(id){ const db=load(); return db.owned.find(p=>p.id===id)||null; }
function setOwned(updated){ const db=load(); const idx=db.owned.findIndex(p=>p.id===updated.id); if(idx===-1) return false; if(!updated.storage||typeof updated.storage!=='object') updated.storage={items:[]}; if(!Array.isArray(updated.storage.items)) updated.storage.items=[]; db.owned[idx]=updated; save(db); return true; }
function removeOwned(id){ const db=load(); db.owned=db.owned.filter(p=>p.id!==id); save(db); return true; }

// Accès
function grantAccess(propId, userId, rights){ const p=findOwnedById(propId); if(!p) return false; p.access=p.access||[]; const ex=p.access.find(a=>a.userId===userId); if(ex) ex.rights=rights; else p.access.push({userId,rights}); return setOwned(p); }
function revokeAccess(propId, userId){ const p=findOwnedById(propId); if(!p) return false; p.access=(p.access||[]).filter(a=>a.userId!==userId); return setOwned(p); }

module.exports = { db:load, save, nextId, listListings, addListing, removeListing, listOwned, addOwned, findOwnedById, setOwned, removeOwned, grantAccess, revokeAccess };
