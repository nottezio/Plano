import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `line-clamp-*` and `block` on the same element cancel the clamp.
 *
 * Tailwind emits `.block{display:block}` AFTER the line-clamp utilities, and
 * the clamp needs `display:-webkit-box`, so the later rule wins and the text
 * is not truncated at all. It shipped twice in the Catatan cards: the clamp
 * looked present in review both times, and both times every card printed its
 * whole note.
 *
 * Nothing about the class list says this, so a test says it instead.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

describe('line-clamp is never cancelled by a display utility', () => {
  it('no className combines line-clamp with block or flex', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(resolve(__dirname, '../..'))) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/className=(?:"([^"]*)"|\{\[([^\]]*)\])/g)) {
        const classes = `${match[1] ?? ''} ${match[2] ?? ''}`;
        if (!/\bline-clamp-(\d+|\[\d+\])\b/.test(classes)) continue;
        if (/(^|[\s'"`])(block|flex|inline-block|grid)([\s'"`]|$)/.test(classes)) {
          offenders.push(`${file}: ${classes.trim().slice(0, 80)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
