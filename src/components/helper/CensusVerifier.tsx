import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { readableReport, readableText, transcriptionWarning, type PatientFinding, type ReadableReport } from '@/domain/census/readable';
import { Button, Callout, Section } from '@/components/common/ui';
import { IconCheck, IconChevronRight, IconCopy, IconUpload } from '@/components/common/Icons';

import { AiError, aiEnabled } from '@/lib/ai';
import { copyText } from '@/lib/clipboard';
import { useClinicalToday } from '@/hooks/useClinicalToday';
import { SaveResultButton } from './SaveResult';
import { CENSUS_MODEL, extractCensus, type CensusResult } from '@/lib/censusExtraction';
import { sideBySide } from '@/lib/sideBySide';
import type { DenahExtraction, ListExtraction } from '@/domain/census/verify';
import {
  DEFAULT_CONFIG,
  flatten,
  verify,
  type Issue,
  type Severity,
  type VerificationReport,
} from '@/domain/census/verifier';
import {
  HISTORY_KEY,
  RESOLUTION_LABEL,
  applyResolutions,
  nextHistory,
  parseHistory,
  type CensusHistory,
  type Resolution,
} from '@/domain/census/history';

/**
 * Verifikasi List (formerly "Verifikasi Sensus") — WIP.
 *
 * Two PDFs in, a transcription of each out, and the deterministic checks on
 * top — Avi's Stage 4–8 verifier (`domain/census/verifier`).
 *
 * The PDFs and transcriptions are never stored. What IS kept, on this device
 * only, is what the next run needs to compare against (spec §6): the last
 * run's open issues, the RMs and names on the ward, and your answers to 🟡
 * items. It is cleared on sign-out.
 */

function readHistory(): CensusHistory | null {
  try {
    return parseHistory(localStorage.getItem(HISTORY_KEY));
  } catch {
    return null;
  }
}

function writeHistory(history: CensusHistory): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // No storage: this run still works; the next one just cannot diff.
  }
}
type DocKey = 'DENAH' | 'LIST';
interface DocProgress {
  phase: 'membaca' | 'antre' | 'selesai' | 'gagal';
  attempt: number;
  startedAt: number;
  endedAt: number | null;
}

export function CensusVerifier(): JSX.Element {
  const [denahFile, setDenahFile] = useState<File | null>(null);
  const [listFile, setListFile] = useState<File | null>(null);
  const [denah, setDenah] = useState<CensusResult<DenahExtraction> | null>(null);
  const [list, setList] = useState<CensusResult<ListExtraction> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<Partial<Record<DocKey, DocProgress>>>({});
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<VerificationReport | null>(null);
  const [history, setHistory] = useState<CensusHistory | null>(() => readHistory());
  const [copied, setCopied] = useState(false);
  /** The ward before this run, for "pasien baru"; captured when the run starts. */
  const [previousRms, setPreviousRms] = useState<Set<string> | null>(null);

  const enabled = aiEnabled('census');
  const today = useClinicalToday();
  const navigate = useNavigate();

  const run = async (): Promise<void> => {
    setError(null);
    setDenah(null);
    setList(null);
    setReport(null);
    let denahResult: CensusResult<DenahExtraction> | null = null;
    let listResult: CensusResult<ListExtraction> | null = null;
    setProgress({});
    setBusy('Membaca PDF…');
    const mark = (key: DocKey, change: Partial<DocProgress>): void =>
      setProgress((current) => ({
        ...current,
        [key]: { phase: 'membaca', attempt: 1, startedAt: Date.now(), endedAt: null, ...current[key], ...change },
      }));
    /** One document, its progress reported as it goes. */
    const tracked = <T,>(key: DocKey, call: (onAttempt: (attempt: number) => void) => Promise<T>) =>
      async (): Promise<T> => {
        mark(key, { phase: 'membaca', attempt: 1, startedAt: Date.now(), endedAt: null });
        try {
          const result = await call((attempt) => mark(key, { attempt }));
          mark(key, { phase: 'selesai', endedAt: Date.now() });
          return result;
        } catch (cause) {
          // A quota refusal is retried after the other document: say so.
          mark(key, cause instanceof AiError && cause.rateLimited ? { phase: 'antre' } : { phase: 'gagal', endedAt: Date.now() });
          throw cause;
        }
      };
    try {
      // Both documents at once (2026-10-11): they do not depend on each other,
      // so the wait is the longer of the two, not their sum. A key whose quota
      // refuses the second call gets it re-run after the first (`sideBySide`).
      [denahResult, listResult] = await sideBySide(
        denahFile ? tracked('DENAH', (onAttempt) => extractCensus(denahFile, 'DENAH', 2, onAttempt)) : null,
        listFile ? tracked('LIST', (onAttempt) => extractCensus(listFile, 'LIST_PASIEN', 2, onAttempt)) : null,
        (cause) => cause instanceof AiError && cause.rateLimited,
      );
      setDenah(denahResult);
      setList(listResult);
      setBusy('Memeriksa…');

      // Stages 4–8, against the last run on this device.
      const previous = readHistory();
      setPreviousRms(previous ? new Set(previous.activeRms) : null);
      const result = verify(
        denahResult,
        listResult,
        DEFAULT_CONFIG,
        previous?.issues ?? [],
        previous ? new Set(previous.activeRms) : undefined,
        previous?.names,
      );
      setReport(result);
      const grid = flatten(denahResult, listResult, DEFAULT_CONFIG).roomGrid;
      const saved = nextHistory({
        report: result,
        roomGrid: grid.map((record) => ({ rm: record.rm, name: record.nameRaw })),
        previous,
        resolutions: previous?.resolutions ?? {},
      });
      writeHistory(saved);
      setHistory(saved);
    } catch (cause) {
      setError(cause instanceof AiError ? cause.message : 'Transkripsi gagal.');
      console.error('[census] extraction failed', cause);
    } finally {
      setBusy(null);
    }
  };

  /** A 🟡 answer: stored at once, and it closes the item on this run too. */
  const answer = (issue: Issue, resolution: Resolution): void => {
    if (!report) return;
    const resolutions = { ...(history?.resolutions ?? {}), [issue.id]: resolution };
    const grid = flatten(denah, list, DEFAULT_CONFIG).roomGrid;
    const saved = nextHistory({
      report,
      roomGrid: grid.map((record) => ({ rm: record.rm, name: record.nameRaw })),
      previous: history,
      resolutions,
    });
    writeHistory(saved);
    setHistory(saved);
  };

  const view = report ? applyResolutions(report, history?.resolutions ?? {}) : null;
  const warnings = [
    ...(denah?._extractionWarnings ?? []).map((warning) => transcriptionWarning(`DENAH: ${warning}`)),
    ...(list?._extractionWarnings ?? []).map((warning) => transcriptionWarning(`LIST: ${warning}`)),
  ];
  const notes = [
    ...(denah?.extractionNotes ?? []).map((note) => `DENAH: ${note}`),
    ...(list?.extractionNotes ?? []).map((note) => `LIST: ${note}`),
  ];

  // The findings regrouped per patient, in the ward's words (`readable.ts`).
  // Built from the OPEN issues, so an answered item leaves the list.
  const readable =
    report && view
      ? readableReport({
          issues: view.open,
          denah,
          list,
          shiftDate: report.shiftDate,
          ...(previousRms ? { previousRms } : {}),
        })
      : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:items-start">
      {/* Left: the two documents and the one action. */}
      <aside className="space-y-4 lg:sticky lg:top-4">
        {!enabled ? (
          <Callout
            tone="accent"
            title="Aktifkan Verifikasi list bangsal"
            action={
              <Button size="sm" variant="primary" onClick={() => navigate('/pengaturan')}>
                Buka Pengaturan
              </Button>
            }
          >
            Di Pengaturan → Fitur AI. PDF dikirim utuh ke Anthropic dengan API key Anda untuk
            ditranskripsi; pengecekannya berjalan di perangkat ini.
          </Callout>
        ) : (
          <Section
            title="Dokumen shift"
            hint={
              <>
                Model {CENSUS_MODEL}. AI hanya menyalin; pengecekan berjalan di perangkat ini dan PDF
                tidak disimpan.
              </>
            }
          >
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <PdfSlot label="DENAH PASIEN" file={denahFile} onPick={setDenahFile} />
              <PdfSlot label="LIST PASIEN" file={listFile} onPick={setListFile} />
            </div>
            <Button
              variant="primary"
              full
              onClick={() => void run()}
              disabled={busy !== null || (!denahFile && !listFile)}
            >
              {busy ?? 'Transkripsi dan periksa'}
            </Button>
            {busy || Object.keys(progress).length > 0 ? <RunSteps progress={progress} running={busy !== null} /> : null}
          </Section>
        )}
        {history && !report ? (
          <p className="text-[11px] leading-relaxed text-fg-faint">
            Pemeriksaan terakhir di perangkat ini: {history.shiftDate ?? 'tanggal tidak terbaca'} ·{' '}
            {history.issues.length} masalah terbuka. Pemeriksaan berikutnya dibandingkan dengannya.
          </p>
        ) : null}
      </aside>

      {/* Right: the result. */}
      <div className="min-w-0 space-y-4">
        {error ? (
          <Callout tone="danger" title="Transkripsi gagal" role="alert">
            {error}
          </Callout>
        ) : null}

        {report && view && readable ? (
          <>
            {readable.preflight.map((item) => (
              <Callout key={item.title} tone="danger" title={item.title} role="alert">
                {item.detail}
              </Callout>
            ))}

            <Verdict
              verdict={view.verdict}
              report={readable}
              copied={copied}
              save={
                <SaveResultButton
                  kind="verifikasi"
                  // The shift the PDFs are dated; a date the transcription
                  // could not read files under today rather than nowhere.
                  forDate={report.shiftDate && /^\d{4}-\d{2}-\d{2}$/.test(report.shiftDate) ? report.shiftDate : today}
                  subject=""
                  title={`Verifikasi List — ${readable.headline}`}
                  text={readableText(readable)}
                />
              }
              onCopy={() => {
                void copyText(readableText(readable)).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                });
              }}
            />

            {warnings.length > 0 ? (
              // The model's own counts disagree with its arrays: a row may have
              // been dropped or doubled. Read before trusting the rest.
              <Callout tone="warn" title="Peringatan transkripsi: baca dulu sebelum memercayai hasil">
                <ul className="list-disc space-y-0.5 pl-4">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </Callout>
            ) : null}

            <ol className="space-y-2">
              {readable.patients.map((patient, index) => (
                <PatientCard key={patient.key} number={index + 1} patient={patient} onAnswer={answer} />
              ))}
              {readable.counts ? (
                <li className={`rounded-xl border border-l-4 border-border bg-surface px-3 py-2.5 text-xs ${SEVERITY_EDGE.high}`}>
                  <CardHead number={readable.patients.length + 1} title={readable.counts.title} />
                  <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 overflow-hidden rounded-lg border border-border text-[11px]">
                    {readable.counts.rows.map((row, index) => (
                      <Row key={row.label} label={row.label} value={row.value} odd={row.odd} first={index === 0} />
                    ))}
                  </dl>
                  {readable.counts.perDpjp.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {readable.counts.perDpjp.map((line) => (
                        <li key={line.dpjp}>
                          <span className="font-medium">DPJP {line.dpjp}:</span>{' '}
                          {line.cells.map((cell, index) => (
                            <span key={cell.label}>
                              {index > 0 ? ' · ' : ''}
                              {cell.label}{' '}
                              <span className={`font-mono ${cell.odd ? 'font-semibold text-danger' : ''}`}>{cell.value}</span>
                            </span>
                          ))}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {readable.counts.notes.map((note) => (
                    <p key={note} className="mt-1.5 text-fg-muted">{note}</p>
                  ))}
                  {readable.counts.relatedNames.length > 0 ? (
                    <p className="mt-1.5 italic text-fg-muted">
                      Kemungkinan terkait {readable.counts.relatedNames.join(', ')} di atas.
                    </p>
                  ) : null}
                </li>
              ) : null}
              {readable.other.map((item, index) => (
                <li key={item.title} className={`rounded-xl border border-l-4 border-border bg-surface px-3 py-2.5 text-xs ${SEVERITY_EDGE[item.severity]}`}>
                  <CardHead number={readable.patients.length + (readable.counts ? 1 : 0) + index + 1} title={item.title} />
                  <p className="mt-0.5 text-fg-muted">{item.detail}</p>
                </li>
              ))}
            </ol>

            {readable.advice.length > 0 ? (
              <Section title="Saran">
                <ul className="list-disc space-y-1 pl-4 text-xs">
                  {readable.advice.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </Section>
            ) : null}

            <div className="space-y-2">
              <Disclosure title={`Cocok di semua bagian · ${readable.clean.count} pasien`}>
                {readable.clean.newNames.length > 0 ? (
                  <li className="text-fg-muted">Pasien baru: {readable.clean.newNames.join(', ')}</li>
                ) : null}
                <li>{readable.clean.names.join(', ') || '—'}</li>
              </Disclosure>
              {readable.minor.length > 0 ? (
                <Disclosure title={`Perbedaan kecil · ${readable.minor.length}`}>
                  {readable.minor.map((item) => (
                    <li key={item.title}>
                      <span className="font-medium">{item.title}</span> <span className="text-fg-muted">{item.detail}</span>
                    </li>
                  ))}
                </Disclosure>
              ) : null}
              {report.resolvedSinceLastRun.length > 0 ? (
                <Disclosure title={`Selesai sejak pemeriksaan terakhir · ${report.resolvedSinceLastRun.length}`}>
                  {report.resolvedSinceLastRun.map((issue) => (
                    <li key={issue.id}>
                      <span aria-hidden="true" className="mr-1 text-accent">✓</span>
                      {issue.patients[0]?.name ?? issue.title}
                    </li>
                  ))}
                </Disclosure>
              ) : null}
              {view.answered.length > 0 ? (
                <Disclosure title={`Sudah dijawab · ${view.answered.length}`}>
                  {view.answered.map((issue) => (
                    <li key={issue.id}>
                      {issue.title.replace(/^Patient vanished:?\s*/, '')} <span className="text-fg-muted">· {RESOLUTION_LABEL[issue.resolution]}</span>
                    </li>
                  ))}
                </Disclosure>
              ) : null}
              {notes.length > 0 ? (
                <Disclosure title={`Catatan dari AI · ${notes.length}`}>
                  {notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </Disclosure>
              ) : null}
              <details className="group rounded-xl border border-border">
                <summary className="flex min-h-tap cursor-pointer items-center gap-2 px-3 text-xs font-medium text-fg-muted [@media(pointer:fine)]:min-h-10">
                  <IconChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                  Hasil transkripsi (JSON)
                </summary>
                <pre className="max-h-80 overflow-auto border-t border-border bg-bg-subtle p-3 text-[10px]">
                  {JSON.stringify({ denah, list }, null, 2)}
                </pre>
              </details>
            </div>
          </>
        ) : !error ? (
          <EmptyResult />
        ) : null}
      </div>
    </div>
  );
}

const DOC_LABEL: Record<DocKey, string> = { DENAH: 'DENAH PASIEN', LIST: 'LIST PASIEN' };

/**
 * Each document's own line, with the seconds it has taken: the two run at
 * the same time, so one shared "Mentranskripsi…" could not say which is still
 * going, or that a second attempt started.
 */
function RunSteps({ progress, running }: { progress: Partial<Record<DocKey, DocProgress>>; running: boolean }): JSX.Element {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  const keys = (['DENAH', 'LIST'] as const).filter((key) => progress[key]);
  return (
    <ol className="space-y-1 text-[11px]" aria-label="Kemajuan" aria-live="polite">
      {keys.map((key) => {
        const doc = progress[key]!;
        const seconds = Math.max(0, Math.round(((doc.endedAt ?? now) - doc.startedAt) / 1000));
        const status =
          doc.phase === 'selesai'
            ? `selesai · ${seconds} dtk`
            : doc.phase === 'gagal'
              ? 'gagal'
              : doc.phase === 'antre'
                ? 'kuota penuh, menunggu yang lain selesai'
                : `dibaca${doc.attempt > 1 ? ` · percobaan ${doc.attempt}/2` : ''} · ${seconds} dtk`;
        return (
          <li key={key} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={[
                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px]',
                doc.phase === 'selesai'
                  ? 'bg-accent text-on-accent'
                  : doc.phase === 'gagal'
                    ? 'bg-danger text-white'
                    : 'animate-pulse bg-[var(--accent-soft)] ring-1 ring-accent',
              ].join(' ')}
            >
              {doc.phase === 'selesai' ? '✓' : doc.phase === 'gagal' ? '!' : ''}
            </span>
            <span className="font-medium">{DOC_LABEL[key]}</span>
            <span className="text-fg-muted">{status}</span>
          </li>
        );
      })}
    </ol>
  );
}

function EmptyResult(): JSX.Element {
  return (
    <div className="rounded-xl border border-dashed border-border-strong px-4 py-6 text-xs text-fg-muted">
      <p className="text-sm font-medium text-fg">Hasil pemeriksaan muncul di sini</p>
      <p className="mt-1">Dari DENAH dan LIST PASIEN shift yang sama, Plano memeriksa:</p>
      <ul className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {[
          'Pasien di denah tanpa entri LIST (dan sebaliknya)',
          'Kamar/bed yang berbeda antar bagian',
          'Jumlah per DPJP di header dan isi',
          'Chief dan holder yang tidak konsisten',
          'Masalah yang masih ada sejak pemeriksaan lalu',
          'Tanggal shift kedua dokumen',
        ].map((text) => (
          <li key={text} className="flex gap-1.5">
            <span aria-hidden="true" className="text-fg-faint">○</span>
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}

const VERDICT_TONE = {
  CLEAN: { box: 'border-accent bg-[var(--accent-soft)]', text: 'text-accent' },
  NOT_CLEAN: { box: 'border-danger bg-[var(--danger-soft)]', text: 'text-danger' },
  PARTIAL: { box: 'border-[var(--warn-strong)] bg-[var(--warn-soft)]', text: 'text-[var(--warn-strong)]' },
} as const;

function Verdict({
  verdict,
  report,
  copied,
  onCopy,
  save,
}: {
  verdict: VerificationReport['verdict'];
  report: ReadableReport;
  copied: boolean;
  onCopy: () => void;
  save?: ReactNode;
}): JSX.Element {
  const tone = VERDICT_TONE[report.total === 0 && verdict !== 'PARTIAL' ? 'CLEAN' : verdict];
  return (
    <div className={`rounded-xl border px-4 py-3 ${tone.box}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-fg-muted">Verifikasi {report.dateLabel ?? '(tanggal tidak terbaca)'}</p>
          <p className={`text-lg font-semibold tracking-tight ${tone.text}`}>{report.headline}</p>
          <p className="text-xs text-fg-muted">
            {report.patientCount} pasien di denah kamar · {report.clean.count} cocok di semua bagian
            {verdict === 'PARTIAL' ? ' · satu dokumen tidak ada, hanya sebagian diperiksa' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {save}
          <Button size="sm" onClick={onCopy} icon={<IconCopy className="h-4 w-4" />}>
            {copied ? 'Tersalin' : 'Salin laporan'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Disclosure({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <details className="group rounded-xl border border-border">
      <summary className="flex min-h-tap cursor-pointer items-center gap-2 px-3 text-xs font-medium text-fg-muted [@media(pointer:fine)]:min-h-10">
        <IconChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
        {title}
      </summary>
      <ul className="space-y-1 border-t border-border px-3 py-2 text-xs">{children}</ul>
    </details>
  );
}

/** One colour per severity: red, amber, the accent for "your answer", grey. */
const SEVERITY_EDGE: Record<Severity, string> = {
  high: 'border-l-danger',
  medium: 'border-l-[var(--warn-strong)]',
  confirm: 'border-l-accent',
  cosmetic: 'border-l-[var(--border-strong)]',
};
function CardHead({ number, title, badge }: { number: number; title: ReactNode; badge?: ReactNode }): JSX.Element {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-bg-subtle px-1 text-[11px] font-semibold">
        {number}
      </span>
      <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug">{title}</p>
      {badge}
    </div>
  );
}

function Row({ label, value, odd, first }: { label: string; value: string; odd: boolean; first: boolean }): JSX.Element {
  return (
    <div className={`contents ${first ? '' : '[&>*]:border-t [&>*]:border-border'}`}>
      <dt className="bg-bg-subtle px-2 py-1 text-fg-muted">{label}</dt>
      <dd className={`px-2 py-1 font-mono ${odd ? 'font-semibold text-danger' : ''}`}>
        {value}
        {odd ? <span className="sr-only"> (berbeda)</span> : null}
      </dd>
    </div>
  );
}

/**
 * One patient: what is wrong in one line, where they are and are not, the
 * values that differ, the line as written, and what it probably means. For a
 * patient who vanished, the three answers.
 */
function PatientCard({
  number,
  patient,
  onAnswer,
}: {
  number: number;
  patient: PatientFinding;
  onAnswer: (issue: Issue, resolution: Resolution) => void;
}): JSX.Element {
  const confirm = patient.issues.find((issue) => issue.severity === 'confirm');
  return (
    <li className={`rounded-xl border border-l-4 border-border bg-surface px-3 py-2.5 text-xs ${SEVERITY_EDGE[patient.severity]}`}>
      <CardHead
        number={number}
        title={
          <>
            {patient.name}
            {patient.place ? <span className="font-normal text-fg-muted"> · {patient.place}</span> : null}
            {patient.dpjp ? <span className="font-normal text-fg-muted"> · {patient.dpjp}</span> : null}
            <span className="block font-normal">{patient.summary.charAt(0).toUpperCase() + patient.summary.slice(1)}</span>
          </>
        }
        badge={
          patient.status === 'persisting' ? (
            <span className="shrink-0 rounded-full bg-bg-subtle px-2 py-0.5 text-[10px] font-medium text-fg-muted">masih ada</span>
          ) : null
        }
      />
      {patient.presence.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Ada di bagian">
          {patient.presence.map((cell) => (
            <li
              key={cell.label}
              className={[
                'rounded-full px-2 py-0.5 text-[11px] ring-1',
                cell.present === true
                  ? 'text-accent ring-[color-mix(in_srgb,var(--accent)_40%,transparent)]'
                  : cell.present === false
                    ? 'bg-[var(--danger-soft)] font-medium text-danger ring-[color-mix(in_srgb,var(--danger)_40%,transparent)]'
                    : 'text-fg-faint ring-border',
              ].join(' ')}
            >
              {cell.present === true ? '✓' : cell.present === false ? '✗' : '–'} {cell.label}
            </li>
          ))}
        </ul>
      ) : null}
      {patient.mismatches.length > 0 ? (
        <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 overflow-hidden rounded-lg border border-border text-[11px]">
          {patient.mismatches.map((item, index) => (
            <div key={item.label} className={`contents ${index > 0 ? '[&>*]:border-t [&>*]:border-border' : ''}`}>
              <dt className="bg-bg-subtle px-2 py-1 text-fg-muted">{item.label}</dt>
              <dd className="px-2 py-1">
                {item.values.map((value, i) => (
                  <span key={value.where}>
                    {i > 0 ? ' · ' : ''}
                    <span className="text-fg-muted">{value.where}</span>{' '}
                    <span className={`font-mono ${value.odd ? 'font-semibold text-danger' : ''}`}>{value.value}</span>
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {patient.source ? (
        <p className="mt-2 break-words rounded-lg bg-bg-subtle px-2 py-1 font-mono text-[11px] text-fg-muted">
          <span className="font-sans">Tertulis di {patient.source.where}:</span> {patient.source.text}
        </p>
      ) : null}
      <p className="mt-1.5 italic text-fg-muted">{patient.meaning}</p>
      {confirm ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {(Object.keys(RESOLUTION_LABEL) as Resolution[]).map((resolution) => (
            <Button key={resolution} size="sm" onClick={() => onAnswer(confirm, resolution)}>
              {RESOLUTION_LABEL[resolution]}
            </Button>
          ))}
        </div>
      ) : null}
    </li>
  );
}

/** A document slot: tap to pick, or drop a PDF on it. */
function PdfSlot({
  label,
  file,
  onPick,
}: {
  label: string;
  file: File | null;
  onPick: (file: File | null) => void;
}): JSX.Element {
  const [dragging, setDragging] = useState(false);
  return (
    <label
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const dropped = event.dataTransfer.files[0];
        if (dropped) onPick(dropped);
      }}
      className={[
        'flex min-h-[4rem] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors',
        dragging
          ? 'border-accent bg-[var(--accent-soft)]'
          : file
            ? 'border-border bg-surface hover:bg-bg-subtle'
            : 'border-dashed border-border-strong hover:bg-bg-subtle',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          file ? 'bg-accent text-on-accent' : 'bg-bg-subtle text-fg-muted',
        ].join(' ')}
      >
        {file ? <IconCheck className="h-4 w-4" /> : <IconUpload className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold">{label}</span>
        <span className="block truncate text-[11px] text-fg-muted">{file ? file.name : 'Pilih atau tarik PDF ke sini'}</span>
      </span>
      <input
        type="file"
        accept="application/pdf"
        className="sr-only"
        onChange={(event) => onPick(event.target.files?.[0] ?? null)}
      />
    </label>
  );
}
