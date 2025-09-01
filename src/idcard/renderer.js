const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

function drawFittedText(ctx, text, x, y, baseSize, maxW, fontFamily, color, align='left') {
  let size = baseSize;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  while (size >= 10) {
    ctx.font = `${size}px "${fontFamily}"`;
    if (ctx.measureText(text).width <= maxW) break;
    size--;
  }
  ctx.fillText(text, x, y);
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr, y);
  ctx.arcTo(x+w, y, x+w, y+h, rr);
  ctx.arcTo(x+w, y+h, x, y+h, rr);
  ctx.arcTo(x, y+h, x, y, rr);
  ctx.arcTo(x, y, x+w, y, rr);
  ctx.closePath();
}

async function renderIdCard({ templatePath, data, outputPath }) {
  const tpl = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

  // fonts
  for (const f of Object.values(tpl.fonts || {})) {
    try { GlobalFonts.registerFromPath(path.resolve(f.file), f.name); } catch {}
  }

  const width  = tpl.size.width;
  const height = tpl.size.height;
  const canvas = createCanvas(width, height);
  const ctx    = canvas.getContext('2d');

  // background
  const bg = await loadImage(path.resolve(tpl.background));
  ctx.drawImage(bg, 0, 0, width, height);

  // photo
  if (data.photoUrl && tpl.photoSlot) {
    const slot = tpl.photoSlot;
    try {
      const img = await loadImage(data.photoUrl);
      const iw = img.width, ih = img.height;
      const scale = Math.max(slot.w/iw, slot.h/ih);
      const sw = Math.round(slot.w/scale), sh = Math.round(slot.h/scale);
      const sx = Math.round((iw - sw)/2), sy = Math.round((ih - sh)/2);
      if (slot.cornerRadius) {
        ctx.save();
        roundRect(ctx, slot.x, slot.y, slot.w, slot.h, slot.cornerRadius);
        ctx.clip();
      }
      ctx.drawImage(img, sx, sy, sw, sh, slot.x, slot.y, slot.w, slot.h);
      if (slot.cornerRadius) ctx.restore();
    } catch { /* ignore */ }
  }

  // fields
  for (const f of (tpl.fields || [])) {
    const val = (data[f.key] ?? '').toString().trim();
    if (!val) continue;
    const family = (tpl.fonts[f.font]?.name) || 'sans-serif';
    drawFittedText(ctx, val, f.x, f.y, f.size, f.maxW, family, f.color, f.align || 'left');
  }

  // badge
  if (tpl.badges && data.status) {
    const b = tpl.badges[data.status];
    if (b) {
      const family = (tpl.fonts[b.font]?.name) || 'sans-serif';
      drawFittedText(ctx, b.text, b.x, b.y, b.size, width, family, b.color, 'left');
    }
  }

  const buf = canvas.toBuffer('image/png');
  if (outputPath) fs.writeFileSync(outputPath, buf);
  return buf;
}

module.exports = { renderIdCard };
