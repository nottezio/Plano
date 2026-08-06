import { describe, expect, it } from 'vitest';

import {
  diffSegments,
  diffStats,
  isAutomatic,
  keepBoth,
  mergeThreeWay,
} from './threeWayMerge';

const BASE = [
  'S: sesak berkurang',
  'O:',
  'TTV: TD 130/80, N 92',
  'A: Pneumonia komunitas',
  'P:',
  '- Lanjut O2 3 lpm',
].join('\n');

describe('trivial outcomes', () => {
  it('reports unchanged when both sides agree', () => {
    const result = mergeThreeWay(BASE, BASE, BASE);
    expect(result.kind).toBe('unchanged');
    expect(isAutomatic(result)).toBe(true);
  });

  it('reports local-only when the other device did nothing', () => {
    const local = `${BASE}\n- Cek DPL besok`;
    const result = mergeThreeWay(BASE, local, BASE);
    expect(result).toEqual({ kind: 'local-only', body: local });
  });

  it('reports remote-only when this device did nothing', () => {
    const remote = `${BASE}\n- Konsul TS Jantung`;
    const result = mergeThreeWay(BASE, BASE, remote);
    expect(result).toEqual({ kind: 'remote-only', body: remote });
  });

  it('reports unchanged when both devices made the identical edit', () => {
    const same = BASE.replace('N 92', 'N 88');
    expect(mergeThreeWay(BASE, same, same).kind).toBe('unchanged');
  });
});

describe('disjoint edits merge automatically', () => {
  it('merges an edit in S with an edit in P', () => {
    const local = BASE.replace('S: sesak berkurang', 'S: sesak jauh berkurang, batuk (+)');
    const remote = BASE.replace('- Lanjut O2 3 lpm', '- Lanjut O2 3 lpm\n- Cek AGD');

    const result = mergeThreeWay(BASE, local, remote);
    expect(result.kind).toBe('merged');
    expect(result.body).toContain('sesak jauh berkurang, batuk (+)');
    expect(result.body).toContain('- Cek AGD');
  });

  it('merges appends made at opposite ends', () => {
    const local = `Tn. B, 52th\n${BASE}`;
    const remote = `${BASE}\nTh/ Ceftriaxone 2x1`;

    const result = mergeThreeWay(BASE, local, remote);
    expect(result.kind).toBe('merged');
    expect(result.body).toContain('Tn. B, 52th');
    expect(result.body).toContain('Th/ Ceftriaxone 2x1');
  });

  it('loses nothing when merging: both unique insertions survive', () => {
    const local = BASE.replace('A: Pneumonia komunitas', 'A: Pneumonia komunitas, AKI stage 1');
    const remote = BASE.replace('TTV: TD 130/80, N 92', 'TTV: TD 120/70, N 88, RR 20');

    const result = mergeThreeWay(BASE, local, remote);
    expect(result.kind).toBe('merged');
    expect(result.body).toContain('AKI stage 1');
    expect(result.body).toContain('RR 20');
  });

  it('merges a new section added on one side only', () => {
    const local = `${BASE}\nPenunjang: Hb 10.2`;
    const remote = BASE.replace('S: sesak berkurang', 'S: sesak minimal');

    const result = mergeThreeWay(BASE, local, remote);
    expect(result.kind).toBe('merged');
    expect(result.body).toContain('Penunjang: Hb 10.2');
    expect(result.body).toContain('sesak minimal');
  });
});

describe('overlapping edits raise a conflict rather than guessing', () => {
  it('flags two different rewrites of the same line', () => {
    const local = BASE.replace('A: Pneumonia komunitas', 'A: Pneumonia komunitas, sepsis');
    const remote = BASE.replace('A: Pneumonia komunitas', 'A: Pneumonia aspirasi');

    const result = mergeThreeWay(BASE, local, remote);
    expect(result.kind).toBe('conflict');
    expect(isAutomatic(result)).toBe(false);
  });

  it('hands the caller both versions and the base, intact', () => {
    const local = `${BASE} LOCAL`;
    const remote = `${BASE} REMOTE`;
    const result = mergeThreeWay(BASE, local, remote);

    if (result.kind !== 'conflict') throw new Error('expected a conflict');
    expect(result.local).toBe(local);
    expect(result.remote).toBe(remote);
    expect(result.base).toBe(BASE);
  });

  it('conflicts when there is no common ancestor', () => {
    const result = mergeThreeWay(null, 'catatan saya', 'catatan perangkat lain');
    expect(result.kind).toBe('conflict');
    if (result.kind !== 'conflict') return;
    expect(result.base).toBeNull();
    expect(result.remote).toBe('catatan perangkat lain');
  });

  it('does not conflict with no ancestor when both sides are identical', () => {
    expect(mergeThreeWay(null, 'sama', 'sama').kind).toBe('unchanged');
  });

  it('treats a wholesale rewrite against an edit as a conflict', () => {
    const local = 'Catatan ditulis ulang total oleh perangkat ini.';
    const remote = BASE.replace('N 92', 'N 88');
    expect(mergeThreeWay(BASE, local, remote).kind).toBe('conflict');
  });
});

describe('inputs are never mutated', () => {
  it('leaves base, local and remote byte-identical', () => {
    const base = String(BASE);
    const local = `${BASE}\n- Cek DPL`;
    const remote = `${BASE}\n- Konsul`;
    const localCopy = String(local);
    const remoteCopy = String(remote);

    mergeThreeWay(base, local, remote);

    expect(base).toBe(BASE);
    expect(local).toBe(localCopy);
    expect(remote).toBe(remoteCopy);
  });
});

describe('keepBoth', () => {
  it('retains every character of both versions', () => {
    const local = 'S: sesak berat';
    const remote = 'S: sesak ringan';
    const combined = keepBoth(local, remote, 'iPad');

    expect(combined).toContain(local);
    expect(combined).toContain(remote);
    expect(combined).toContain('Versi iPad');
  });
});

describe('diff view', () => {
  it('marks insertions and deletions', () => {
    const segments = diffSegments('N 92', 'N 88');
    expect(segments.some((segment) => segment.type === 'insert')).toBe(true);
    expect(segments.some((segment) => segment.type === 'delete')).toBe(true);
  });

  it('reconstructs the original from equal + delete segments', () => {
    const before = 'S: sesak berkurang\nA: pneumonia';
    const after = 'S: sesak minimal\nA: pneumonia, sepsis';
    const rebuilt = diffSegments(before, after)
      .filter((segment) => segment.type !== 'insert')
      .map((segment) => segment.text)
      .join('');
    expect(rebuilt).toBe(before);
  });

  it('reconstructs the new text from equal + insert segments', () => {
    const before = 'S: sesak berkurang';
    const after = 'S: sesak minimal, batuk (+)';
    const rebuilt = diffSegments(before, after)
      .filter((segment) => segment.type !== 'delete')
      .map((segment) => segment.text)
      .join('');
    expect(rebuilt).toBe(after);
  });

  it('counts added and removed characters', () => {
    const stats = diffStats('abc', 'abcdef');
    expect(stats.added).toBe(3);
    expect(stats.removed).toBe(0);
  });
});
