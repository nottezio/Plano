import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { aiEnabled, readAiFlags, readApiKey, writeAiFlags, writeApiKey } from './ai';

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
    expect(readAiFlags()).toEqual({ lab: false, soap: false });
  });

  it('treat anything that is not exactly true as off', () => {
    // A half-written or hand-edited value must fail closed. The failure this
    // guards is a feature turning itself on and sending a note somewhere.
    store.set('visite.ai.flags', JSON.stringify({ lab: 'yes', soap: 1 }));
    expect(readAiFlags()).toEqual({ lab: false, soap: false });
  });

  it('are off when the stored value is not JSON at all', () => {
    store.set('visite.ai.flags', 'nonsense{');
    expect(readAiFlags()).toEqual({ lab: false, soap: false });
  });
});

describe('aiEnabled', () => {
  it('needs BOTH a key and the switch', () => {
    // Two conditions because they answer different questions: can this app
    // call the API, and should it call it with my patient's note.
    writeAiFlags({ lab: true, soap: true });
    expect(aiEnabled('lab')).toBe(false);

    writeApiKey('sk-ant-abc');
    expect(aiEnabled('lab')).toBe(true);

    writeAiFlags({ lab: false, soap: true });
    expect(aiEnabled('lab')).toBe(false);
    expect(aiEnabled('soap')).toBe(true);
  });
});
