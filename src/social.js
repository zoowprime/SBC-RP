// src/social.js
require('dotenv').config({ path: './id.env' });
const fs = require('fs');
const path = require('path');

const { DATA_DIR = '/data' } = process.env;
const FILE = path.join(DATA_DIR, 'social.json');

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify({ guilds: {} }, null, 2));
}
ensureStore();

function readStore() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return { guilds: {} }; }
}
function writeStore(s) { fs.writeFileSync(FILE, JSON.stringify(s, null, 2)); }

function ensureGuild(store, guildId) {
  if (!store.guilds[guildId]) store.guilds[guildId] = { posts: {} }; // posts[messageId] = {...}
  return store.guilds[guildId];
}

function sanitize(text) {
  return String(text || '')
    .slice(0, 4000)
    .replace(/@everyone/g, '@\u200beveryone')
    .replace(/@here/g, '@\u200bhere');
}

function extractHashtags(text) {
  const m = sanitize(text).match(/#[\p{L}\p{N}_]+/gu) || [];
  return [...new Set(m.map(h => h.toLowerCase()))].slice(0, 25);
}

function createPost({ guildId, messageId, channelId, platform, authorId, caption, imageURL }) {
  const store = readStore();
  const g = ensureGuild(store, guildId);
  g.posts[messageId] = {
    guildId, channelId, messageId,
    platform, authorId,
    caption: sanitize(caption || ''),
    hashtags: extractHashtags(caption || ''),
    imageURL: imageURL || null,
    createdAt: Date.now(),
  };
  writeStore(store);
  return g.posts[messageId];
}

function getPost(guildId, messageId) {
  const g = ensureGuild(readStore(), guildId);
  return g.posts[messageId] || null;
}

function deletePost(guildId, messageId) {
  const store = readStore();
  const g = ensureGuild(store, guildId);
  if (g.posts[messageId]) { delete g.posts[messageId]; writeStore(store); return true; }
  return false;
}

function listUserPosts(guildId, userId, limit = 10) {
  const g = ensureGuild(readStore(), guildId);
  return Object.values(g.posts)
    .filter(p => p.authorId === userId)
    .sort((a,b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

function trendingHashtags(guildId, days = 7) {
  const g = ensureGuild(readStore(), guildId);
  const since = Date.now() - days*24*3600*1000;
  const count = {};
  for (const p of Object.values(g.posts)) {
    if (p.createdAt < since) continue;
    for (const h of p.hashtags) count[h] = (count[h] || 0) + 1;
  }
  return Object.entries(count).sort((a,b) => b[1]-a[1]).slice(0, 10);
}

function postLink(guildId, channelId, messageId) {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

module.exports = {
  sanitize, extractHashtags,
  createPost, getPost, deletePost,
  listUserPosts, trendingHashtags, postLink,
};
