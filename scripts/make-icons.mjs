// Renders the PWA PNGs from public/icons/icon.svg (the master). Run: npx -p playwright node scripts/make-icons.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
const b = await chromium.launch();
const p = await b.newPage();
const shot = async (size, scale, bleed, out) => {
  await p.setViewportSize({ width: size, height: size });
  const inner = svg.replace('<svg ', `<svg width="${size}" height="${size}" `);
  const body = bleed
    // maskable: full-bleed square, glyph scaled into the safe circle
    ? `<div style="width:${size}px;height:${size}px;background:linear-gradient(135deg,#ff9f43,#e8590c);display:flex;align-items:center;justify-content:center">${svg.replace('<svg ', `<svg width="${size * scale}" height="${size * scale}" `).replace(/<rect width="512" height="512" rx="116"[^>]*\/>/g, '')}</div>`
    : inner;
  await p.setContent(`<html><body style="margin:0;background:transparent">${body}</body></html>`);
  await p.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
};
const dir = new URL('../public/icons/', import.meta.url).pathname;
await shot(512, 1, false, dir + 'icon-512.png');
await shot(192, 1, false, dir + 'icon-192.png');
await shot(180, 1, false, dir + 'apple-touch-icon.png');
await shot(512, 0.8, true, dir + 'maskable-512.png');
await b.close();
