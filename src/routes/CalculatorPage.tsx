import { useMemo, useState } from 'react';

import { AppShell } from '@/components/common/AppShell';
import { BAND_LABELS, calculateUrineOutput } from '@/domain/calc/urineOutput';
import { OSMOLALITY_BANDS, calculateOsmolality } from '@/domain/calc/sodium';
import { copyText } from '@/lib/clipboard';

/**
 * External link, not a link card built from a domain helper.
 *
 * The sodium and potassium correction cards were removed here, not fixed a
 * second time. The potassium rewrite in `sodium.ts` (2026-08-31) replaced one
 * wrong formula with a different one built from web references rather than
 * from a source Avicenna could check against RSWS protocol, and that is not a
 * gap a better formula closes — it is a reason not to own the calculation.
 * ElektroCalc is Avicenna's own tool and stays the source of truth for both.
 */
const ELECTROLYTE_CALCULATOR_URL = 'https://nottezio.github.io/elektrocalc/';

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
        <ElectrolyteCalculatorCard />
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

/**
 * Sodium and potassium correction, out.
 *
 * They were domain helpers here twice, and wrong twice in different ways: the
 * first sodium/potassium pass conflated a total-body deficit with an IV dose,
 * and the potassium rewrite fixed that by building a new formula from web
 * references — better-sourced, but still not something Avicenna could check
 * against RSWS's own protocol, and still Claude's arithmetic standing behind a
 * dosing number on a ward. That is the wrong place for a correction
 * calculation to live regardless of which formula is in it.
 *
 * A link, not an embed, and not a domain module reimplementing what the linked
 * tool does. Embedding would mean this app owning the calculation again under
 * a different name.
 */
function ElectrolyteCalculatorCard(): JSX.Element {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">Koreksi natrium & kalium</h2>
      <p className="mt-0.5 text-xs text-fg-muted">ElektroCalc — kalkulator elektrolit Avicenna.</p>
      <a
        href={ELECTROLYTE_CALCULATOR_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-3 flex min-h-tap items-center justify-center rounded-lg border border-border bg-bg-subtle px-3 text-sm font-medium text-accent"
      >
        Buka ElektroCalc ↗
      </a>
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
