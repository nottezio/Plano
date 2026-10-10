import { useMemo, useState } from 'react';

import { readCoagFromNote } from '@/domain/calc/heparin';
import {
  INR_TARGETS,
  INTERACTING_DRUGS,
  LAST_NOMOGRAM_DAY,
  LOWER_START_FACTORS,
  NO_WARFARIN_STOPS,
  OVERLAP_GUIDANCE,
  WARFARIN_SOURCES,
  dayDose,
  lowerStartNote,
  warfarinProblems,
  warfarinStops,
  type InrTarget,
  type LowerStartKey,
  type WarfarinStops,
} from '@/domain/calc/warfarin';
import { Big, CalcCard, Empty, NumberField, ResultBlock } from './ClinicalCards';

/**
 * Warfarin, inpatient initiation (2026-10-10). See domain/calc/warfarin.
 * Same handoff as the heparin card: prefill from the open note, and
 * "Sisipkan ke Terapi" only in the floating calculator on a note.
 */

const num = (text: string): number => (text.trim() === '' ? Number.NaN : Number(text));
const mg = (value: number): string => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value);

const STOP_LABELS: ReadonlyArray<[keyof WarfarinStops, string]> = [
  ['activeBleeding', 'Perdarahan aktif'],
  ['baselineInrHigh', 'INR awal sudah memanjang'],
  ['severeLiverDisease', 'Penyakit hati berat'],
];

export function WarfarinCard({
  noteBody,
  onInsertTerapi,
}: {
  noteBody?: string | undefined;
  onInsertTerapi?: ((line: string) => boolean) | undefined;
}): JSX.Element {
  const fromNote = useMemo(() => (noteBody ? readCoagFromNote(noteBody) : {}), [noteBody]);
  const drugsInNote = useMemo(
    () =>
      new Set(
        noteBody
          ? INTERACTING_DRUGS.filter((drug) => new RegExp(`\\b${drug.name}`, 'i').test(noteBody)).map((drug) => drug.name)
          : [],
      ),
    [noteBody],
  );

  const [target, setTarget] = useState<InrTarget | null>(null);
  const [day, setDay] = useState('1');
  const [inr, setInr] = useState(fromNote.inr !== undefined ? String(fromNote.inr) : '');
  const [stops, setStops] = useState<WarfarinStops>(NO_WARFARIN_STOPS);
  const [lower, setLower] = useState<Set<LowerStartKey>>(new Set());
  const [inserted, setInserted] = useState<'ok' | 'none' | null>(null);

  const dayNumber = Math.trunc(num(day));
  const problems = warfarinProblems({ target, day: dayNumber, inr: num(inr) });
  const warnings = warfarinStops(stops);
  const nomogram = INR_TARGETS.find((candidate) => candidate.value === target)?.nomogram ?? false;
  const result = problems.length === 0 && nomogram && warnings.length === 0 ? dayDose(dayNumber, num(inr)) : null;
  const lowerNote = lowerStartNote(lower);

  return (
    <CalcCard
      title="Warfarin — mulai di rawat inap"
      formula="Nomogram 5 mg (Crowther, Harrison & Hirsh 1997) · target INR 2,0–3,0 · hari 1–6"
      sources={WARFARIN_SOURCES}
    >
      <p className="mb-2 rounded-lg bg-bg-subtle px-2 py-1.5 text-[11px] leading-snug text-fg-muted">
        Saran hitungan, bukan instruksi. Cocokkan dengan protokol RS. Hanya untuk memulai warfarin, bukan penyesuaian rawat
        jalan.
      </p>

      <p className="mb-1 text-[11px] font-medium text-fg-muted">Target INR (wajib dipilih)</p>
      <div role="group" aria-label="Target INR" className="grid grid-cols-2 gap-1">
        {INR_TARGETS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={target === option.value}
            onClick={() => setTarget(option.value)}
            className={[
              'min-h-tap rounded-lg border px-2 text-left text-xs',
              target === option.value ? 'border-accent font-semibold text-accent' : 'border-border text-fg-muted',
            ].join(' ')}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <NumberField label="Hari ke- (1–6)" value={day} onChange={setDay} />
        <NumberField label="INR pagi ini" value={inr} onChange={setInr} />
      </div>
      {fromNote.inr !== undefined ? (
        <p className="mt-1 text-[11px] text-fg-faint">INR diisi dari lab terbaru di catatan ({mg(fromNote.inr)}). Periksa tanggalnya.</p>
      ) : null}

      <fieldset className="mt-3">
        <legend className="mb-1 text-[11px] font-medium text-fg-muted">Sebelum memberi dosis — ada?</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {STOP_LABELS.map(([key, label]) => (
            <label key={key} className="flex min-h-tap items-center gap-2 text-xs [@media(pointer:fine)]:min-h-8">
              <input
                type="checkbox"
                checked={stops[key]}
                onChange={(event) => setStops((current) => ({ ...current, [key]: event.target.checked }))}
                className="h-4 w-4 accent-[var(--danger)]"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-2">
        <legend className="mb-1 text-[11px] font-medium text-fg-muted">Butuh dosis awal lebih rendah?</legend>
        <div className="grid grid-cols-2 gap-1">
          {LOWER_START_FACTORS.map((factor) => (
            <label key={factor.key} className="flex min-h-tap items-center gap-2 text-xs [@media(pointer:fine)]:min-h-8">
              <input
                type="checkbox"
                checked={lower.has(factor.key)}
                onChange={(event) =>
                  setLower((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(factor.key);
                    else next.delete(factor.key);
                    return next;
                  })
                }
                className="h-4 w-4"
              />
              {factor.label}
            </label>
          ))}
        </div>
        {lowerNote ? <p className="mt-1 text-[11px] font-medium text-[var(--warn-strong)]">{lowerNote}</p> : null}
      </fieldset>

      <details className="mt-2 rounded-lg border border-border text-xs" open={drugsInNote.size > 0}>
        <summary className="min-h-tap cursor-pointer px-2 py-2 font-medium text-fg-muted [@media(pointer:fine)]:min-h-0">
          Obat yang menguatkan efek warfarin{drugsInNote.size > 0 ? ` · ${drugsInNote.size} ada di catatan` : ''}
        </summary>
        <ul className="flex flex-wrap gap-1 px-2 pb-2">
          {INTERACTING_DRUGS.map((drug) => (
            <li
              key={drug.name}
              title={drug.level === 'highly probable' ? 'Ageno 2012 Tabel 1: highly probable' : 'Ageno 2012 Tabel 1: probable'}
              className={[
                'rounded-full border px-2 py-0.5 text-[11px]',
                drugsInNote.has(drug.name) ? 'border-[var(--warn-strong)] font-semibold' : 'border-border text-fg-muted',
              ].join(' ')}
            >
              {drug.name}
            </li>
          ))}
        </ul>
        <p className="px-2 pb-2 text-[11px] text-fg-faint">
          Dari Ageno 2012, Tabel 1 (potensiasi, "highly probable"/"probable"). Tabel tidak memberi penyesuaian dosis: pantau
          INR lebih ketat.
        </p>
      </details>

      {warnings.length > 0 ? (
        <div role="alert" className="mt-3 rounded-xl border border-[var(--danger)] p-3 text-xs">
          <p className="font-semibold text-[var(--danger)]">Dosis tidak ditampilkan</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : problems.length > 0 ? (
        <Empty>{problems.join(' ')}</Empty>
      ) : !nomogram ? (
        <div className="mt-3 rounded-xl border border-border bg-bg-subtle p-3 text-xs">
          Nomogram ini dipakai untuk target INR 2,0–3,0, jadi dosis harian tidak dihitung untuk target ini. Pakai protokol RS;
          panduan katup mekanik ada di bawah.
        </div>
      ) : result ? (
        <ResultBlock line={result.line}>
          <Big
            value={result.maxMg === 0 ? 'Tunda' : result.minMg === result.maxMg ? mg(result.minMg) : `${mg(result.minMg)}–${mg(result.maxMg)}`}
            unit={result.maxMg === 0 ? 'malam ini' : 'mg oral, malam ini'}
            caption={`Hari ke-${result.day}${result.rows.length > 0 ? `, INR ${inr}` : ''}`}
          />
          {result.between ? (
            <p className="mt-2 text-[11px] font-medium text-[var(--warn-strong)]">
              INR di antara dua baris tabel ({result.rows.map((row) => row.printed.inr).join(' dan ')}); kedua rentang ditampilkan.
            </p>
          ) : null}
          {result.rows.length > 0 ? (
            <p className="mt-1 text-[10px] text-fg-faint">
              Tabel hari ke-{result.day}: {result.rows.map((row) => `INR ${row.printed.inr} → ${row.printed.dose}`).join('; ')}
            </p>
          ) : null}
          {result.day === 2 ? (
            <p className="mt-1 text-[11px] text-fg-muted">
              Dosis hari ke-2 diturunkan hanya bila INR 12–16 jam setelah dosis pertama sudah menunjukkan efek berlebih.
            </p>
          ) : null}
          <p className="mt-1 text-[11px] text-fg-muted">
            INR tiap pagi sampai INR 2,0–3,0 dua hari berturut-turut.
          </p>
        </ResultBlock>
      ) : (
        <Empty>
          Nomogram berakhir di hari ke-{LAST_NOMOGRAM_DAY}. Setelahnya, dosis mengikuti INR sesuai protokol RS / klinik
          antikoagulan.
        </Empty>
      )}

      {result && warnings.length === 0 && onInsertTerapi ? (
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setInserted(onInsertTerapi(result.line) ? 'ok' : 'none')}
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

      <details className="mt-3 rounded-lg border border-border text-xs">
        <summary className="min-h-tap cursor-pointer px-2 py-2 font-medium text-fg-muted [@media(pointer:fine)]:min-h-0">
          Overlap heparin &amp; katup mekanik
        </summary>
        <ul className="list-disc space-y-1 px-2 pb-2 pl-6 text-[11px] leading-snug">
          {OVERLAP_GUIDANCE.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      </details>
    </CalcCard>
  );
}
