import { describe, expect, it } from 'vitest';

import { parsePdfDate } from './pdfItems';

describe('parsePdfDate', () => {
  it('reads a full date with a zone', () => {
    expect(parsePdfDate("D:20260901103000+07'00'")).toBe('2026-09-01T03:30:00.000Z');
  });

  it('reads UTC and missing parts', () => {
    expect(parsePdfDate('D:20260901103000Z')).toBe('2026-09-01T10:30:00.000Z');
    expect(parsePdfDate('D:2026')).toBe('2026-01-01T00:00:00.000Z');
  });

  it('returns null for nothing usable', () => {
    expect(parsePdfDate(undefined)).toBeNull();
    expect(parsePdfDate('bukan tanggal')).toBeNull();
  });
});
