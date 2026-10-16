import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Guard (added 16 Oct 2026). The theme colours are bare CSS variables
 * (`bg: 'var(--bg)'` in tailwind.config.js), so Tailwind cannot apply an
 * opacity modifier to them: `bg-bg/40` or `border-border/60` generate NO CSS,
 * silently. The element then falls back to transparent or, for a border, to
 * the preflight grey #e5e7eb — the bright outline on the inactive desktop tab
 * in Avi's screenshot, and a see-through sticky header since TopBar's
 * `bg-bg/95`. For a translucent theme colour write it out instead:
 * `bg-[color-mix(in_srgb,var(--bg)_95%,transparent)]`.
 */

const ROOT = join(__dirname, '..', '..');

function varColours(): string[] {
  const config = readFileSync(join(ROOT, 'tailwind.config.js'), 'utf8');
  const names = [...config.matchAll(/'?([\w-]+)'?:\s*'var\(--/g)].map((m) => m[1]!);
  return names.sort((a, b) => b.length - a.length);
}

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.(tsx?|jsx?|html)$/.test(name) && !name.endsWith('tailwindAlpha.test.ts')) out.push(path);
  }
  return out;
}

describe('Tailwind theme colours', () => {
  const colours = varColours();

  it('reads the variable-backed colours from the config', () => {
    expect(colours).toEqual(expect.arrayContaining(['bg', 'bg-subtle', 'border', 'fg', 'accent']));
  });

  it('never takes an opacity modifier (it would generate no CSS)', () => {
    const pattern = new RegExp(`(?<![\\w-])(?:[a-z]+-)+(?:${colours.join('|')})/(?:\\d|\\[)`, 'g');
    const found = sources(join(ROOT, 'src')).flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(pattern)].map((m) => `${file.slice(ROOT.length + 1)}: ${m[0]}`),
    );
    expect(found).toEqual([]);
  });
});
