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
  /**
   * Comments are stripped before the check. The first version read the whole
   * `className={[...]}` expression, so a comment saying "no `block` here"
   * counted as a `block` class — a guard that fires on the text warning about
   * the bug it guards against is a guard nobody keeps.
   */
  const classStrings = (expression: string): string =>
    expression
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/[^\n]*/g, ' ')
      .match(/'[^']*'|"[^"]*"|`[^`]*`/g)
      ?.join(' ') ?? '';

  it('no className combines line-clamp with block or flex', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(resolve(__dirname, '../..'))) {
      const source = readFileSync(file, 'utf8');
      // Arrays in this codebase end `].join(' ')}`, never `]}` — a pattern
      // expecting the latter silently matched nothing, which is a guard that
      // passes because it looked nowhere.
      for (const match of source.matchAll(
        /className=(?:("[^"]*")|\{\[([\s\S]*?)\]\.join)/g,
      )) {
        const classes = match[1] ? match[1] : classStrings(match[2] ?? '');
        if (!/\bline-clamp-(\d+|\[\d+\])\b/.test(classes)) continue;
        if (/(^|[\s'"`])(block|flex|inline-block|grid)([\s'"`]|$)/.test(classes)) {
          offenders.push(`${file}: ${classes.trim().slice(0, 100)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
