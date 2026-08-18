import { useMemo, useState } from 'react';

import { AppShell } from '@/components/common/AppShell';
import { BAND_LABELS, calculateUrineOutput } from '@/domain/calc/urineOutput';
import {
  OSMOLALITY_BANDS,
  calculateOsmolality,
  calculateSodiumCorrection,
  type Sex,
} from '@/domain/calc/sodium';
import { copyText } from '@/lib/clipboard';

/**
 * Bedside calculations, starting with urine output.
 *
 * One card per calculation, so adding the next is adding a card rather than
 * reworking a screen. Each one ends in a line that can be pasted into a note —
 * the arithmetic is not the point on its own, the sentence it produces is.
 *
 * Nothing here is stored. A calculation is a scratch step on the way to a line
 * of text, and keeping a history of them would be keeping numbers with no
 * patient attached to them.
 */
export default function CalculatorPage(): JSX.Element {
  return (
    <AppShell title="Kalkulator">
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-4">
        <UrineOutputCard />
        <SodiumCard />
        <OsmolalityCard />
        <p className="px-1 text-[11px] text-fg-faint">
          Kalkulator lain menyusul. Hasil tidak disimpan — salin barisnya ke catatan.
        </p>
      </div>
    </AppShell>
  );
}

function UrineOutputCard(): JSX.Element {
  const [volume, setVolume] = useState('');
  const [hours, setHours] = useState('24');
  const [weight, setWeight] = useState('');
  const [copied, setCopied] = useState(false);

  const result = useMemo(
    () =>
      calculateUrineOutput({
        volumeMl: Number(volume),
        hours: Number(hours),
        weightKg: Number(weight),
      }),
    [volume, hours, weight],
  );

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">Urine output</h2>
      <p className="mt-0.5 text-xs text-fg-muted">Volume, lama penampungan, berat badan.</p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <NumberField label="Volume (cc)" value={volume} onChange={setVolume} autoFocus />
        <NumberField label="Lama (jam)" value={hours} onChange={setHours} />
        <NumberField label="Berat (kg)" value={weight} onChange={setWeight} />
      </div>

      {result ? (
        <div className="mt-3 rounded-lg border border-border bg-bg-subtle p-3">
          <p className="text-lg font-semibold">
            {result.rate} <span className="text-xs font-normal text-fg-muted">cc/kgbb/jam</span>
          </p>
          <p className="mt-0.5 text-xs text-fg-muted">
            {BAND_LABELS[result.band]}
            {Number(hours) !== 24 ? ` · setara ${result.perDayMl} cc/24 jam` : ''}
          </p>

          <p className="mt-2 break-words font-mono text-[11px] leading-relaxed">{result.line}</p>
          <button
            type="button"
            onClick={() => {
              void copyText(result.line).then((ok) => {
                setCopied(ok);
                window.setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="mt-2 min-h-tap rounded-lg border border-accent px-3 text-xs font-medium text-accent"
          >
            {copied ? 'Tersalin ✓' : 'Salin baris'}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-fg-faint">
          Isi ketiganya untuk menghitung. Tanpa berat badan tidak ada laju yang bisa dihitung.
        </p>
      )}
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  autoFocus?: boolean;
}): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-fg-muted">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        autoFocus={autoFocus}
        // Kept as text with a decimal keypad: `type="number"` on a phone
        // silently drops a value when a stray character is typed, and a blank
        // field that used to hold a number is worse than a visible typo.
        onChange={(event) => onChange(event.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))}
        className="min-h-tap w-full rounded-lg border border-border bg-surface px-2 text-center text-sm outline-none"
      />
    </label>
  );
}

function SodiumCard(): JSX.Element {
  const [current, setCurrent] = useState('');
  const [target, setTarget] = useState('140');
  const [weight, setWeight] = useState('');
  const [sex, setSex] = useState<Sex>('L');
  const [rate, setRate] = useState('0.5');
  const [copied, setCopied] = useState(false);

  const result = useMemo(
    () =>
      calculateSodiumCorrection({
        current: Number(current),
        target: Number(target),
        weightKg: Number(weight),
        sex,
        ratePerHour: Number(rate),
      }),
    [current, target, weight, sex, rate],
  );

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">Koreksi natrium</h2>
      <p className="mt-0.5 text-xs text-fg-muted">
        (Target − Na) × {sex === 'L' ? '0.6' : '0.5'} × BB. Dikoreksi dengan NaCl 3%.
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <NumberField label="Na saat ini" value={current} onChange={setCurrent} />
        <NumberField label="Target" value={target} onChange={setTarget} />
        <NumberField label="Berat (kg)" value={weight} onChange={setWeight} />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <span className="mb-1 block text-[11px] text-fg-muted">Jenis kelamin</span>
          <div className="flex gap-1">
            {(['L', 'P'] as Sex[]).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={sex === value}
                onClick={() => setSex(value)}
                className={[
                  'min-h-tap flex-1 rounded-lg border text-xs',
                  sex === value
                    ? 'border-accent bg-bg-subtle font-medium text-accent'
                    : 'border-border text-fg-muted',
                ].join(' ')}
              >
                {value === 'L' ? 'Laki-laki' : 'Perempuan'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1 block text-[11px] text-fg-muted">Kecepatan</span>
          <div className="flex gap-1">
            {['0.5', '1'].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={rate === value}
                onClick={() => setRate(value)}
                className={[
                  'min-h-tap flex-1 rounded-lg border text-xs',
                  rate === value
                    ? 'border-accent bg-bg-subtle font-medium text-accent'
                    : 'border-border text-fg-muted',
                ].join(' ')}
              >
                {value} meq/jam
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-1 text-[11px] text-fg-faint">
        0.5 meq/jam bila sadar penuh; 1 meq/jam bila kesadaran menurun. Terlalu cepat berisiko
        mielinolisis pontin.
      </p>

      {result ? (
        <div className="mt-3 rounded-lg border border-border bg-bg-subtle p-3">
          <p className="text-lg font-semibold">
            {result.deficitMeq} <span className="text-xs font-normal text-fg-muted">meq</span>
          </p>
          <p className="mt-0.5 text-xs text-fg-muted">
            Habis dalam {result.hours} jam · NaCl 3% ≈ {result.volume3PercentMl} cc
          </p>
          <p className="mt-2 break-words font-mono text-[11px] leading-relaxed">{result.line}</p>
          <CopyLine text={result.line} copied={copied} setCopied={setCopied} />
        </div>
      ) : (
        <p className="mt-3 text-xs text-fg-faint">
          Isi Na, target, dan berat badan. Tidak dihitung bila Na sudah mencapai target.
        </p>
      )}
    </section>
  );
}

function OsmolalityCard(): JSX.Element {
  const [sodium, setSodium] = useState('');
  const [glucose, setGlucose] = useState('');
  const [bun, setBun] = useState('');
  const [copied, setCopied] = useState(false);

  const result = useMemo(
    () =>
      calculateOsmolality({
        sodium: Number(sodium),
        glucose: Number(glucose),
        bun: Number(bun),
      }),
    [sodium, glucose, bun],
  );

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">Osmolalitas plasma</h2>
      <p className="mt-0.5 text-xs text-fg-muted">2(Na) + Glukosa/18 + BUN/2.8</p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <NumberField label="Na (mmol/L)" value={sodium} onChange={setSodium} />
        <NumberField label="Glukosa (mg/dL)" value={glucose} onChange={setGlucose} />
        <NumberField label="BUN (mg/dL)" value={bun} onChange={setBun} />
      </div>

      <p className="mt-1 text-[11px] text-fg-faint">
        Perhatikan satuan: natrium mmol/L, glukosa dan BUN mg/dL. Pembagi 18 dan 2.8 adalah
        konversi satuan, bukan faktor koreksi.
      </p>

      {result ? (
        <div className="mt-3 rounded-lg border border-border bg-bg-subtle p-3">
          <p className="text-lg font-semibold">
            {result.value}{' '}
            <span className="text-xs font-normal text-fg-muted">mOsm/kg</span>
          </p>
          <p className="mt-0.5 text-xs text-fg-muted">{OSMOLALITY_BANDS[result.band]}</p>
          <p className="mt-2 break-words font-mono text-[11px] leading-relaxed">{result.line}</p>
          <CopyLine text={result.line} copied={copied} setCopied={setCopied} />
        </div>
      ) : (
        <p className="mt-3 text-xs text-fg-faint">Isi ketiganya untuk menghitung.</p>
      )}
    </section>
  );
}

function CopyLine({
  text,
  copied,
  setCopied,
}: {
  text: string;
  copied: boolean;
  setCopied: (next: boolean) => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => {
        void copyText(text).then((ok) => {
          setCopied(ok);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="mt-2 min-h-tap rounded-lg border border-accent px-3 text-xs font-medium text-accent"
    >
      {copied ? 'Tersalin ✓' : 'Salin baris'}
    </button>
  );
}
