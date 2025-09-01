
// Barème interne SBC (économie hebdo réaliste)
const ranges = {
  "compacte": [5000, 12000],
  "berline": [12000, 25000],
  "pickup_suv": [20000, 40000],
  "muscle": [25000, 50000],
  "sport": [40000, 80000],
  "sport_plus": [80000, 120000],
  "supercar": [150000, 300000],
  "moto_basique": [3000, 8000],
  "moto_sport": [15000, 35000],
  "moto_elite": [50000, 120000],
  "luxe_special": [100000, 200000],
};

// Mapping modèle -> catégorie
const lookup = {
  "Bravado Buffalo STX": "sport",
  "Bravado Gauntlet Classic": "muscle",
  "Vapid Dominator": "muscle",
  "Banshee": "sport_plus",
  "Elegy RH8": "sport",
  "Coquette D10": "sport_plus",
  "Zentorno": "supercar",
  "Turismo R": "supercar",
  "Blista": "compacte",
  "Stanier": "berline",
  "Granger": "pickup_suv",
  "Bati 801": "moto_sport",
};

function estimatePrice(modelOrCategory, opts = {}) {
  let cat = ranges[modelOrCategory] ? modelOrCategory : lookup[modelOrCategory];
  if (!cat) cat = "berline"; // default
  const [min, max] = ranges[cat];
  // fine-tuning with options
  let price = Math.round((min + max) / 2);
  if (opts.etat === 'occasion') price = Math.round(price * 0.8);
  if (opts.rarete === 'collector') price = Math.round(price * 1.2);
  if (opts.promo) price = Math.round(price * 0.9);
  return { category: cat, min, max, price };
}

module.exports = { estimatePrice, ranges, lookup };
