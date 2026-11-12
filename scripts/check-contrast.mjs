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
for (const selector of [':root', '.dark', ".dark[data-theme='senja']"]) {
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
// Text on a solid danger fill (delete confirmations): `--on-danger` on `--danger`. White on the pale
// dark-mode danger was about 2:1 (3 Nov 2026).
for (const selector of [':root', '.dark', ".dark[data-theme='senja']"]) {
  const map = vars(blockOf(selector));
  const fg = map.get('on-danger');
  const bg = map.get('danger');
  if (!fg || !bg) continue;
  const r = ratio(fg, bg);
  const ok = r >= 4.5;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${selector.padEnd(6)} ${'on-danger on danger'.padEnd(21)} ${r.toFixed(2)}:1`);
}
// Accent text on its own selected tint (the active sidebar row, a selected list row): the accent at
// `--accent-soft`'s alpha over the surface. In Senja a 20% tint of the light accent left this at 4.0:1.
for (const selector of [':root', '.dark', ".dark[data-theme='senja']"]) {
  const block = blockOf(selector);
  const map = vars(block);
  const accent = map.get('accent');
  const surface = map.get('surface');
  const soft = block.match(/--accent-soft:\s*#([0-9a-fA-F]{6})([0-9a-fA-F]{2});/);
  if (!accent || !surface || !soft) continue;
  const alpha = parseInt(soft[2], 16) / 255;
  const tint = '#' + [0, 2, 4].map((i) => Math.round(parseInt(soft[1].slice(i, i + 2), 16) * alpha + parseInt(surface.slice(1 + i, 3 + i), 16) * (1 - alpha)).toString(16).padStart(2, '0')).join('');
  const r = ratio(accent, tint);
  const ok = r >= 4.5;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${selector.padEnd(6)} ${'accent on accent-soft'.padEnd(21)} ${r.toFixed(2)}:1`);
}
// Floor marks (13.7): the mark colour as text on a card tinted 8% with itself.
const mix = (fg, bg, t) =>
  '#' + [1, 3, 5].map((i) => Math.round(parseInt(fg.slice(i, i + 2), 16) * t + parseInt(bg.slice(i, i + 2), 16) * (1 - t)).toString(16).padStart(2, '0')).join('');
for (const selector of [':root', '.dark', ".dark[data-theme='senja']"]) {
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
// The SOAP float's tinted header (12 Nov 2026, `tintedHeader` in SoapFloat.tsx): red/green at 16% over
// the surface; the muted text there is --fg mixed 78% toward that tint, the chips a 6% wash. Text 4.5:1,
// the 45% border a visible edge (1.3:1, as for Senja's border).
for (const selector of [':root', '.dark', ".dark[data-theme='senja']"]) {
  const map = vars(blockOf(selector));
  for (const flag of ['note-red', 'note-green']) {
    const header = mix(map.get(flag), map.get('surface'), 0.16);
    const chip = mix(map.get(flag), map.get('surface'), 0.06);
    const pairs = [
      ['fg', map.get('fg'), header, 4.5],
      ['muted', mix(map.get('fg'), header, 0.78), header, 4.5],
      ['muted on chip', mix(map.get('fg'), header, 0.78), chip, 4.5],
      ['border', mix(map.get(flag), map.get('surface'), 0.45), header, 1.3],
    ];
    for (const [what, fg, bg, min] of pairs) {
      const r = ratio(fg, bg);
      const ok = r >= min;
      if (!ok) failures++;
      console.log(`${ok ? 'PASS' : 'FAIL'} ${selector.padEnd(6)} float ${flag.replace('note-', '')} ${what.padEnd(13)} ${r.toFixed(2)}:1`);
    }
  }
}
// The colour wheel (11 Nov 2026): every hue at the theme's --hue-l/--hue-c, as a mark (text on its 8% tint).
// Same OKLCH → sRGB as oklchHex in src/domain/floorList/marks.ts.
const oklchHex = (l, c, hue) => {
  const a = c * Math.cos((hue * Math.PI) / 180);
  const b = c * Math.sin((hue * Math.PI) / 180);
  const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const S = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S, -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S, -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S];
  return '#' + lin.map((v) => Math.min(1, Math.max(0, v))).map((x) => Math.round((x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055) * 255).toString(16).padStart(2, '0')).join('');
};
for (const selector of [':root', '.dark', ".dark[data-theme='senja']"]) {
  const block = blockOf(selector);
  const l = Number(/--hue-l:\s*([\d.]+)/.exec(block)?.[1]);
  const c = Number(/--hue-c:\s*([\d.]+)/.exec(block)?.[1]);
  const surface = vars(block).get('surface');
  if (!l || !c || !surface) {
    failures++;
    console.log(`FAIL ${selector} --hue-l/--hue-c missing`);
    continue;
  }
  let worst = Infinity;
  let at = 0;
  for (let hue = 0; hue < 360; hue += 5) {
    const fg = oklchHex(l, c, hue);
    const r = ratio(fg, mix(fg, surface, 0.08));
    if (r < worst) [worst, at] = [r, hue];
  }
  const ok = worst >= 4.5;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${selector.padEnd(6)} hue wheel (worst ${at}°) ${worst.toFixed(2)}:1`);
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
// Senja (26 Oct 2026): its text on its grounds, the accent as text and as a fill
// with its on-accent text, the status colours as text, and every accent palette
// as text on Senja's surface (palettes still apply on top of it).
{
  const senjaSel = ".dark[data-theme='senja']";
  const map = vars(blockOf(senjaSel));
  const dark = vars(blockOf('.dark'));
  const check = (what, fg, bg, min = 4.5) => {
    const r = ratio(fg, bg);
    const ok = r >= min;
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'} senja  ${what.padEnd(26)} ${r.toFixed(2)}:1`);
  };
  for (const ground of ['bg', 'surface', 'surface-raised']) {
    for (const text of ['fg', 'fg-muted', 'fg-faint', 'accent', 'danger', 'warn-strong', 'note-red', 'note-green', 'note-blue']) {
      check(`${text} on ${ground}`, map.get(text), map.get(ground));
    }
  }
  check('on-accent on accent', map.get('on-accent'), map.get('accent'));
  check('pemantauan', map.get('pemantauan-fg'), map.get('pemantauan-bg'));
  // Borders are not text: 1.3:1 keeps a hairline visible without a hard edge.
  check('border on surface', map.get('border'), map.get('surface'), 1.3);
  check('border-strong on surface', map.get('border-strong'), map.get('surface'), 2);
  // A card must stand off the ground it sits on, or the colours are lost.
  for (const key of Object.keys(Object.fromEntries(map)).filter((k) => /^card-step-\d+-bg$/.test(k))) {
    check(`${key} off bg`, map.get(key), map.get('bg'), 1.4);
  }
  for (const [, name, body] of css.matchAll(/\.dark\[data-palette='(\w+)'\]\s*\{([^}]*)\}/g)) {
    // A Senja-specific lift of the accent, when the palette needs one.
    const lift = new RegExp(`\\.dark\\[data-theme='senja'\\]\\[data-palette='${name}'\\]\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? body;
    const accent = /--accent:\s*(#[0-9a-fA-F]{6})/.exec(lift)?.[1];
    check(`palette ${name} text`, accent, map.get('surface'));
    check(`palette ${name} on-accent`, map.get('on-accent'), accent);
  }
  void dark;
}
// Chart series (Analisis, 28 Oct 2026): a mark needs 3:1 against the surface it is drawn on
// (the raised surface too, for the tooltip swatch), in every theme.
for (const selector of [':root', '.dark', ".dark[data-theme='senja']"]) {
  const map = vars(blockOf(selector));
  for (const series of ['chart-1', 'chart-2', 'chart-3']) {
    for (const ground of ['surface', 'surface-raised']) {
      const r = ratio(map.get(series), map.get(ground));
      const ok = r >= 3;
      if (!ok) failures++;
      console.log(`${ok ? 'PASS' : 'FAIL'} ${selector.padEnd(6)} ${series} on ${ground.padEnd(14)} ${r.toFixed(2)}:1`);
    }
  }
}
// Gaya kartu pasien (4 Nov 2026, Pengaturan → Tema). `netral` and `garis` paint the card on the
// surface instead of the pastel, so the card's text (and its 70% secondary text) must clear 4.5:1
// on the surface, on the netral identity band (`bg-subtle`) and on the garis band (the token
// accent at 12% over the surface). The garis edge is a 2 px non-text mark: 3:1 against the surface.
{
  const tokens = [...Array.from({ length: 12 }, (_, i) => `step-${i + 1}`), 'done', 'neutral'];
  for (const selector of [':root', '.dark', ".dark[data-theme='senja']"]) {
    const map = vars(blockOf(selector));
    const fg = map.get('fg');
    const surface = map.get('surface');
    const grounds = [['surface', surface], ['netral band', map.get('bg-subtle')]];
    for (const [label, ground] of grounds) {
      for (const [what, text] of [['fg', fg], ['fg 70%', mix(fg, ground, 0.7)]]) {
        const r = ratio(text, ground);
        const ok = r >= 4.5;
        if (!ok) failures++;
        console.log(`${ok ? 'PASS' : 'FAIL'} ${selector.padEnd(6)} ${('card ' + label + ' ' + what).padEnd(26)} ${r.toFixed(2)}:1`);
      }
    }
    for (const token of tokens) {
      const accent = map.get(`card-${token}-accent`);
      if (!accent) continue;
      const band = mix(accent, surface, 0.12);
      for (const [what, text] of [['fg', fg], ['fg 70%', mix(fg, band, 0.7)]]) {
        const r = ratio(text, band);
        const ok = r >= 4.5;
        if (!ok) failures++;
        console.log(`${ok ? 'PASS' : 'FAIL'} ${selector.padEnd(6)} ${('garis band ' + token + ' ' + what).padEnd(26)} ${r.toFixed(2)}:1`);
      }
      const edge = ratio(accent, surface);
      const edgeOk = edge >= 3;
      if (!edgeOk) failures++;
      console.log(`${edgeOk ? 'PASS' : 'FAIL'} ${selector.padEnd(6)} ${('garis edge ' + token).padEnd(26)} ${edge.toFixed(2)}:1`);
    }
  }
}
console.log(failures === 0 ? '\nAll card colours meet 4.5:1.' : `\n${failures} failing pair(s).`);
process.exit(failures === 0 ? 0 : 1);
