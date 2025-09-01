
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../assets/data');
const vehiclesPath = path.join(dataDir, 'vehicles.json');
const alertsPath = path.join(dataDir, 'alerts.json');
const sequencePath = path.join(dataDir, 'sequence.json');
const vitrinePath = path.join(dataDir, 'vitrine.json');

function ensureFiles() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(vehiclesPath)) fs.writeFileSync(vehiclesPath, JSON.stringify([], null, 2));
  if (!fs.existsSync(alertsPath)) fs.writeFileSync(alertsPath, JSON.stringify([], null, 2));
  if (!fs.existsSync(sequencePath)) fs.writeFileSync(sequencePath, JSON.stringify({ vehicle: 0 }, null, 2));
  if (!fs.existsSync(vitrinePath)) fs.writeFileSync(vitrinePath, JSON.stringify({ items: [], expiresAt: 0 }, null, 2));
}
ensureFiles();

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function writeJSON(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

// ID generator: SBC-000123
function nextVehicleId() {
  const seq = readJSON(sequencePath);
  seq.vehicle = (seq.vehicle || 0) + 1;
  writeJSON(sequencePath, seq);
  return `SBC-${String(seq.vehicle).padStart(6, '0')}`;
}

function listVehicles(filter = {}) {
  const all = readJSON(vehiclesPath);
  return all.filter(v => {
    if (filter.marque && v.marque.toLowerCase() !== String(filter.marque).toLowerCase()) return false;
    if (filter.modele && v.modele.toLowerCase().includes(String(filter.modele).toLowerCase()) === false) return false;
    if (filter.categorie && v.categorie.toLowerCase() !== String(filter.categorie).toLowerCase()) return false;
    if (filter.etat && v.etat.toLowerCase() !== String(filter.etat).toLowerCase()) return false;
    if (filter.budget_min != null && v.prix < Number(filter.budget_min)) return false;
    if (filter.budget_max != null && v.prix > Number(filter.budget_max)) return false;
    if (filter.mot) {
      const m = String(filter.mot).toLowerCase();
      const txt = (v.marque + ' ' + v.modele + ' ' + (v.tags||[]).join(' ')).toLowerCase();
      if (!txt.includes(m)) return false;
    }
    if (filter.disponible === true && v.stock <= 0) return false;
    return true;
  });
}

function getVehicleById(id) {
  const all = readJSON(vehiclesPath);
  return all.find(v => v.id === id) || null;
}

function upsertVehicle(entry) {
  const all = readJSON(vehiclesPath);
  const i = all.findIndex(v => v.id === entry.id);
  if (i >= 0) all[i] = entry;
  else all.push(entry);
  writeJSON(vehiclesPath, all);
  return entry;
}

function removeVehicle(id) {
  const all = readJSON(vehiclesPath);
  const idx = all.findIndex(v => v.id === id);
  if (idx === -1) return false;
  all.splice(idx, 1);
  writeJSON(vehiclesPath, all);
  return true;
}

// Alerts
function listAlerts() { return readJSON(alertsPath); }
function addAlert(alert) {
  const all = readJSON(alertsPath);
  all.push(alert);
  writeJSON(alertsPath, all);
  return alert;
}
function removeAlert(userId, idx) {
  const all = readJSON(alertsPath);
  const mine = all.filter(a => a.userId === userId);
  if (idx < 0 || idx >= mine.length) return false;
  const globalIdx = all.findIndex(a => a === mine[idx]); // reference compare won't work; do safer
  // safer:
  let count = -1, target = -1;
  for (let i=0;i<all.length;i++){
    if (all[i].userId === userId) {
      count++;
      if (count === idx) { target = i; break; }
    }
  }
  if (target === -1) return false;
  all.splice(target, 1);
  writeJSON(alertsPath, all);
  return true;
}

// Vitrine
function getVitrine() { return readJSON(vitrinePath); }
function setVitrine(items, expiresAt) {
  writeJSON(vitrinePath, { items, expiresAt });
}

module.exports = {
  nextVehicleId,
  listVehicles,
  getVehicleById,
  upsertVehicle,
  removeVehicle,
  listAlerts,
  addAlert,
  removeAlert,
  getVitrine,
  setVitrine,
};
