import { describe, expect, it } from 'vitest';

import { formatHistory, selectHistory } from './historySummary';

const day = (date: string, size: number) => ({ date, body: 'x'.repeat(size) });

describe('selectHistory', () => {
  it('sends everything when it fits', () => {
    const entries = [day('2026-09-01', 100), day('2026-09-02', 100)];
    expect(selectHistory(entries, 1000)).toMatchObject({ omitted: [] });
  });

  it('always keeps the admission note', () => {
    // It carries the identity, the referral and the presenting problem. A
    // summary without it has to infer why the patient is in hospital from a
    // note that assumes everyone already knows.
    const entries = Array.from({ length: 10 }, (_, i) =>
      day(`2026-09-${String(i + 1).padStart(2, '0')}`, 1000),
    );
    const result = selectHistory(entries, 3000);
    expect(result.included[0]?.date).toBe('2026-09-01');
  });

  it('keeps the most recent days', () => {
    // "Keluhan sekarang" and the current plan can only come from them.
    const entries = Array.from({ length: 10 }, (_, i) =>
      day(`2026-09-${String(i + 1).padStart(2, '0')}`, 1000),
    );
    const result = selectHistory(entries, 3000);
    expect(result.included.at(-1)?.date).toBe('2026-09-10');
  });

  it('drops the MIDDLE, and says which days', () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      day(`2026-09-${String(i + 1).padStart(2, '0')}`, 1000),
    );
    const result = selectHistory(entries, 3000);
    expect(result.omitted).toContain('2026-09-05');
    expect(result.omitted).not.toContain('2026-09-01');
    expect(result.omitted).not.toContain('2026-09-10');
  });

  it('returns days oldest first whatever order they arrive in', () => {
    const result = selectHistory([day('2026-09-03', 10), day('2026-09-01', 10)], 1000);
    expect(result.included.map((entry) => entry.date)).toEqual(['2026-09-01', '2026-09-03']);
  });

  it('ignores empty days rather than sending blank sections', () => {
    expect(selectHistory([{ date: '2026-09-01', body: '   ' }], 1000).included).toEqual([]);
  });
});

describe('formatHistory', () => {
  it('labels each day', () => {
    const text = formatHistory(selectHistory([day('2026-09-01', 5)], 1000));
    expect(text).toContain('### 2026-09-01');
  });

  it('tells the model about the gap', () => {
    // A gap it does not know about is a gap it will narrate straight through.
    const entries = Array.from({ length: 10 }, (_, i) =>
      day(`2026-09-${String(i + 1).padStart(2, '0')}`, 1000),
    );
    expect(formatHistory(selectHistory(entries, 3000))).toContain('TIDAK DISERTAKAN');
  });
});
