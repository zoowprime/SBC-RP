// src/utils/pricing.js
const zones = {
  weed: { range:[80,310], valid:['Rue de la Casse','Sandy Shores'], off:0.40 },
  meth: { range:[410,580], valid:['Vinewood'], off:0.25 },
  coke: { range:[450,650], valid:['Long Beach'], off:0.30 },
  crack:{ range:[90,320],  valid:['Maze Bank Arena','Paleto'], off:0.40 },
};
function listZones(){ return zones; }
function randRange(min,max){ return Math.floor(min + Math.random()*(max-min+1)); }
function unitPrice(base, lieu) {
  const z = zones[base]; if(!z) return { price:0, applied:'invalid' };
  const inside = z.valid.map(s=>s.toLowerCase()).includes((lieu||'').toLowerCase());
  const basePrice = randRange(z.range[0], z.range[1]);
  return inside ? { price:basePrice, applied:'zone_valide' } : { price: Math.floor(basePrice * z.off), applied:'hors_zone' };
}
function mapLocation(l){ return l; }
module.exports = { listZones, unitPrice, mapLocation };
