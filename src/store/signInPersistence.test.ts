import { beforeEach, describe, expect, it, vi } from 'vitest';

import { signInWithGoogle } from './useSession';

// Hoisted with vi.mock, which runs before the import above.
const calls = vi.hoisted((): string[] => []);

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {
    setCustomParameters(): void {}
  },
  browserLocalPersistence: { type: 'LOCAL' },
  browserPopupRedirectResolver: {},
  getRedirectResult: vi.fn(),
  onAuthStateChanged: vi.fn(),
  setPersistence: vi.fn((_auth: unknown, persistence: { type: string }) => {
    calls.push(`persistence:${persistence.type}`);
    return Promise.resolve();
  }),
  signInWithPopup: vi.fn(() => {
    calls.push('popup');
    return Promise.resolve();
  }),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/data/firebase', () => ({
  initFirebase: vi.fn(),
  services: () => ({ auth: {} }),
}));

describe('signInWithGoogle', () => {
  beforeEach(() => {
    calls.length = 0;
  });

  // Regression: IndexedDB persistence refuses writes while a popup hides the
  // page, so the signed-in user must go to localStorage, queued before the popup.
  it('switches to localStorage persistence before opening the popup', async () => {
    await signInWithGoogle();
    expect(calls).toEqual(['persistence:LOCAL', 'popup']);
  });
});
