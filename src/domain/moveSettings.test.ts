import { describe, expect, it } from 'vitest';

import { isCarriedKey, moveRole, packSettings, parseMovedTo, planApply } from './moveSettings';

describe('isCarriedKey', () => {
  it('carries the app’s own local-only preferences', () => {
    for (const key of [
      'visite.theme',
      'visite.board.stickers',
      'visite.board.drawing',
      'visite.refRanges',
      'visite.boardCanvasLayout',
      'visite.census.history',
      'plano.tabs',
      'plano.listMaker.chiefsOpen',
    ]) {
      expect(isCarriedKey(key), key).toBe(true);
    }
  });

  it('leaves out device identity, secrets, patient clipboard, Firestore mirrors and logs', () => {
    for (const key of [
      'visite.deviceId',
      'visite.chunkRecovery',
      'visite.iosInstallHint.dismissed',
      'visite.pin',
      'visite.ai.key',
      'visite.ai.flags',
      'visite.sessionLog',
      'plano.clipboard.last',
      'plano.signout.cacheKept',
      'plano.sensus.v2',
      'visite.jaga.roster',
      'visite.access.stats',
      'plano.move.anything',
    ]) {
      expect(isCarriedKey(key), key).toBe(false);
    }
  });

  it('ignores keys that are not the app’s', () => {
    expect(isCarriedKey('firebase:authUser')).toBe(false);
    expect(isCarriedKey('other.app')).toBe(false);
    expect(isCarriedKey('plano:settings-open')).toBe(false);
  });
});

describe('packSettings', () => {
  it('packs carried keys only, as JSON', () => {
    const result = packSettings([
      ['visite.theme', 'dark'],
      ['visite.pin', 'secret'],
      ['plano.tabs', '["a","b"]'],
    ]);
    expect(JSON.parse(result.json)).toEqual({ 'visite.theme': 'dark', 'plano.tabs': '["a","b"]' });
    expect(result.carried).toEqual(['plano.tabs', 'visite.theme']);
    expect(result.skipped).toEqual([]);
  });

  it('drops the largest values first when over the limit', () => {
    const big = 'x'.repeat(500);
    const result = packSettings(
      [
        ['visite.board.drawing', big],
        ['visite.theme', 'dark'],
        ['visite.board.density', 'compact'],
      ],
      200,
    );
    expect(result.carried).toEqual(['visite.board.density', 'visite.theme']);
    expect(result.skipped).toEqual(['visite.board.drawing']);
    expect(new TextEncoder().encode(result.json).length).toBeLessThanOrEqual(200);
  });

  it('counts bytes, not characters', () => {
    const result = packSettings([['visite.theme', 'é'.repeat(60)]], 100);
    expect(result.skipped).toEqual(['visite.theme']);
  });
});

describe('planApply', () => {
  it('writes only carried keys that are absent', () => {
    const json = JSON.stringify({ 'visite.theme': 'dark', 'plano.tabs': 'x', 'visite.pin': 'p' });
    const present = new Set(['plano.tabs']);
    expect(planApply(json, (key) => present.has(key))).toEqual([['visite.theme', 'dark']]);
  });

  it('ignores non-string values and malformed input', () => {
    expect(planApply(JSON.stringify({ 'visite.theme': 3 }), () => false)).toEqual([]);
    expect(planApply('not json', () => false)).toEqual([]);
    expect(planApply('[]', () => false)).toEqual([]);
    expect(planApply('null', () => false)).toEqual([]);
  });

  it('round-trips with packSettings', () => {
    const entries: Array<[string, string]> = [
      ['visite.theme', 'senja'],
      ['visite.refRanges', '{"k":[3.5,5]}'],
    ];
    expect(planApply(packSettings(entries).json, () => false)).toEqual(
      [...entries].sort(([a], [b]) => a.localeCompare(b)),
    );
  });
});

describe('parseMovedTo / moveRole', () => {
  it('accepts an https URL and keeps its origin', () => {
    expect(parseMovedTo('https://tabulaplano.web.app/')).toBe('https://tabulaplano.web.app');
    expect(parseMovedTo(' https://tabulaplano.web.app/p/1 ')).toBe('https://tabulaplano.web.app');
  });

  it('rejects unset, malformed and non-https values', () => {
    expect(parseMovedTo(undefined)).toBeNull();
    expect(parseMovedTo('')).toBeNull();
    expect(parseMovedTo('tabulaplano.web.app')).toBeNull();
    expect(parseMovedTo('http://tabulaplano.web.app')).toBeNull();
  });

  it('accepts plain http on loopback only, for local testing', () => {
    expect(parseMovedTo('http://localhost:5175')).toBe('http://localhost:5175');
    expect(parseMovedTo('http://127.0.0.1:5175/')).toBe('http://127.0.0.1:5175');
  });

  it('tells the old address from the new one', () => {
    const target = 'https://tabulaplano.web.app';
    expect(moveRole(null, 'https://nottezio.github.io')).toBe('none');
    expect(moveRole(target, 'https://nottezio.github.io')).toBe('old');
    expect(moveRole(target, target)).toBe('new');
  });
});
