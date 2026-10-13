// SPEC 20 — "contrast >= 4.5:1 on every card color".
// Parses styles/tokens.css and verifies each --card-*-fg against its -bg,
// for both the :root (light) and .dark blocks. Run: node scripts/check-contrast.mjs
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

function blockOf(selector) {
  const start = css.indexOf(selector + ' {');
  if (start === -1) throw new Error('missing block: ' + selector);
  const end = css.indexOf('\n}', start);
  return css.slice(start, end);
}

function vars(block) {
  const map = new Map();
  for (const [, name, value] of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6});/g)) {
    map.set(name, value);
  }
  return map;
}

const channel = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function ratio(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

let failures = 0;
for (const selector of [':root', '.dark']) {
  const map = vars(blockOf(selector));
  for (const [name, value] of map) {
    if (!name.endsWith('-fg')) continue;
    const bg = map.get(name.replace(/-fg$/, '-bg'));
    if (!bg) continue;
    const r = ratio(value, bg);
    const ok = r >= 4.5;
    if (!ok) failures++;
    console.log(
      `${ok ? 'PASS' : 'FAIL'} ${selector.padEnd(6)} ${name.replace(/-fg$/, '').padEnd(16)} ${r.toFixed(2)}:1`,
    );
  }
}
// Floor marks (13.7): the mark colour as text on a card tinted 8% with itself.
const mix = (fg, bg, t) =>
  '#' + [1, 3, 5].map((i) => Math.round(parseInt(fg.slice(i, i + 2), 16) * t + parseInt(bg.slice(i, i + 2), 16) * (1 - t)).toString(16).padStart(2, '0')).join('');
for (const selector of [':root', '.dark']) {
  const map = vars(blockOf(selector));
  const surface = map.get('surface');
  for (const [name, value] of map) {
    if (!name.startsWith('mark-')) continue;
    const r = ratio(value, mix(value, surface, 0.08));
    const ok = r >= 4.5;
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${selector.padEnd(6)} ${name.padEnd(16)} ${r.toFixed(2)}:1`);
  }
}
// Palettes (13.15): on-accent text on the accent, and the accent as text on
// the surface, in both modes; the warm/black backgrounds keep the text tokens.
for (const [, mode, name, body] of css.matchAll(/(:root|\.dark)\[data-palette='(\w+)'\]\s*\{([^}]*)\}/g)) {
  const accent = /--accent:\s*(#[0-9a-fA-F]{6})/.exec(body)?.[1];
  const base = vars(blockOf(mode));
  const pairs = [
    ['on-accent', base.get('on-accent'), accent],
    ['accent text', accent, base.get('surface')],
  ];
  for (const [what, fg, bg] of pairs) {
    const r = ratio(fg, bg);
    const ok = r >= 4.5;
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${mode.padEnd(6)} ${name.padEnd(7)} ${what.padEnd(12)} ${r.toFixed(2)}:1`);
  }
}
for (const [, mode, name, body] of css.matchAll(/(:root|\.dark)\[data-surface='(\w+)'\][^{]*\{([^}]*)\}/g)) {
  const base = vars(blockOf(mode));
  const surface = /--surface:\s*(#[0-9a-fA-F]{6})/.exec(body)?.[1];
  const bg = /--bg:\s*(#[0-9a-fA-F]{6})/.exec(body)?.[1];
  for (const [label, fg] of [['fg', base.get('fg')], ['fg-muted', base.get('fg-muted')], ['accent', base.get('accent')]]) {
    for (const back of [surface, bg]) {
      const r = ratio(fg, back);
      const ok = r >= 4.5;
      if (!ok) failures++;
      console.log(`${ok ? 'PASS' : 'FAIL'} ${mode.padEnd(6)} ${name.padEnd(7)} ${label.padEnd(12)} ${r.toFixed(2)}:1`);
    }
  }
}
console.log(failures === 0 ? '\nAll card colours meet 4.5:1.' : `\n${failures} failing pair(s).`);
process.exit(failures === 0 ? 0 : 1);
