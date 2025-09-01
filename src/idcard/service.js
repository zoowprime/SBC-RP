require('dotenv').config({ path: './id.env' });
const fs = require('fs');
const path = require('path');

const { DATA_DIR = '/data' } = process.env;
const DIR  = path.join(DATA_DIR, 'ids');
const FILE = path.join(DIR, 'idcards.json');

function ensure() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify({ guilds: {} }, null, 2));
}
ensure();

function readStore() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { guilds: {} }; } }
function writeStore(s) { fs.writeFileSync(FILE, JSON.stringify(s, null, 2)); }
function ensureGuild(s, gid) { if (!s.guilds[gid]) s.guilds[gid] = { users: {} }; return s.guilds[gid]; }

function getCard(gid, uid) {
  const s = readStore(); const g = ensureGuild(s, gid);
  return g.users[uid] || null;
}
function setCard(gid, uid, updater) {
  const s = readStore(); const g = ensureGuild(s, gid);
  if (!g.users[uid]) g.users[uid] = { status: 'valid' };
  updater(g.users[uid]); writeStore(s); return g.users[uid];
}
function nextIdNumber(gid) {
  const y = new Date().getFullYear();
  const rand = Math.floor(Math.random()*90000)+10000;
  return `SBC-${y}-${rand}`;
}
function sanitize(t='') {
  return String(t).slice(0, 120).replace(/@everyone/g,'@\u200beveryone').replace(/@here/g,'@\u200bhere');
}

module.exports = { getCard, setCard, nextIdNumber, sanitize, DIR };
