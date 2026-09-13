import { useState } from 'react';

import type { ReferenceRanges as Ranges } from '@/domain/format/soapCheck';

const KEY = 'visite.refRanges';

/**
 * Reference ranges, entered by the user, stored on the device.
 *
 * Plano ships none, and that is a rule rather than an omission: a range is a
 * property of the laboratory that printed the result, and a number baked into
 * an app is one nobody can correct when the lab changes its assay. Empty is
 * therefore a valid, permanent state — the one check that uses these stays
 * silent until they are filled in, and nothing else changes.
 *
 * Three analytes, because three are what the checker can act on. A general
 * table of every lab value would be a form nobody finishes.
 */
export function readReferenceRanges(): Ranges {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Ranges = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const pair = value as { low?: unknown; high?: unknown };
      const low = Number(pair?.low);
      const high = Number(pair?.high);
      // Both ends, both numbers, and the right way round. A half-entered range
      // would otherwise call everything abnormal or everything normal.
      if (Number.isFinite(low) && Number.isFinite(high) && low < high) out[key] = { low, high };
    }
    return out;
  } catch {
    return {};
  }
}

const ANALYTES = [
  { key: 'Na', label: 'Natrium (mmol/L)' },
  { key: 'K', label: 'Kalium (mmol/L)' },
  { key: 'Cl', label: 'Klorida (mmol/L)' },
] as const;

export function ReferenceRangeSettings(): JSX.Element {
  const [ranges, setRanges] = useState<Record<string, { low: string; high: string }>>(() => {
    const stored = readReferenceRanges();
    return Object.fromEntries(
      ANALYTES.map(({ key }) => [
        key,
        { low: stored[key]?.low?.toString() ?? '', high: stored[key]?.high?.toString() ?? '' },
      ]),
    );
  });

  const update = (key: string, side: 'low' | 'high', value: string): void => {
    const next = { ...ranges, [key]: { ...ranges[key]!, [side]: value } };
    setRanges(next);
    try {
      const payload: Ranges = {};
      for (const [analyte, pair] of Object.entries(next)) {
        const low = Number(pair.low);
        const high = Number(pair.high);
        if (Number.isFinite(low) && Number.isFinite(high) && pair.low && pair.high && low < high) {
          payload[analyte] = { low, high };
        }
      }
      localStorage.setItem(KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('[ranges] not saved', error);
    }
  };

  return (
    <div className="space-y-2 text-xs">
      <p className="text-fg-muted">
        Dipakai hanya untuk mengingatkan menambah "perbaikan" saat elektrolit sudah kembali
        normal. Kosongkan jika tidak ingin dipakai.
      </p>
      {ANALYTES.map(({ key, label }) => (
        <div key={key} className="flex flex-wrap items-center gap-2">
          <span className="min-w-[9rem] text-fg-muted">{label}</span>
          <input
            inputMode="decimal"
            value={ranges[key]?.low ?? ''}
            onChange={(event) => update(key, 'low', event.target.value)}
            placeholder="bawah"
            className="min-h-tap w-20 rounded-lg border border-border bg-surface px-2 text-xs"
          />
          <span className="text-fg-faint">–</span>
          <input
            inputMode="decimal"
            value={ranges[key]?.high ?? ''}
            onChange={(event) => update(key, 'high', event.target.value)}
            placeholder="atas"
            className="min-h-tap w-20 rounded-lg border border-border bg-surface px-2 text-xs"
          />
        </div>
      ))}
      <p className="text-fg-faint">
        Isi sesuai rentang laboratorium Anda. Plano tidak membawa angka bawaan.
      </p>
    </div>
  );
}
