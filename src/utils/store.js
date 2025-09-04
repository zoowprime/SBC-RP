// src/utils/store.js
require('dotenv').config({ path: './id.env' });
const fs   = require('fs');
const path = require('path');

const { DATA_DIR = '/data' } = process.env;

// Assure le dossier persistant
function ensureDir(p) {
  try { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
  catch (e) { console.error('[store] ensureDir:', e?.message || e); }
}
ensureDir(DATA_DIR);

// Path helper
function fpath(name) {
  // on force un seul niveau, pas de sous-dossiers arbitraires
  return path.join(DATA_DIR, String(name));
}

// Ecriture atomique (temp + rename)
function writeFileAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, filePath);
}

// Lecture JSON (crée le fichier avec def si absent)
function readJSON(name, def = {}) {
  const file = fpath(name);
  try {
    if (!fs.existsSync(file)) {
      writeFileAtomic(file, JSON.stringify(def, null, 2));
      // petit backup initial
      try { fs.writeFileSync(file + '.bak', JSON.stringify(def, null, 2)); } catch {}
      return JSON.parse(JSON.stringify(def));
    }
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[store] readJSON ${name}:`, e?.message || e);
    // tentative de backup -> restore si valide
    try {
      const bak = fs.readFileSync(file + '.bak', 'utf8');
      return JSON.parse(bak);
    } catch {}
    return JSON.parse(JSON.stringify(def));
  }
}

// Ecriture JSON + backup
function writeJSON(name, object) {
  const file = fpath(name);
  try {
    writeFileAtomic(file, JSON.stringify(object, null, 2));
    // backup best-effort
    try { fs.writeFileSync(file + '.bak', JSON.stringify(object, null, 2)); } catch {}
  } catch (e) {
    console.error(`[store] writeJSON ${name}:`, e?.message || e);
  }
}

module.exports = {
  DATA_DIR,
  readJSON,
  writeJSON,
  fpath,
};