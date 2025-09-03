// src/utils/illegal.js
function norm(s){ return (s||'').toString().trim().toLowerCase(); }

const NAME_HINTS = {
  weed: ['weed','herbe','cannabis'],
  coke: ['cocaïne','cocaine','coke','coca'],
  meth: ['brickade','meth','méthamph','6x6'],
  crack:['labo','crack','cuisine'],
};

function getIllegalType(prop){
  if (prop.ptype) return prop.ptype; // si tu stockes un type explicite, on le lit
  const n = norm(prop.name);
  for (const [k, hints] of Object.entries(NAME_HINTS)){
    if (hints.some(h => n.includes(h))) return k;
  }
  return null;
}

// Qu’un site accepte:
const ACCEPT = {
  weed: { raw:['weed_feuille'], mid:['weed_pochon'] },
  coke: { raw:['coca_feuille'],  mid:['coca_poudre'] },
  meth: { raw:['jerrican_acide','meth_liquide'], mid:['meth_pierre'] },
  crack:{ raw:['coca_poudre','bicarbonate','crack_precurseur'], mid:['crack_roche'] }
};
function accepts(propType, itemName){
  const a = ACCEPT[propType]; if (!a) return false;
  return a.raw.includes(itemName) || a.mid.includes(itemName);
}

// Recettes autorisées par site:
const ALLOWED_RECIPES = {
  weed: ['weed_pochon','weed_final'],
  coke: ['coke_poudre','coke_final'],
  meth: ['meth_pierre','meth_final'],
  crack:['crack_roche','crack_final'],
};
function recipeAllowed(propType, recipe){
  return (ALLOWED_RECIPES[propType] || []).includes(recipe);
}

module.exports = { getIllegalType, accepts, recipeAllowed };
