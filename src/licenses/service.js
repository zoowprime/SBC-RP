// src/licenses/service.js
require('dotenv').config({ path: './id.env' });
const fs = require('fs');
const path = require('path');

const { DATA_DIR = '/data' } = process.env;
const DIR  = path.join(DATA_DIR, 'licenses');
const FILE = path.join(DIR, 'licenses.json');

function ensure() {
  try { if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true }); } catch {}
  try { if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify({ guilds: {} }, null, 2)); } catch {}
}
ensure();

function readStore() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { guilds: {} }; } }
function writeStore(s) { try { fs.writeFileSync(FILE, JSON.stringify(s, null, 2)); } catch {} }

function ensureGuild(s, gid) {
  if (!s.guilds[gid]) s.guilds[gid] = { users: {} };
  return s.guilds[gid];
}
function ensureUser(g, uid) {
  if (!g.users[uid]) g.users[uid] = { auto: null, moto: null, arme: null };
  return g.users[uid];
}

function sanitize(t = '') {
  return String(t).slice(0, 120).replace(/@everyone/g, '@\u200beveryone').replace(/@here/g, '@\u200bhere');
}

function getLicense(gid, uid, type) {
  const s = readStore(); const g = ensureGuild(s, gid); const u = ensureUser(g, uid);
  return u[type] || null;
}

function setLicense(gid, uid, type, updater) {
  const s = readStore(); const g = ensureGuild(s, gid); const u = ensureUser(g, uid);
  if (!u[type]) u[type] = { status: 'valid' };
  updater(u[type]);
  writeStore(s);
  return u[type];
}

function deleteLicense(gid, uid, type) {
  const s = readStore(); const g = ensureGuild(s, gid); const u = ensureUser(g, uid);
  if (!u[type]) return false;
  u[type] = null;
  writeStore(s);
  return true;
}

function nextNumber(type) {
  const now = new Date(); const y = now.getFullYear();
  const rand = Math.floor(Math.random() * 90000) + 10000;
  const tag = (type === 'auto') ? 'AUTO' : (type === 'moto' ? 'MOTO' : 'ARME');
  return `PERM-${tag}-${y}-${rand}`;
}

module.exports = {
  DIR,
  sanitize,
  getLicense,
  setLicense,
  deleteLicense,
  nextNumber,
};
