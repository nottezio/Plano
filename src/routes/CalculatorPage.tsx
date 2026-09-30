import { useMemo, useState, type ReactNode } from 'react';

import { AppShell } from '@/components/common/AppShell';
import {
  BAND_LABELS,
  URINE_OUTPUT_SOURCES,
  calculateUrineOutput,
} from '@/domain/calc/urineOutput';
import {
  OSMOLALITY_SOURCES,
  UREA_DIVISOR,
  UREA_LABEL,
  calculateOsmolality,
  readEffective,
  readTotal,
  type OsmolalityReading,
  type UreaKind,
} from '@/domain/calc/sodium';
import {
  SODIUM_GLUCOSE_SOURCES,
  correctSodium,
  formatSodiumCorrection,
} from '@/domain/calc/sodiumGlucose';
import {
  MOLAR_MASS,
  UREUM_PER_BUN,
  convertCreatinine,
  convertGlucose,
  convertUrea,
  type UreaUnit,
} from '@/domain/calc/units';
import { readReferenceRanges } from '@/components/settings/ReferenceRanges';
import { copyText } from '@/lib/clipboard';

/**
 * Sodium and potassium REPLACEMENT and syringe-pump rates are links, not cards.
 *
 * Both were once domain helpers here and wrong in turn; a dose has to match a
 * protocol only the ward owns. ElektroCalc and InfuCalc are Avicenna's own
 * tools and stay the source of truth for any dose.
 */
const ELECTROLYTE_CALCULATOR_URL = 'https://nottezio.github.io/elektrocalc/';
const INFUSION_CALCULATOR_URL = 'https://nottezio.github.io/infucalc/';

/**
 * Bedside calculations (revamped 2026-10-01).
 *
 * Grouped by what they are for, with a jump bar, two columns on a laptop.
 * Every card has the same shape — title, the formula, inputs, a result block
 * with a line to paste, and a "Rujukan" list naming where each formula and
 * cut-off comes from. A calculation with no citation does not belong here.
 *
 * Nothing is stored: a calculation is a scratch step on the way to a line of
 * text, and a history would be numbers with no patient attached.
 */
const GROUPS = [
  { id: 'calc-cairan', label: 'Ginjal & cairan' },
  { id: 'calc-elektrolit', label: 'Elektrolit' },
  { id: 'calc-konversi', label: 'Konversi satuan' },
  { id: 'calc-alat', label: 'Alat lain' },
] as const;

export default function CalculatorPage(): JSX.Element {
  return (
    <AppShell title="Kalkulator">
      <div className="mx-auto w-full max-w-5xl px-4 pb-8">
        <nav
          aria-label="Kelompok kalkulator"
          className="sticky top-0 z-10 -mx-4 overflow-x-auto border-b border-border bg-bg px-4 py-2"
        >
          <ul className="flex w-max gap-2">
            {GROUPS.map((group) => (
              <li key={group.id}>
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById(group.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                  className="min-h-tap whitespace-nowrap rounded-full border border-border bg-surface px-3 text-sm text-fg-muted [@media(pointer:fine)]:min-h-8"
                >
                  {group.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <Group id="calc-cairan" label="Ginjal & cairan">
          <UrineOutputCard />
          <OsmolalityCard />
        </Group>

        <Group id="calc-elektrolit" label="Elektrolit">
          <SodiumGlucoseCard />
          <LinkCard
            title="Koreksi natrium & kalium"
            subtitle="Defisit, dosis dan laju koreksi: ElektroCalc, sesuai protokol bangsal."
            href={ELECTROLYTE_CALCULATOR_URL}
            label="Buka ElektroCalc"
          />
        </Group>

        <Group id="calc-konversi" label="Konversi satuan">
          <UnitConverterCard />
        </Group>

        <Group id="calc-alat" label="Alat lain">
          <LinkCard
            title="Laju syringe pump"
            subtitle="InfuCalc — kalkulator laju infus dan syringe pump."
            href={INFUSION_CALCULATOR_URL}
            label="Buka InfuCalc"
          />
        </Group>

        <p className="mt-6 px-1 text-[11px] text-fg-faint">
          Hasil tidak disimpan — salin barisnya ke catatan. Setiap rumus dan ambang memakai
          rujukan yang tertulis di kartunya.
        </p>
      </div>
    </AppShell>
  );
}

function Group({ id, label, children }: { id: string; label: string; children: ReactNode }): JSX.Element {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-16 pt-5">
      <h2 id={`${id}-h`} className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
        {label}
      </h2>
      <div className="grid items-start gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}

/** The shape every calculator shares. */
function CalcCard({
  title,
  formula,
  children,
  sources,
}: {
  title: string;
  formula: ReactNode;
  children: ReactNode;
  sources: readonly string[];
}): JSX.Element {
  return (
    <article className="flex flex-col rounded-2xl border border-border bg-surface p-4">
      <h3 className="text-[15px] font-semibold">{title}</h3>
      <p className="mt-0.5 font-mono text-[11px] leading-relaxed text-fg-muted">{formula}</p>
      <div className="mt-3 flex-1">{children}</div>
      <details className="mt-3 border-t border-border pt-2">
        <summary className="min-h-tap cursor-pointer select-none py-2 text-xs font-medium text-fg-muted [@media(pointer:fine)]:min-h-0">
          Rujukan
        </summary>
        <ol className="mt-1 list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-fg-faint">
          {sources.map((source) => (
            <li key={source}>{source}</li>
          ))}
        </ol>
      </details>
    </article>
  );
}

function ResultBlock({ children, line }: { children: ReactNode; line?: string }): JSX.Element {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 rounded-xl border border-border bg-bg-subtle p-3">
      {children}
      {line ? (
        <>
          <p className="mt-2 break-words font-mono text-[11px] leading-relaxed">{line}</p>
          <button
            type="button"
            onClick={() => {
              void copyText(line).then((ok) => {
                setCopied(ok);
                window.setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="mt-2 min-h-tap rounded-lg border border-accent px-3 text-xs font-medium text-accent"
          >
            {copied ? 'Tersalin ✓' : 'Salin baris'}
          </button>
        </>
      ) : null}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }): JSX.Element {
  return <p className="mt-3 text-xs text-fg-faint">{children}</p>;
}

function Big({ value, unit, caption }: { value: ReactNode; unit: string; caption?: ReactNode }): JSX.Element {
  return (
    <div>
      <p className="text-xl font-semibold tabular-nums">
        {value} <span className="text-xs font-normal text-fg-muted">{unit}</span>
      </p>
      {caption ? <p className="text-[11px] text-fg-muted">{caption}</p> : null}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (next: T) => void;
}): JSX.Element {
  return (
    <div role="group" aria-label={label} className="flex overflow-hidden rounded-lg border border-border text-xs">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={[
            'min-h-tap flex-1 px-2',
            value === option.value ? 'bg-accent font-semibold text-white' : 'text-fg-muted',
          ].join(' ')}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-fg-muted">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        // Text with a decimal keypad: `type="number"` on a phone silently drops
        // a value when a stray character is typed.
        onChange={(event) => onChange(event.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))}
        className="min-h-tap w-full rounded-lg border border-border bg-surface px-2 text-center text-sm tabular-nums outline-none focus:border-accent"
      />
    </label>
  );
}

const typed = (...values: string[]): boolean => values.every((value) => value.trim() !== '');

function UrineOutputCard(): JSX.Element {
  const [volume, setVolume] = useState('');
  const [hours, setHours] = useState('24');
  const [weight, setWeight] = useState('');

  const result = useMemo(
    () =>
      typed(volume, hours, weight)
        ? calculateUrineOutput({ volumeMl: Number(volume), hours: Number(hours), weightKg: Number(weight) })
        : null,
    [volume, hours, weight],
  );

  return (
    <CalcCard title="Urine output" formula="volume ÷ jam ÷ berat badan" sources={URINE_OUTPUT_SOURCES}>
      <div className="grid grid-cols-3 gap-2">
        <NumberField label="Volume (cc)" value={volume} onChange={setVolume} />
        <NumberField label="Lama (jam)" value={hours} onChange={setHours} />
        <NumberField label="Berat (kg)" value={weight} onChange={setWeight} />
      </div>
      {result ? (
        <ResultBlock line={result.line}>
          <Big
            value={result.rate}
            unit="cc/kgbb/jam"
            caption={
              <>
                {BAND_LABELS[result.band]}
                {Number(hours) !== 24 ? ` · setara ${result.perDayMl} cc/24 jam` : ''}
              </>
            }
          />
        </ResultBlock>
      ) : (
        <Empty>Isi ketiganya. Tanpa berat badan tidak ada laju yang bisa dihitung.</Empty>
      )}
    </CalcCard>
  );
}

/**
 * Calculated plasma osmolality, total and effective. See `domain/calc/sodium`
 * for why the urea field asks Ureum or BUN and where each cut-off comes from.
 */
function OsmolalityCard(): JSX.Element {
  const [sodium, setSodium] = useState('');
  const [glucose, setGlucose] = useState('');
  const [urea, setUrea] = useState('');
  const [ureaKind, setUreaKind] = useState<UreaKind>('ureum');
  const range = readReferenceRanges().Osm;

  const result = useMemo(
    () =>
      typed(sodium, glucose, urea)
        ? calculateOsmolality({
            sodium: Number(sodium),
            glucose: Number(glucose),
            urea: Number(urea),
            ureaKind,
          })
        : null,
    [sodium, glucose, urea, ureaKind],
  );

  return (
    <CalcCard
      title="Osmolalitas plasma (hitung)"
      formula={`2(Na) + Glukosa/18 + ${UREA_LABEL[ureaKind]}/${UREA_DIVISOR[ureaKind]}`}
      sources={OSMOLALITY_SOURCES}
    >
      <Segmented
        label="Satuan urea"
        value={ureaKind}
        onChange={setUreaKind}
        options={[
          { value: 'ureum', label: 'Ureum (SIMGOS) ÷ 6' },
          { value: 'bun', label: 'BUN ÷ 2.8' },
        ]}
      />
      <div className="mt-2 grid grid-cols-3 gap-2">
        <NumberField label="Na (mmol/L)" value={sodium} onChange={setSodium} />
        <NumberField label="Glukosa (mg/dL)" value={glucose} onChange={setGlucose} />
        <NumberField label={`${UREA_LABEL[ureaKind]} (mg/dL)`} value={urea} onChange={setUrea} />
      </div>
      {result ? (
        <ResultBlock line={result.line}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Big value={result.effective} unit="mOsm/kg" caption="Efektif (tonisitas) — untuk hiponatremia" />
              <ReadingChip reading={readEffective(result.effective)} />
            </div>
            <div>
              <Big value={result.total} unit="mOsm/kg" caption={`Total (+ urea ${result.ureaTerm})`} />
              <ReadingChip reading={readTotal(result.total, range)} />
            </div>
          </div>
        </ResultBlock>
      ) : (
        <Empty>Isi ketiganya. Ureum ≠ BUN: ureum = BUN × 2.14.</Empty>
      )}
    </CalcCard>
  );
}

function ReadingChip({ reading }: { reading: OsmolalityReading }): JSX.Element {
  const style =
    reading.tone === 'normal'
      ? { borderColor: 'var(--border-strong)' }
      : reading.tone === 'low'
        ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' }
        : { borderColor: 'var(--warn-strong)', background: 'var(--warn-soft)' };
  return (
    <p className="mt-1 inline-block rounded-md border px-1.5 py-0.5 text-[11px] font-medium" style={style}>
      {reading.label}
    </p>
  );
}

/**
 * Corrected sodium in hyperglycaemia. A reading — what the sodium would be at
 * a normal glucose — not a dose. Both published factors are shown, because
 * they disagree and the gap grows with the glucose.
 */
function SodiumGlucoseCard(): JSX.Element {
  const [sodium, setSodium] = useState('');
  const [glucose, setGlucose] = useState('');

  const result = useMemo(
    () => (typed(sodium, glucose) ? correctSodium(Number(sodium), Number(glucose)) : null),
    [sodium, glucose],
  );

  return (
    <CalcCard
      title="Koreksi natrium pada hiperglikemia"
      formula="Na + faktor × (glukosa − 100)/100"
      sources={SODIUM_GLUCOSE_SOURCES}
    >
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Na terukur (mmol/L)" value={sodium} onChange={setSodium} />
        <NumberField label="GDS (mg/dL)" value={glucose} onChange={setGlucose} />
      </div>
      {result ? (
        <ResultBlock line={formatSodiumCorrection(Number(sodium), Number(glucose), result)}>
          <div className="grid grid-cols-2 gap-3">
            <Big value={result.katz} unit="mmol/L" caption="Katz (1.6)" />
            <Big value={result.hillier} unit="mmol/L" caption="Hillier (2.4)" />
          </div>
          {result.factorsDiverge ? (
            <p className="mt-2 text-[11px] text-fg-muted">
              Berbeda {Math.round((result.hillier - result.katz) * 10) / 10} mmol/L pada GDS ini.
              Hillier lebih sesuai pada glukosa &gt; 400 mg/dL.
            </p>
          ) : null}
        </ResultBlock>
      ) : (
        <Empty>Bukan dosis koreksi. Glukosa ≤ 100 mg/dL tidak dikoreksi.</Empty>
      )}
    </CalcCard>
  );
}

const UNIT_SOURCES: readonly string[] = [
  `Faktor dari massa molar: urea ${MOLAR_MASS.urea}, nitrogen urea (BUN) ${MOLAR_MASS.ureaNitrogen}, kreatinin ${MOLAR_MASS.creatinine}, glukosa ${MOLAR_MASS.glucose} g/mol. mg/dL → mmol/L = ÷ (massa molar/10).`,
  `Ureum = BUN × ${UREUM_PER_BUN.toFixed(3)} (60.06/28.014). Kreatinin 1 mg/dL = 88.4 µmol/L. Glukosa 1 mmol/L = 18.0 mg/dL.`,
];

type Analyte = 'urea' | 'creatinine' | 'glucose';

/** Urea ↔ BUN ↔ mmol/L, creatinine and glucose. */
function UnitConverterCard(): JSX.Element {
  const [analyte, setAnalyte] = useState<Analyte>('urea');
  return (
    <CalcCard
      title="Konversi satuan"
      formula="Ureum ↔ BUN ↔ mmol/L · kreatinin · glukosa"
      sources={UNIT_SOURCES}
    >
      <div role="tablist" aria-label="Analit" className="flex gap-1 border-b border-border">
        {(
          [
            ['urea', 'Ureum / BUN'],
            ['creatinine', 'Kreatinin'],
            ['glucose', 'Glukosa'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={analyte === value}
            onClick={() => setAnalyte(value)}
            className={[
              '-mb-px min-h-tap border-b-2 px-3 text-sm',
              analyte === value ? 'border-accent font-semibold text-fg' : 'border-transparent text-fg-muted',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-3">
        {analyte === 'urea' ? <UreaConverter /> : analyte === 'creatinine' ? <CreatinineConverter /> : <GlucoseConverter />}
      </div>
    </CalcCard>
  );
}

function UreaConverter(): JSX.Element {
  const [from, setFrom] = useState<UreaUnit>('ureum');
  const [value, setValue] = useState('');
  const result = typed(value) ? convertUrea(Number(value), from) : null;
  const label = { ureum: 'Ureum (mg/dL)', bun: 'BUN (mg/dL)', mmol: 'Urea (mmol/L)' }[from];
  return (
    <>
      <Segmented
        label="Dari"
        value={from}
        onChange={setFrom}
        options={[
          { value: 'ureum', label: 'Ureum mg/dL' },
          { value: 'bun', label: 'BUN mg/dL' },
          { value: 'mmol', label: 'mmol/L' },
        ]}
      />
      <div className="mt-2">
        <NumberField label={label} value={value} onChange={setValue} />
      </div>
      {result ? (
        <ResultBlock line={`Ureum ${result.ureum} mg/dL = BUN ${result.bun} mg/dL = urea ${result.mmol} mmol/L`}>
          <div className="grid grid-cols-3 gap-2">
            <Big value={result.ureum} unit="mg/dL" caption="Ureum" />
            <Big value={result.bun} unit="mg/dL" caption="BUN" />
            <Big value={result.mmol} unit="mmol/L" caption="Urea" />
          </div>
        </ResultBlock>
      ) : null}
    </>
  );
}

function CreatinineConverter(): JSX.Element {
  const [from, setFrom] = useState<'mgdl' | 'umol'>('mgdl');
  const [value, setValue] = useState('');
  const result = typed(value) ? convertCreatinine(Number(value), from) : null;
  return (
    <>
      <Segmented
        label="Dari"
        value={from}
        onChange={setFrom}
        options={[
          { value: 'mgdl', label: 'mg/dL' },
          { value: 'umol', label: 'µmol/L' },
        ]}
      />
      <div className="mt-2">
        <NumberField label={from === 'mgdl' ? 'Kreatinin (mg/dL)' : 'Kreatinin (µmol/L)'} value={value} onChange={setValue} />
      </div>
      {result ? (
        <ResultBlock line={`Kreatinin ${result.mgdl} mg/dL = ${result.umol} µmol/L`}>
          <div className="grid grid-cols-2 gap-2">
            <Big value={result.mgdl} unit="mg/dL" />
            <Big value={result.umol} unit="µmol/L" />
          </div>
        </ResultBlock>
      ) : null}
    </>
  );
}

function GlucoseConverter(): JSX.Element {
  const [from, setFrom] = useState<'mgdl' | 'mmol'>('mgdl');
  const [value, setValue] = useState('');
  const result = typed(value) ? convertGlucose(Number(value), from) : null;
  return (
    <>
      <Segmented
        label="Dari"
        value={from}
        onChange={setFrom}
        options={[
          { value: 'mgdl', label: 'mg/dL' },
          { value: 'mmol', label: 'mmol/L' },
        ]}
      />
      <div className="mt-2">
        <NumberField label={from === 'mgdl' ? 'Glukosa (mg/dL)' : 'Glukosa (mmol/L)'} value={value} onChange={setValue} />
      </div>
      {result ? (
        <ResultBlock line={`Glukosa ${result.mgdl} mg/dL = ${result.mmol} mmol/L`}>
          <div className="grid grid-cols-2 gap-2">
            <Big value={result.mgdl} unit="mg/dL" />
            <Big value={result.mmol} unit="mmol/L" />
          </div>
        </ResultBlock>
      ) : null}
    </>
  );
}

function LinkCard({
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
    <article className="rounded-2xl border border-border bg-surface p-4">
      <h3 className="text-[15px] font-semibold">{title}</h3>
      <p className="mt-0.5 text-xs text-fg-muted">{subtitle}</p>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="mt-3 flex min-h-tap items-center justify-center rounded-lg border border-border bg-bg-subtle px-3 text-sm font-medium text-accent"
      >
        {label} ↗
      </a>
    </article>
  );
}
