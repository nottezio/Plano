import { afterEach, describe, expect, it, vi } from 'vitest';

// Node has a `navigator` without `onLine`, which the module reads as offline at load.
vi.hoisted(() => {
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
});

import { acknowledgeWriteFailures, trackWrite } from './syncStatus';
import { useUI } from '@/store/useUI';

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('trackWrite', () => {
  afterEach(() => {
    acknowledgeWriteFailures();
    vi.restoreAllMocks();
  });

  it('is saving while a write is in flight and synced once it lands', async () => {
    let resolve!: () => void;
    const write = trackWrite(new Promise<void>((r) => (resolve = r)));
    expect(useUI.getState().sync.kind).toBe('saving');
    resolve();
    await write;
    await flush();
    expect(useUI.getState().sync.kind).toBe('synced');
  });

  it('turns a refused write into an error carrying the Firestore code', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    trackWrite(Promise.reject(Object.assign(new Error('denied'), { code: 'permission-denied' }))).catch(() => {});
    await flush();
    const sync = useUI.getState().sync;
    expect(sync.kind).toBe('error');
    if (sync.kind === 'error') {
      expect(sync.failed).toBe(1);
      expect(sync.code).toBe('permission-denied');
    }
  });

  it('keeps the error after a later write succeeds, until acknowledged', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    trackWrite(Promise.reject(new Error('refused'))).catch(() => {});
    await flush();
    await trackWrite(Promise.resolve());
    await flush();
    expect(useUI.getState().sync.kind).toBe('error');

    acknowledgeWriteFailures();
    expect(useUI.getState().sync.kind).toBe('synced');
  });

  it('counts every refusal since the last acknowledgement', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    trackWrite(Promise.reject(new Error('a'))).catch(() => {});
    trackWrite(Promise.reject(new Error('b'))).catch(() => {});
    await flush();
    const sync = useUI.getState().sync;
    expect(sync.kind === 'error' && sync.failed).toBe(2);
  });
});
