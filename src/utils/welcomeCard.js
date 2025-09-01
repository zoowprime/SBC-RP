// src/utils/welcomeCard.js
const fs   = require('fs');
const path = require('path');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

// (optionnel) si un jour tu veux une police custom :
// GlobalFonts.registerFromPath(path.resolve('src/assets/fonts/Montserrat-SemiBold.ttf'), 'Montserrat-SemiBold');

const VIOLET = '#9B59B6';
const GOLD   = '#FFCC00';

async function safeLoadImage(src) {
  try { return await loadImage(src); } catch { return null; }
}

async function generateCard({ username, avatarURL, memberCount, isWelcome = true }) {
  // 1) Choix du fond : local → URL env → dégradé
  const localBg = path.resolve(__dirname, '../assets/welcome_bg.png');
  let bg = null;
  if (fs.existsSync(localBg)) bg = await safeLoadImage(localBg);
  if (!bg && process.env.WELCOME_IMAGE_URL) bg = await safeLoadImage(process.env.WELCOME_IMAGE_URL);

  const width  = bg ? bg.width  : 1280;
  const height = bg ? bg.height : 720;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 2) Fond
  if (bg) {
    ctx.drawImage(bg, 0, 0, width, height);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, '#2c003e');
    g.addColorStop(1, '#191622');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  // 3) Titre
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 60px sans-serif';
  const title = isWelcome ? 'Bienvenue sur SBC RP !' : 'Au revoir...';
  ctx.fillText(title, width / 2, 20);

  // 4) Avatar (si on n’arrive pas à charger, on continue quand même)
  const avatarSize = 200;
  const ax = (width  - avatarSize) / 2;
  const ay = (height - avatarSize) / 2 - 10;
  const avatarImg = await safeLoadImage(avatarURL);
  if (avatarImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax + avatarSize/2, ay + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImg, ax, ay, avatarSize, avatarSize);
    ctx.restore();
  }

  // 5) Bas de carte
  ctx.fillStyle = GOLD;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText(`Vous êtes le membre n°${memberCount}`, width / 2, height - 20);

  return canvas.toBuffer('image/png');
}

module.exports = { generateCard };
