// src/utils/pricing.js
const ZONES = {
  weed: { valid: ['rue de la casse','sandy shores'], range: [80,310],  offzoneMultiplier: 0.40 },
  meth: { valid: ['vinewood'],                        range: [410,580], offzoneMultiplier: 0.25 },
  coke: { valid: ['long beach'],                      range: [450,650], offzoneMultiplier: 0.30 },
  crack:{ valid: ['maze bank arena','paleto'],        range: [90,320],  offzoneMultiplier: 0.40 },
};

const ALIASES = {
  'casse': 'rue de la casse', 'maze': 'maze bank arena', 'paleto bay': 'paleto',
  'vespucci':'long beach','vespucci beach':'long beach',
  'sandy':'sandy shores','maze bank':'maze bank arena'
};

function norm(s){ return (s||'').toString().trim().toLowerCase(); }
function mapLocation(input){
  const n = norm(input);
  return ALIASES[n] || n;
}
function unitPrice(base, location){
  const cfg = ZONES[base]; if (!cfg) return { price:0, applied:'invalid' };
  const loc = mapLocation(location);
  const mid = Math.round((cfg.range[0]+cfg.range[1])/2);
  const valid = cfg.valid.includes(loc);
  const price = valid ? mid : Math.round(mid * cfg.offzoneMultiplier);
  return { price, applied: valid ? 'zone_valide':'hors_zone' };
}
function listZones(){
  const out = {};
  for (const [k,v] of Object.entries(ZONES)){
    out[k] = { label:k, valid:v.valid, range:v.range, off:v.offzoneMultiplier };
  }
  return out;
}
module.exports = { unitPrice, listZones, mapLocation };
