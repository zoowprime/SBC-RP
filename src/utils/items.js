const PRESET = {
  FOOD: ['burger', 'sandwich', 'biscuits', 'pizza', 'tacos'],
  WATER: ['eau', 'eau_petillante'],
  SODA: ['coca', 'sprite', 'boisson_gazeuse', 'alcoolisee'],
  PERMITS: ['cni', 'permis_conduire', 'permis_arme']
};

const DISPLAY = {
  burger: 'Burger', sandwich: 'Sandwich', biscuits: 'Biscuits',
  pizza: 'Pizza', tacos: 'Tacos',
  eau: 'Eau plate', eau_petillante: 'Eau pétillante',
  coca: 'Cola', sprite: 'Soda citron', boisson_gazeuse: 'Boisson gazeuse',
  alcoolisee: 'Boisson alcoolisée',
  cni: 'Carte d’identité', permis_conduire: 'Permis de conduire',
  permis_arme: 'Permis de port d’arme'
};

function displayName(item) {
  if (item.name && DISPLAY[item.name]) return DISPLAY[item.name];
  if (item.name) return item.name;
  return 'Item';
}

module.exports = { PRESET, DISPLAY, displayName };
