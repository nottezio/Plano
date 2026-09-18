import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  forgetSentBody,
  noteSentBody,
  peekMergeBase,
  peekSentBody,
  putMergeBase,
} from './localBase';

/**
 * The in-memory half only. IndexedDB is absent in this environment, which is
 * itself worth asserting: the write path must keep working when storage is
 * unavailable (private mode), just without surviving a reload.
 */
describe('confirmed base and in-flight body', () => {
  const patientId = 'p1';
  const date = '2026-09-18';

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    forgetSentBody(patientId, date);
  });

  it('remembers a confirmed base synchronously, even with no IndexedDB', async () => {
    await putMergeBase({ patientId, date, body: 'teks server', rev: 3 });
    expect(peekMergeBase(patientId, date)).toBe('teks server');
  });

  it('is undefined for a day this session has not seen confirmed', () => {
    expect(peekMergeBase('p-lain', date)).toBeUndefined();
  });

  it('tracks the last body sent, separately from the confirmed one', async () => {
    await putMergeBase({ patientId, date, body: 'v1', rev: 1 });
    noteSentBody(patientId, date, 'v2');
    expect(peekMergeBase(patientId, date)).toBe('v1');
    expect(peekSentBody(patientId, date)).toBe('v2');
  });

  it('drops the in-flight body once that same body is confirmed', async () => {
    noteSentBody(patientId, date, 'v2');
    await putMergeBase({ patientId, date, body: 'v2', rev: 2 });
    expect(peekSentBody(patientId, date)).toBeUndefined();
  });

  it('keeps the in-flight body when something ELSE was confirmed', async () => {
    noteSentBody(patientId, date, 'punya saya');
    await putMergeBase({ patientId, date, body: 'punya perangkat lain', rev: 9 });
    expect(peekSentBody(patientId, date)).toBe('punya saya');
  });

  it('forgets it after a refusal, so the next write uses the confirmed body', () => {
    noteSentBody(patientId, date, 'ditolak');
    forgetSentBody(patientId, date);
    expect(peekSentBody(patientId, date)).toBeUndefined();
  });
});
