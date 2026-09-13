import { useMemo, useState } from 'react';

import { AppShell } from '@/components/common/AppShell';
import { BAND_LABELS, calculateUrineOutput } from '@/domain/calc/urineOutput';
import { OSMOLALITY_BANDS, calculateOsmolality } from '@/domain/calc/sodium';
import { correctSodium, formatSodiumCorrection } from '@/domain/calc/sodiumGlucose';
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

/** Syringe pump rates — Avicenna's own tool, same reasoning as ElektroCalc. */
const INFUSION_CALCULATOR_URL = 'https://nottezio.github.io/infucalc/';

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
        <ExternalCalculatorCard
          title="Koreksi natrium & kalium"
          subtitle="ElektroCalc — kalkulator elektrolit."
          href={ELECTROLYTE_CALCULATOR_URL}
          label="Buka ElektroCalc"
        />
        <ExternalCalculatorCard
          title="Laju syringe pump"
          subtitle="InfuCalc — kalkulator laju infus dan syringe pump."
          href={INFUSION_CALCULATOR_URL}
          label="Buka InfuCalc"
        />
        <SodiumGlucoseCard />
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
function ExternalCalculatorCard({
  title,
  subtitle,
  href,
  label,
}: {
  title: string;
  subtitle: string;
  href: string;
  label: string;
}): JSX.Element {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-0.5 text-xs text-fg-muted">{subtitle}</p>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="mt-3 flex min-h-tap items-center justify-center rounded-lg border border-border bg-bg-subtle px-3 text-sm font-medium text-accent"
      >
        {label} ↗
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


/**
 * Corrected sodium in hyperglycaemia.
 *
 * A card here rather than a link to ElektroCalc, and the distinction matters:
 * the replacement calculators were removed from this app because they produce
 * a DOSE, which has to match a protocol only the ward owns. This produces a
 * reading — what the sodium would be at a normal glucose — and prescribes
 * nothing.
 *
 * Both published factors are shown, never one. They disagree, and at a glucose
 * of 600 they differ by about 4 mmol/L — the gap between calling the same
 * sample hyponatraemic and calling it normal. Showing one would present a
 * contested number as a settled one.
 */
function SodiumGlucoseCard(): JSX.Element {
  const [sodium, setSodium] = useState('');
  const [glucose, setGlucose] = useState('');
  const [copied, setCopied] = useState(false);

  const result = useMemo(
    () => correctSodium(Number(sodium), Number(glucose)),
    [sodium, glucose],
  );
  const ready = sodium.trim() !== '' && glucose.trim() !== '' && result !== null;

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">Koreksi natrium pada hiperglikemia</h2>
      <p className="mt-0.5 text-xs text-fg-muted">
        Natrium terukur dikoreksi terhadap glukosa. Bukan dosis koreksi.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <NumberField label="Na terukur (mmol/L)" value={sodium} onChange={setSodium} />
        <NumberField label="GDS (mg/dL)" value={glucose} onChange={setGlucose} />
      </div>

      {ready && result ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-bg-subtle px-3 py-2">
              <p className="text-lg font-semibold">{result.katz}</p>
              <p className="text-[11px] text-fg-muted">Katz (1.6)</p>
            </div>
            <div className="rounded-lg bg-bg-subtle px-3 py-2">
              <p className="text-lg font-semibold">{result.hillier}</p>
              <p className="text-[11px] text-fg-muted">Hillier (2.4)</p>
            </div>
          </div>

          {/*
            Said only when it is true. At a mild hyperglycaemia the two agree
            to within rounding, and a permanent warning about a disagreement
            that is not there is the kind nobody reads by the third time.
          */}
          {result.factorsDiverge ? (
            <p className="mt-2 text-[11px] text-fg-muted">
              Kedua faktor berbeda {Math.round((result.hillier - result.katz) * 10) / 10} mmol/L
              pada GDS ini. Hillier lebih sesuai pada hiperglikemia berat.
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => {
              void copyText(formatSodiumCorrection(Number(sodium), Number(glucose), result));
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
            className="mt-3 min-h-tap w-full rounded-lg border border-border px-3 text-sm font-medium"
          >
            {copied ? 'Tersalin' : 'Salin baris'}
          </button>
        </>
      ) : null}

      <p className="mt-2 text-[11px] text-fg-faint">
        Katz NEJM 1973 · Hillier Am J Med 1999. Glukosa dalam mg/dL.
      </p>
    </section>
  );
}
