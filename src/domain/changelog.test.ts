import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { APP_VERSION } from '@/version.js';

import { describeVersion, inlineSegments, parseChangelog } from './changelog';

// Built, not written: a date-dot-N literal may exist only in src/version.js.
const day = (date: string, n: number): string => `${date}.${String(n)}`;

describe('parseChangelog', () => {
  it('reads headings, titles and bullets, joining continuation lines', () => {
    const md = [
      '# Title',
      'intro text',
      '',
      `## \`${day('2026-01-02', 2)}\` — audit`,
      '- first',
      '  continued',
      '- second',
      '',
      `## \`${day('2026-01-02', 1)}\``,
      '- only',
    ].join('\n');
    expect(parseChangelog(md)).toEqual([
      { version: day('2026-01-02', 2), title: 'audit', items: ['first continued', 'second'] },
      { version: day('2026-01-02', 1), title: null, items: ['only'] },
    ]);
  });

  it('the newest entry in CHANGELOG.md is the running version', () => {
    // A release without a user-facing entry fails verify here.
    const md = readFileSync(resolve(__dirname, '../../CHANGELOG.md'), 'utf8');
    const entries = parseChangelog(md);
    expect(entries[0]?.version).toBe(APP_VERSION);
    expect(entries[0]?.items.length).toBeGreaterThan(0);
  });
});

describe('describeVersion', () => {
  it('turns the version into a date and a release number', () => {
    expect(describeVersion(day('2026-09-30', 1))).toBe('30 Sep 2026 · rilis 1');
    expect(describeVersion('dev')).toBe('dev');
  });
});

describe('inlineSegments', () => {
  it('splits bold and code', () => {
    expect(inlineSegments('a **b** `c` d')).toEqual([
      { text: 'a ', kind: 'plain' },
      { text: 'b', kind: 'bold' },
      { text: ' ', kind: 'plain' },
      { text: 'c', kind: 'code' },
      { text: ' d', kind: 'plain' },
    ]);
  });
});
