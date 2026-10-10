import { useMemo, useState } from 'react';

import {
  HEPARIN_SOURCES,
  NO_STOPS,
  acsApttPosition,
  acsStart,
  adjustDose,
  adjustProblems,
  formatRatio,
  formatUnits,
  heparinStops,
  readCoagFromNote,
  startDose,
  type HeparinStops,
} from '@/domain/calc/heparin';
import { ESC_2023_ACS, RASCHKE_1993, withTargetHigh, type HeparinRow } from '@/domain/calc/heparinProtocol';
import { readHeparinSettings } from '@/components/settings/HeparinSettings';
import { Big, CalcCard, Empty, NumberField, ResultBlock, Segmented } from './ClinicalCards';

/**
 * Heparin by aPTT (2026-10-10). See domain/calc/heparin for the rules.
 *
 * `noteBody` and `onInsertTerapi` exist only in the floating calculator on a
 * patient's note: the first prefills aPTT, control and weight from the note
 * (always editable), the second adds the suggested line to our Terapi list.
 * On the Kalkulator page there is no patient, so neither is passed and the
 * card offers "Salin baris" only.
 */

const num = (text: string): number => (text.trim() === '' ? Number.NaN : Number(text));
const show = (value: number | undefined): string => (value === undefined ? '' : String(value));
const one = (value: number): string => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value);

function rowText(row: HeparinRow, low: number | null): string {
  const range =
    row.maxRatio === null
      ? `> ${formatRatio(low ?? 0)} × kontrol`
      : low === null
        ? `< ${formatRatio(row.maxRatio)} × kontrol`
        : `${formatRatio(low)}–${formatRatio(row.maxRatio)} × kontrol`;
  const steps: string[] = [];
  if (row.holdMinutes > 0) steps.push(`stop ${row.holdMinutes / 60} jam`);
  if (row.bolusPerKg > 0) steps.push(`bolus ${row.bolusPerKg} U/kg`);
  steps.push(
    row.rateChangePerKg === 0
      ? 'laju tetap'
      : `${row.rateChangePerKg > 0 ? 'naikkan' : 'turunkan'} ${Math.abs(row.rateChangePerKg)} U/kgBB/jam`,
  );
  return `${range}: ${steps.join(', lalu ')}`;
}

const STOP_LABELS: ReadonlyArray<[keyof HeparinStops, string]> = [
  ['activeBleeding', 'Perdarahan aktif'],
  ['plateletsOrHit', 'Trombosit rendah/turun, atau curiga HIT'],
  ['baselineInrHigh', 'INR awal sudah memanjang'],
  ['severeLiverDisease', 'Penyakit hati berat'],
];

export function HeparinCard({
  noteBody,
  onInsertTerapi,
}: {
  noteBody?: string | undefined;
  onInsertTerapi?: ((line: string) => boolean) | undefined;
}): JSX.Element {
  const settings = useMemo(readHeparinSettings, []);
  const fromNote = useMemo(() => (noteBody ? readCoagFromNote(noteBody) : {}), [noteBody]);
  const protocol = useMemo(() => withTargetHigh(RASCHKE_1993, settings.targetHigh), [settings.targetHigh]);

  // Required, like the INR target on the warfarin card: the two regimens give
  // different boluses, and a default would pick one silently.
  const [indication, setIndication] = useState<'vte' | 'ska' | null>(null);
  const [mode, setMode] = useState<'mulai' | 'sesuaikan'>(fromNote.aptt !== undefined ? 'sesuaikan' : 'mulai');
  const [weight, setWeight] = useState(show(fromNote.weightKg));
  const [aptt, setAptt] = useState(show(fromNote.aptt));
  const [control, setControl] = useState(show(fromNote.control ?? settings.control ?? undefined));
  const [rate, setRate] = useState('');
  const [stops, setStops] = useState<HeparinStops>(NO_STOPS);
  const [inserted, setInserted] = useState<'ok' | 'none' | null>(null);

  const warnings = heparinStops(stops);
  const vte = indication === 'vte';
  const start = vte && mode === 'mulai' ? startDose(num(weight), protocol) : null;
  const acs = indication === 'ska' ? acsStart(num(weight)) : null;
  const acsPosition = indication === 'ska' ? acsApttPosition(num(aptt)) : null;
  const input = { weightKg: num(weight), aptt: num(aptt), control: num(control), currentRatePerKg: num(rate) };
  const adjustment = vte && mode === 'sesuaikan' ? adjustDose(input, protocol) : null;
  const problems = vte && mode === 'sesuaikan' ? adjustProblems(input) : [];
  const line = warnings.length > 0 ? undefined : (start?.line ?? adjustment?.line ?? acs?.line);
  const prefilled = [
    fromNote.aptt !== undefined ? `aPTT ${one(fromNote.aptt)}` : '',
    fromNote.control !== undefined ? `kontrol ${one(fromNote.control)}` : '',
    fromNote.weightKg !== undefined ? `BB ${one(fromNote.weightKg)} kg` : '',
  ].filter(Boolean);
  const targetLabel = `1,5–${formatRatio(settings.targetHigh).replace(/0$/, '')} × kontrol`;

  return (
    <CalcCard
      title="Heparin (UFH) — aPTT"
      formula={
        indication === 'ska'
          ? 'ESC 2023 (SKA) · bolus 70–100 U/kg → infus titrasi ke aPTT 60–80 dtk'
          : `VTE: Raschke 1993 · 80 U/kg bolus → 18 U/kgBB/jam · target ${targetLabel}`
      }
      sources={HEPARIN_SOURCES}
    >
      <p className="mb-2 rounded-lg bg-bg-subtle px-2 py-1.5 text-[11px] leading-snug text-fg-muted">
        Saran hitungan, bukan instruksi. Cocokkan dengan protokol RS dan rentang aPTT lab Anda.
      </p>
      <p className="mb-1 text-[11px] font-medium text-fg-muted">Indikasi (wajib dipilih)</p>
      <div role="group" aria-label="Indikasi heparin" className="mb-2 grid grid-cols-2 gap-1">
        {(
          [
            ['vte', 'VTE / tromboemboli', 'Raschke 1993'],
            ['ska', 'SKA', 'ESC 2023'],
          ] as const
        ).map(([value, label, source]) => (
          <button
            key={value}
            type="button"
            aria-pressed={indication === value}
            onClick={() => {
              setIndication(value);
              setInserted(null);
            }}
            className={[
              'min-h-tap rounded-lg border px-2 py-1 text-left text-xs',
              indication === value ? 'border-accent font-semibold text-accent' : 'border-border text-fg-muted',
            ].join(' ')}
          >
            {label}
            <span className="block text-[10px] font-normal text-fg-faint">{source}</span>
          </button>
        ))}
      </div>
      {vte ? (
      <Segmented
        label="Tahap"
        value={mode}
        onChange={(next) => {
          setMode(next);
          setInserted(null);
        }}
        options={[
          { value: 'mulai', label: 'Mulai' },
          { value: 'sesuaikan', label: 'Sesuaikan (aPTT)' },
        ]}
      />
      ) : null}
      <div className={`mt-2 grid gap-2 ${indication === 'ska' || (vte && mode === 'sesuaikan') ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <NumberField label="BB aktual (kg)" value={weight} onChange={setWeight} />
        {indication === 'ska' ? <NumberField label="aPTT (detik, opsional)" value={aptt} onChange={setAptt} /> : null}
        {vte && mode === 'sesuaikan' ? (
          <>
            <NumberField label="Laju sekarang (U/kgBB/jam)" value={rate} onChange={setRate} />
            <NumberField label="aPTT (detik)" value={aptt} onChange={setAptt} />
            <NumberField label="aPTT kontrol lab (detik)" value={control} onChange={setControl} />
          </>
        ) : null}
      </div>
      {prefilled.length > 0 ? (
        <p className="mt-1 text-[11px] text-fg-faint">
          Diisi dari lab terbaru di catatan: {prefilled.join(', ')}. Periksa tanggalnya.
        </p>
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

      {warnings.length > 0 ? (
        <div role="alert" className="mt-3 rounded-xl border border-[var(--danger)] p-3 text-xs">
          <p className="font-semibold text-[var(--danger)]">Dosis tidak ditampilkan</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : indication === null ? (
        <Empty>Pilih indikasi: VTE (nomogram Raschke) atau SKA (ESC 2023).</Empty>
      ) : acs ? (
        <ResultBlock line={acs.line}>
          <Big
            value={`${formatUnits(acs.bolusMinUnits)}–${formatUnits(acs.bolusMaxUnits)}`}
            unit="U bolus IV"
            caption="70–100 U/kg · ESC 2023 tidak memberi batas maksimal"
          />
          <p className="mt-2 text-xs">
            Lanjut infus IV, <b>titrasi ke aPTT 60–80 dtk</b>. ESC 2023 tidak mencantumkan laju awal maupun tabel penyesuaian:
            pakai protokol RS.
          </p>
          {acsPosition ? (
            <p
              className={`mt-2 text-xs font-semibold ${acsPosition === 'in' ? 'text-accent' : 'text-[var(--warn-strong)]'}`}
            >
              aPTT {aptt} dtk:{' '}
              {acsPosition === 'in' ? 'dalam target 60–80 dtk' : acsPosition === 'below' ? 'di bawah 60 dtk' : 'di atas 80 dtk'}
            </p>
          ) : null}
          <p className="mt-1 text-[10px] text-fg-faint">ESC 2023 Tabel 6, UFH: {ESC_2023_ACS.printed}</p>
        </ResultBlock>
      ) : indication === 'ska' ? (
        <Empty>Isi berat badan aktual (kg).</Empty>
      ) : start ? (
        <ResultBlock line={start.line}>
          <div className="grid grid-cols-2 gap-3">
            <Big value={formatUnits(start.bolusUnits)} unit="U bolus IV" caption="80 U/kg" />
            <Big
              value={start.ratePerKg}
              unit="U/kgBB/jam"
              caption={`= ${formatUnits(start.rateUnitsPerHour)} U/jam`}
            />
          </div>
          <p className="mt-2 text-[11px] text-fg-muted">Cek aPTT {protocol.recheckHours} jam setelah mulai.</p>
        </ResultBlock>
      ) : adjustment ? (
        <ResultBlock line={adjustment.line}>
          <p className="text-[11px] text-fg-muted">
            aPTT {aptt} dtk = <b>{formatRatio(adjustment.ratio)} × kontrol</b> · target &gt;{one(adjustment.targetSeconds.low)}–
            {one(adjustment.targetSeconds.high)} dtk {adjustment.row.therapeutic ? '· dalam target' : ''}
          </p>
          <p className="mt-1 text-xs font-medium">
            {rowText(
              adjustment.row,
              protocol.rows[protocol.rows.indexOf(adjustment.row) - 1]?.maxRatio ?? null,
            )}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Big
              value={one(adjustment.newRatePerKg)}
              unit="U/kgBB/jam"
              caption={`= ${formatUnits(adjustment.newRateUnitsPerHour)} U/jam`}
            />
            {adjustment.bolusUnits > 0 ? (
              <Big value={formatUnits(adjustment.bolusUnits)} unit="U bolus IV" caption={`${adjustment.row.bolusPerKg} U/kg`} />
            ) : adjustment.holdMinutes > 0 ? (
              <Big value={adjustment.holdMinutes / 60} unit="jam stop" caption="lalu laju baru" />
            ) : null}
          </div>
          {adjustment.rateFloor ? (
            <p className="mt-2 text-[11px] font-medium text-[var(--danger)]">
              Penurunan membuat laju ≤ 0 — nomogram tidak mencakup ini; diskusikan dengan DPJP.
            </p>
          ) : null}
          <p className="mt-2 text-[11px] text-fg-muted">
            Cek aPTT {protocol.recheckHours} jam setelah perubahan. aPTT yang diambil &lt; {protocol.minHoursAfterChange} jam
            setelah perubahan terakhir tidak dipakai untuk menyesuaikan dosis.
          </p>
          <p className="mt-1 text-[10px] text-fg-faint">Tabel 2 Raschke: {adjustment.row.printed.range} → {adjustment.row.printed.action}</p>
        </ResultBlock>
      ) : mode === 'sesuaikan' ? (
        <Empty>{problems.join(' ')}</Empty>
      ) : (
        <Empty>Isi berat badan aktual (kg).</Empty>
      )}

      {line && onInsertTerapi ? (
        <div className="mt-2 flex items-center gap-2">
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

      <p className="mt-3 text-[10px] leading-snug text-fg-faint">
        Rentang aPTT bergantung pada reagen: pada kadar heparin 0,3–0,7 U/mL (anti-Xa), reagen modern memberi rasio aPTT
        "1.6-2.7 to 3.7-6.2 times control" (CHEST 2012). Kontrol dan target diatur di Pengaturan → Heparin (aPTT).
      </p>
    </CalcCard>
  );
}
