import { describe, expect, it } from 'vitest';

import { ancestorsOf, planNavigation, screenLevel } from './navigation';

describe('screenLevel', () => {
  it('ranks board, sections and details', () => {
    expect(screenLevel('/')).toBe(0);
    expect(screenLevel('/arsip')).toBe(1);
    expect(screenLevel('/pengaturan/')).toBe(1);
    expect(screenLevel('/helper?tab=jaga')).toBe(1);
    expect(screenLevel('/p/abc')).toBe(2);
    expect(screenLevel('/p/abc/2026-10-02')).toBe(2);
    expect(screenLevel('/dokumen')).toBe(1);
    expect(screenLevel('/dokumen/d1')).toBe(2);
    expect(screenLevel('/catatan')).toBe(1);
    expect(screenLevel('/catatan?n=x')).toBe(2);
    expect(screenLevel('/checklist?c=y')).toBe(2);
    expect(screenLevel('/checklist?q=a')).toBe(1);
  });
});

describe('ancestorsOf', () => {
  it('builds the chain a cold start needs under it', () => {
    expect(ancestorsOf('/')).toEqual([]);
    expect(ancestorsOf('/arsip')).toEqual(['/']);
    expect(ancestorsOf('/p/abc/2026-10-02')).toEqual(['/']);
    expect(ancestorsOf('/dokumen/d1')).toEqual(['/', '/dokumen']);
    expect(ancestorsOf('/catatan?n=x')).toEqual(['/', '/catatan']);
  });
});

describe('planNavigation', () => {
  it('pushes one level down', () => {
    expect(planNavigation(['/'], 0, '/p/a/2026-10-02', 'push')).toEqual({ kind: 'push' });
    expect(planNavigation(['/', '/arsip'], 1, '/p/a', 'push')).toEqual({ kind: 'push' });
  });

  it('replaces sideways: another day, another tab, another patient', () => {
    expect(planNavigation(['/', '/p/a/2026-10-01'], 1, '/p/a/2026-10-02', 'push')).toEqual({ kind: 'replace' });
    expect(planNavigation(['/', '/arsip'], 1, '/kalkulator', 'push')).toEqual({ kind: 'replace' });
    expect(planNavigation(['/', '/p/a'], 1, '/p/b', 'push')).toEqual({ kind: 'replace' });
  });

  it('goes back up to the parent instead of stacking it again', () => {
    expect(planNavigation(['/', '/p/a'], 1, '/', 'push')).toEqual({ kind: 'back', delta: -1, then: 'none' });
    expect(planNavigation(['/', '/dokumen', '/dokumen/d'], 2, '/dokumen', 'push')).toEqual({
      kind: 'back',
      delta: -1,
      then: 'none',
    });
  });

  it('goes up and then across when the target is a sibling of an ancestor', () => {
    // Patient opened from the board, then the Arsip tab: board, then push Arsip.
    expect(planNavigation(['/', '/p/a'], 1, '/arsip', 'push')).toEqual({ kind: 'back', delta: -1, then: 'push' });
    // Document opened from Dokumen, then the Arsip tab: replace Dokumen with Arsip.
    expect(planNavigation(['/', '/dokumen', '/dokumen/d'], 2, '/arsip', 'push')).toEqual({
      kind: 'back',
      delta: -1,
      then: 'replace',
    });
    // From a patient opened from Arsip, the board tab: two steps up.
    expect(planNavigation(['/', '/arsip', '/p/a'], 2, '/', 'push')).toEqual({ kind: 'back', delta: -2, then: 'none' });
  });

  it('replaces in place when nothing above was recorded', () => {
    expect(planNavigation([undefined, '/p/a'], 1, '/', 'push')).toEqual({ kind: 'replace' });
    expect(planNavigation([], 0, '/arsip', 'push')).toEqual({ kind: 'push' });
  });

  it('keeps an explicit replace one level down (a laptop opening a note in its pane)', () => {
    expect(planNavigation(['/', '/catatan'], 1, '/catatan?n=x', 'replace')).toEqual({ kind: 'replace' });
  });

  it('never stacks the same screen twice', () => {
    expect(planNavigation(['/', '/arsip'], 1, '/arsip', 'push')).toEqual({ kind: 'replace' });
  });
});
