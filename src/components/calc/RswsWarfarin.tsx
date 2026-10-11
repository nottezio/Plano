import { useState } from 'react';

import type { InrTarget } from '@/domain/calc/warfarin';
import {
  RSWS_INR_EVERY_DAYS,
  RSWS_START_MG,
  WEEKDAYS,
  describeSchedule,
  rswsScheduleLine,
  rswsStartLine,
  spreadWeekly,
  weeklyTotal,
} from '@/domain/calc/warfarinRsws';
import { formatDmy } from '@/domain/dateDmy';
import { formatShortDate } from '@/domain/clinicalDate';
import { useClinicalToday } from '@/hooks/useClinicalToday';
import { Big, Empty, ResultBlock, Segmented } from './ClinicalCards';

/**
 * The ward's way with warfarin, UNOFFICIAL (2026-10-11): start 1 × 2 mg,
 * INR every 3 days, the dose written as a week ("Senin–Jumat 2 mg,
 * Sabtu–Minggu 3 mg"). The doctor decides the new weekly total; this does
 * the arithmetic and writes the schedule. See domain/calc/warfarinRsws.
 */

const RANGE: Partial<Record<InrTarget, [number, number]>> = {
  '2-3': [2, 3],
  '2.5-3.5': [2.5, 3.5],
};
const CHANGES = [-20, -10, -5, 0, 5, 10, 20] as const;
const mg = (value: number): string => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value);
const dateText = (date: string): string => `${formatShortDate(date).split(',')[0] ?? ''}, ${formatDmy(date)}`;

export function RswsWarfarin({
  target,
  inr,
  onInsertTerapi,
}: {
  target: InrTarget;
  inr: number;
  onInsertTerapi?: ((line: string) => boolean) | undefined;
}): JSX.Element {
  const today = useClinicalToday();
  const [stage, setStage] = useState<'mulai' | 'sesuaikan'>('sesuaikan');
  const [current, setCurrent] = useState<string[]>(() => Array.from({ length: 7 }, () => String(RSWS_START_MG)));
  const [change, setChange] = useState<number | null>(null);
  const [customTotal, setCustomTotal] = useState('');
  const [step, setStep] = useState<'1' | '0.5'>('1');
  const [inserted, setInserted] = useState<'ok' | 'none' | null>(null);

  const doses = current.map((text) => (text.trim() === '' ? Number.NaN : Number(text)));
  const scheduleValid = doses.every((dose) => Number.isFinite(dose) && dose >= 0);
  const total = scheduleValid ? weeklyTotal(doses) : null;
  const range = RANGE[target];
  const inrKnown = Number.isFinite(inr) && inr > 0;
  const position = range && inrKnown ? (inr < range[0] ? 'below' : inr > range[1] ? 'above' : 'in') : null;

  const wanted =
    customTotal.trim() !== '' ? Number(customTotal) : total !== null && change !== null ? total * (1 + change / 100) : null;
  const next = wanted !== null && Number.isFinite(wanted) && wanted >= 0 ? spreadWeekly(wanted, Number(step)) : null;
  const line =
    stage === 'mulai'
      ? rswsStartLine(today, dateText)
      : next
        ? rswsScheduleLine(next, inrKnown ? inr : null, today, dateText)
        : null;

  return (
    <div className="mt-3 space-y-2">
      <p className="rounded-lg border border-[var(--warn-strong)] px-2 py-1.5 text-[11px] leading-snug">
        <b>Protokol RSWS — tidak resmi.</b> Dari praktik bangsal (mulai 1 × 2 mg, INR tiap {RSWS_INR_EVERY_DAYS} hari, dosis
        ditulis per minggu); belum ada dokumen protokolnya. Besar penyesuaian ditentukan dokter — kartu ini hanya menghitung
        dan menulis jadwalnya.
      </p>
      <Segmented
        label="Tahap RSWS"
        value={stage}
        onChange={(value) => {
          setStage(value);
          setInserted(null);
        }}
        options={[
          { value: 'mulai', label: 'Mulai' },
          { value: 'sesuaikan', label: 'Sesuaikan (INR)' },
        ]}
      />

      {stage === 'mulai' ? (
        <ResultBlock line={rswsStartLine(today, dateText)}>
          <Big value={`1 × ${RSWS_START_MG}`} unit="mg oral, malam" caption={`Cek INR ${RSWS_INR_EVERY_DAYS} hari lagi`} />
        </ResultBlock>
      ) : (
        <>
          <div>
            <p className="mb-1 text-[11px] font-medium text-fg-muted">Dosis minggu ini (mg)</p>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((name, index) => (
                <label key={name} className="text-center text-[10px] text-fg-muted">
                  {name.slice(0, 3)}
                  <input
                    inputMode="decimal"
                    aria-label={`Dosis ${name} (mg)`}
                    value={current[index]}
                    onChange={(event) => {
                      const text = event.target.value.replace(/[^\d.,]/g, '').replace(',', '.');
                      setCurrent((days) => days.map((day, i) => (i === index ? text : day)));
                    }}
                    className="mt-0.5 min-h-tap w-full rounded-lg border border-border bg-surface text-center text-sm tabular-nums"
                  />
                </label>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-fg-muted">
              {total !== null ? `${describeSchedule(doses)} · ${mg(total)} mg/minggu` : 'Isi dosis tiap hari (0 bila tunda).'}
            </p>
          </div>

          {position ? (
            <p className={`text-xs font-semibold ${position === 'in' ? 'text-accent' : 'text-[var(--warn-strong)]'}`}>
              INR {mg(inr)}: {position === 'in' ? 'dalam target' : position === 'below' ? 'di bawah target' : 'di atas target'}{' '}
              {range ? `(${mg(range[0])}–${mg(range[1])})` : ''}
            </p>
          ) : !inrKnown ? (
            <Empty>Isi INR hari ini di atas.</Empty>
          ) : null}

          <div>
            <p className="mb-1 text-[11px] font-medium text-fg-muted">Ubah total mingguan (keputusan dokter)</p>
            <div className="flex flex-wrap gap-1">
              {CHANGES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={customTotal === '' && change === value}
                  onClick={() => {
                    setChange(value);
                    setCustomTotal('');
                    setInserted(null);
                  }}
                  className={`min-h-tap rounded-lg border px-2 text-xs [@media(pointer:fine)]:min-h-8 ${
                    customTotal === '' && change === value ? 'border-accent font-semibold text-accent' : 'border-border text-fg-muted'
                  }`}
                >
                  {value > 0 ? `+${value}%` : value === 0 ? 'Tetap' : `${value}%`}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="text-[11px] text-fg-muted">
                atau total baru (mg/minggu)
                <input
                  inputMode="decimal"
                  value={customTotal}
                  onChange={(event) => {
                    setCustomTotal(event.target.value.replace(/[^\d.,]/g, '').replace(',', '.'));
                    setInserted(null);
                  }}
                  className="mt-0.5 block min-h-tap w-28 rounded-lg border border-border bg-surface px-2 text-sm tabular-nums"
                />
              </label>
              <Segmented
                label="Langkah dosis"
                value={step}
                onChange={setStep}
                options={[
                  { value: '1', label: '1 mg (½ tab 2 mg)' },
                  { value: '0.5', label: '0,5 mg' },
                ]}
              />
            </div>
          </div>

          {next && line ? (
            <ResultBlock line={line}>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
                {WEEKDAYS.map((name, index) => (
                  <div key={name}>
                    <p className="text-fg-muted">{name.slice(0, 3)}</p>
                    <p className={`font-semibold tabular-nums ${next[index] !== doses[index] ? 'text-accent' : ''}`}>{mg(next[index]!)}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs font-medium">
                {describeSchedule(next)} · {mg(weeklyTotal(next))} mg/minggu
                {total !== null && total > 0
                  ? ` (${weeklyTotal(next) >= total ? '+' : ''}${mg(Math.round(((weeklyTotal(next) - total) / total) * 1000) / 10)}%)`
                  : ''}
              </p>
            </ResultBlock>
          ) : (
            <Empty>Pilih perubahan atau isi total baru.</Empty>
          )}
        </>
      )}

      {line && onInsertTerapi ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setInserted(onInsertTerapi(line) ? 'ok' : 'none')}
            className="min-h-tap rounded-lg bg-accent px-3 text-xs font-medium text-white"
          >
            Sisipkan ke Terapi
          </button>
          {inserted === 'ok' ? <span className="text-[11px] text-fg-muted">Ditambahkan ke daftar Terapi ✓</span> : null}
          {inserted === 'none' ? (
            <span className="text-[11px] text-[var(--danger)]">Tidak ada bagian Terapi di catatan — pakai Salin baris.</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
