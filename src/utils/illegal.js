// src/utils/illegal.js
// Typage et règles d'acceptation / recettes autorisées
function getIllegalType(prop) { return prop?.ptype || null; } // weed|coke|meth|crack|null

function accepts(ptype, itemName) {
  const map = {
    weed: ['weed_feuille','weed_pochon'],
    coke: ['coca_feuille','coca_poudre'],
    meth: ['jerrican_acide','meth_liquide','meth_pierre'],
    crack:['coca_poudre','bicarbonate','crack_precurseur','crack_roche'],
  };
  return (map[ptype]||[]).includes(itemName);
}

function recipeAllowed(ptype, recipe) {
  const allowed = {
    weed: ['weed_pochon','weed_final'],
    coke: ['coke_poudre','coke_final'],
    meth: ['meth_pierre','meth_final'],
    crack:['crack_roche','crack_final'],
  };
  return (allowed[ptype]||[]).includes(recipe);
}

module.exports = { getIllegalType, accepts, recipeAllowed };
