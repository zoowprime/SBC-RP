const fs = require('fs');
const path = require('path');
const { dataDir } = require('./paths');

function filePath(name) { return path.join(dataDir, name); }

function readJSON(name, fallback) {
  const p = filePath(name);
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, JSON.stringify(fallback, null, 2));
    return JSON.parse(JSON.stringify(fallback));
  }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error(`[store] JSON parse error on ${name}:`, e);
    return JSON.parse(JSON.stringify(fallback));
  }
}

function writeJSON(name, data) {
  const p = filePath(name);
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

module.exports = { readJSON, writeJSON, filePath };
