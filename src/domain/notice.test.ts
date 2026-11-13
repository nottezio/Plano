import { describe, expect, it } from 'vitest';

import {
  expiryFromPreset,
  fromLocal,
  isExpired,
  msUntilExpiry,
  pickNotice,
  toLocalIso,
  toLocalTime,
  type AccessNotice,
} from './notice';

const NOW = new Date(2026, 10, 13, 9, 0, 0).getTime();

const make = (id: string, over: Partial<AccessNotice> = {}): AccessNotice => ({
  id,
  text: `pesan ${id}`,
  tone: 'info',
  createdAt: new Date(NOW - 60_000),
  expiresAt: null,
  ...over,
});

describe('isExpired / msUntilExpiry', () => {
  it('never expires without a time', () => {
    expect(isExpired(make('a'), NOW)).toBe(false);
    expect(msUntilExpiry(make('a'), NOW)).toBeNull();
  });

  it('expires exactly at the moment', () => {
    const notice = make('a', { expiresAt: new Date(NOW) });
    expect(isExpired(notice, NOW - 1)).toBe(false);
    expect(isExpired(notice, NOW)).toBe(true);
    expect(msUntilExpiry(notice, NOW - 500)).toBe(500);
  });
});

describe('pickNotice', () => {
  it('shows nothing when there is nothing', () => {
    expect(pickNotice([null, null], [], NOW)).toBeNull();
  });

  it('skips expired and closed messages', () => {
    const expired = make('old', { expiresAt: new Date(NOW - 1) });
    const closed = make('closed');
    const live = make('live', { createdAt: new Date(NOW - 5 * 60_000) });
    expect(pickNotice([expired, closed, live], ['closed'], NOW)?.id).toBe('live');
  });

  it('prefers the newest', () => {
    const older = make('older', { createdAt: new Date(NOW - 120_000) });
    const newer = make('newer', { createdAt: new Date(NOW - 10_000) });
    expect(pickNotice([newer, older], [], NOW)?.id).toBe('newer');
    expect(pickNotice([older, newer], [], NOW)?.id).toBe('newer');
  });

  it('treats a pending server stamp as the newest', () => {
    const stamped = make('stamped');
    const pending = make('pending', { createdAt: null });
    expect(pickNotice([stamped, pending], [], NOW)?.id).toBe('pending');
  });

  it('keeps the earlier candidate on a tie', () => {
    const at = new Date(NOW - 1000);
    const personal = make('personal', { createdAt: at });
    const everyone = make('everyone', { createdAt: at });
    expect(pickNotice([personal, everyone], [], NOW)?.id).toBe('personal');
  });
});

describe('expiry helpers', () => {
  it('turns a preset into a time, or none', () => {
    expect(expiryFromPreset('1h', NOW)?.getTime()).toBe(NOW + 3_600_000);
    expect(expiryFromPreset('7d', NOW)?.getTime()).toBe(NOW + 7 * 86_400_000);
    expect(expiryFromPreset('none', NOW)).toBeNull();
  });

  it('round-trips a local date and time', () => {
    const date = fromLocal('2026-11-14', '09:30');
    expect(date).not.toBeNull();
    expect(toLocalIso(date as Date)).toBe('2026-11-14');
    expect(toLocalTime(date as Date)).toBe('09:30');
  });

  it('rejects unreadable input', () => {
    expect(fromLocal('', '09:30')).toBeNull();
    expect(fromLocal('2026-11-14', '')).toBeNull();
    expect(fromLocal('14/11/2026', '09:30')).toBeNull();
  });
});
