import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { aiEnabled, looksLikeApiKey, readAiFlags, readApiKey, writeAiFlags, writeApiKey } from './ai';

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('the key', () => {
  it('round-trips and trims', () => {
    writeApiKey('  sk-ant-abc  ');
    expect(readApiKey()).toBe('sk-ant-abc');
  });

  it('is REMOVED by an empty value, not stored as a blank', () => {
    writeApiKey('sk-ant-abc');
    writeApiKey('');
    expect(store.has('visite.ai.key')).toBe(false);
  });

  it('lives under its own key, never inside the profile or settings', () => {
    // It must not reach anything that syncs: a credential that syncs is a
    // credential on every device that ever signed in.
    writeApiKey('sk-ant-abc');
    expect([...store.keys()]).toEqual(['visite.ai.key']);
  });
});

describe('the switches', () => {
  it('are off when nothing has been saved', () => {
    expect(readAiFlags()).toEqual({ lab: false, soap: false, check: false, summary: false });
  });

  it('treat anything that is not exactly true as off', () => {
    // A half-written or hand-edited value must fail closed. The failure this
    // guards is a feature turning itself on and sending a note somewhere.
    store.set('visite.ai.flags', JSON.stringify({ lab: 'yes', soap: 1 }));
    expect(readAiFlags()).toEqual({ lab: false, soap: false, check: false, summary: false });
  });

  it('are off when the stored value is not JSON at all', () => {
    store.set('visite.ai.flags', 'nonsense{');
    expect(readAiFlags()).toEqual({ lab: false, soap: false, check: false, summary: false });
  });
});

describe('aiEnabled', () => {
  it('needs BOTH a key and the switch', () => {
    // Two conditions because they answer different questions: can this app
    // call the API, and should it call it with my patient's note.
    writeAiFlags({ lab: true, soap: true, check: true, summary: true });
    expect(aiEnabled('lab')).toBe(false);

    writeApiKey('sk-ant-abc');
    expect(aiEnabled('lab')).toBe(true);

    writeAiFlags({ lab: false, soap: true, check: false, summary: false });
    expect(aiEnabled('lab')).toBe(false);
    expect(aiEnabled('soap')).toBe(true);
  });
});

describe('looksLikeApiKey', () => {
  it('accepts the real prefix', () => {
    expect(looksLikeApiKey('sk-ant-abc123')).toBe(true);
  });

  it('rejects anything else, including a plausible-looking password', () => {
    // This is the exact failure it exists to catch: a password manager
    // filling a saved credential into a field it mistook for a login.
    expect(looksLikeApiKey('Hunter2!2026')).toBe(false);
    expect(looksLikeApiKey('')).toBe(false);
  });
});
