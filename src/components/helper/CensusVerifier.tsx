import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { oddValues } from '@/domain/census/oddValues';
import { Button, Callout, Section } from '@/components/common/ui';
import { IconCheck, IconChevronRight, IconCopy, IconUpload } from '@/components/common/Icons';

import { AiError, aiEnabled } from '@/lib/ai';
import { copyText } from '@/lib/clipboard';
import { useClinicalToday } from '@/hooks/useClinicalToday';
import { SaveResultButton } from './SaveResult';
import { CENSUS_MODEL, extractCensus, type CensusResult } from '@/lib/censusExtraction';
import type { DenahExtraction, ListExtraction } from '@/domain/census/verify';
import {
  DEFAULT_CONFIG,
  flatten,
  toMarkdown,
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
export function CensusVerifier(): JSX.Element {
  const [denahFile, setDenahFile] = useState<File | null>(null);
  const [listFile, setListFile] = useState<File | null>(null);
  const [denah, setDenah] = useState<CensusResult<DenahExtraction> | null>(null);
  const [list, setList] = useState<CensusResult<ListExtraction> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<VerificationReport | null>(null);
  const [history, setHistory] = useState<CensusHistory | null>(() => readHistory());
  const [copied, setCopied] = useState(false);

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
    try {
      /*
        One document at a time, not both in parallel. Each is a long call
        with a large PDF, and two at once doubles the chance of the quota
        error with nothing gained — the checks need both anyway.
      */
      if (denahFile) {
        setBusy('Mentranskripsi DENAH…');
        denahResult = await extractCensus(denahFile, 'DENAH');
        setDenah(denahResult);
      }
      if (listFile) {
        setBusy('Mentranskripsi LIST PASIEN…');
        listResult = await extractCensus(listFile, 'LIST_PASIEN');
        setList(listResult);
      }

      // Stages 4–8, against the last run on this device.
      const previous = readHistory();
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
    ...(denah?._extractionWarnings ?? []).map((warning) => `DENAH: ${warning}`),
    ...(list?._extractionWarnings ?? []).map((warning) => `LIST: ${warning}`),
  ];
  const notes = [
    ...(denah?.extractionNotes ?? []).map((note) => `DENAH: ${note}`),
    ...(list?.extractionNotes ?? []).map((note) => `LIST: ${note}`),
  ];

  const listed = view ? view.open.filter((issue) => issue.ruleId !== 'P1' && issue.ruleId !== 'P2') : [];
  const preflight = report ? report.issues.filter((issue) => issue.ruleId === 'P1' || issue.ruleId === 'P2') : [];

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
            {busy ? <RunSteps busy={busy} hasDenah={denahFile !== null} hasList={listFile !== null} /> : null}
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

        {report && view ? (
          <>
            {/* Pre-flight first (spec §7.2): a missing document or a date
                mismatch changes how everything below should be read. */}
            {preflight.map((issue) => (
              <Callout key={issue.id} tone="danger" title={issue.title} role="alert">
                {issue.detail}
              </Callout>
            ))}

            <Verdict
              verdict={view.verdict}
              openCount={view.open.length}
              shiftDate={report.shiftDate}
              patientCount={report.patientCount}
              counts={SEVERITIES.map(({ id, short }) => ({
                id,
                short,
                count: listed.filter((issue) => issue.severity === id).length,
              }))}
              copied={copied}
              save={
                <SaveResultButton
                  kind="verifikasi"
                  // The shift the PDFs are dated; a date the transcription
                  // could not read files under today rather than nowhere.
                  forDate={report.shiftDate && /^\d{4}-\d{2}-\d{2}$/.test(report.shiftDate) ? report.shiftDate : today}
                  subject=""
                  title={`Verifikasi List — ${view.verdict}`}
                  text={toMarkdown(report)}
                />
              }
              onCopy={() => {
                void copyText(toMarkdown(report)).then(() => {
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

            {SEVERITIES.map(({ id, label }) => {
              const group = listed.filter((issue) => issue.severity === id);
              if (group.length === 0) return null;
              return (
                <Section key={id} title={label} aside={<span className="text-[11px] text-fg-faint">{group.length}</span>}>
                  <div className="space-y-2">
                    {group.map((issue) => (
                      <IssueCard key={issue.id} issue={issue} onAnswer={answer} />
                    ))}
                  </div>
                </Section>
              );
            })}

            <div className="space-y-2">
              {report.resolvedSinceLastRun.length > 0 ? (
                <Disclosure title={`Selesai sejak pemeriksaan terakhir · ${report.resolvedSinceLastRun.length}`}>
                  {report.resolvedSinceLastRun.map((issue) => (
                    <li key={issue.id}>
                      <span aria-hidden="true" className="mr-1 text-accent">✓</span>
                      {issue.title}
                    </li>
                  ))}
                </Disclosure>
              ) : null}
              {view.answered.length > 0 ? (
                <Disclosure title={`Sudah dijawab · ${view.answered.length}`}>
                  {view.answered.map((issue) => (
                    <li key={issue.id}>
                      {issue.title} <span className="text-fg-muted">· {RESOLUTION_LABEL[issue.resolution]}</span>
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

/** What the run is doing, so a 40-second wait reads as progress. */
function RunSteps({ busy, hasDenah, hasList }: { busy: string; hasDenah: boolean; hasList: boolean }): JSX.Element {
  const steps = [
    ...(hasDenah ? [{ key: 'DENAH', label: 'Transkripsi DENAH' }] : []),
    ...(hasList ? [{ key: 'LIST', label: 'Transkripsi LIST PASIEN' }] : []),
    { key: 'periksa', label: 'Pemeriksaan' },
  ];
  const current = steps.findIndex((step) => busy.includes(step.key));
  return (
    <ol className="space-y-1 text-[11px]" aria-label="Kemajuan">
      {steps.map((step, index) => {
        const state = index < current ? 'done' : index === current ? 'now' : 'next';
        return (
          <li key={step.key} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={[
                'flex h-4 w-4 items-center justify-center rounded-full text-[9px]',
                state === 'done'
                  ? 'bg-accent text-white'
                  : state === 'now'
                    ? 'animate-pulse bg-[var(--accent-soft)] ring-1 ring-accent'
                    : 'ring-1 ring-border',
              ].join(' ')}
            >
              {state === 'done' ? '✓' : ''}
            </span>
            <span className={state === 'next' ? 'text-fg-faint' : 'text-fg'}>{step.label}</span>
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
  CLEAN: { box: 'border-accent bg-[var(--accent-soft)]', text: 'text-accent', title: 'CLEAN', sub: 'Tidak ada masalah.' },
  NOT_CLEAN: { box: 'border-danger bg-[var(--danger-soft)]', text: 'text-danger', title: 'NOT CLEAN', sub: '' },
  PARTIAL: {
    box: 'border-[var(--warn-strong)] bg-[var(--warn-soft)]',
    text: 'text-[var(--warn-strong)]',
    title: 'PARTIAL',
    sub: 'Satu dokumen tidak ada, jadi hanya sebagian yang diperiksa.',
  },
} as const;

function Verdict({
  verdict,
  openCount,
  shiftDate,
  patientCount,
  counts,
  copied,
  onCopy,
  save,
}: {
  save?: ReactNode;
  verdict: VerificationReport['verdict'];
  openCount: number;
  shiftDate: string | null;
  patientCount: number;
  counts: Array<{ id: Severity; short: string; count: number }>;
  copied: boolean;
  onCopy: () => void;
}): JSX.Element {
  const tone = VERDICT_TONE[verdict];
  return (
    <div className={`rounded-xl border px-4 py-3 ${tone.box}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className={`text-lg font-semibold tracking-tight ${tone.text}`}>
            {tone.title}
            {verdict === 'NOT_CLEAN' ? <span className="ml-2 text-sm font-medium">{openCount} masalah</span> : null}
          </p>
          <p className="text-xs text-fg-muted">
            Shift {shiftDate ?? 'tanggal tidak terbaca'} · {patientCount} pasien
            {tone.sub ? ` · ${tone.sub}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {save}
          <Button size="sm" onClick={onCopy} icon={<IconCopy className="h-4 w-4" />}>
            {copied ? 'Tersalin' : 'Salin laporan'}
          </Button>
        </div>
      </div>
      {verdict !== 'CLEAN' ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {counts.map(({ id, short, count }) => (
            <span
              key={id}
              className={[
                'inline-flex items-center gap-1.5 rounded-full bg-surface px-2 py-0.5 text-[11px] ring-1 ring-border',
                count === 0 ? 'text-fg-faint' : 'font-medium text-fg',
              ].join(' ')}
            >
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${SEVERITY_DOT[id]}`} />
              {short} {count}
            </span>
          ))}
        </div>
      ) : null}
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

const SEVERITIES: ReadonlyArray<{ id: Severity; label: string; short: string }> = [
  { id: 'high', label: 'High', short: 'High' },
  { id: 'medium', label: 'Medium', short: 'Medium' },
  { id: 'confirm', label: 'Perlu konfirmasi Anda', short: 'Konfirmasi' },
  { id: 'cosmetic', label: 'Kosmetik', short: 'Kosmetik' },
];

/** One colour per severity: red, amber, the accent for "your answer", grey. */
const SEVERITY_EDGE: Record<Severity, string> = {
  high: 'border-l-danger',
  medium: 'border-l-[var(--warn-strong)]',
  confirm: 'border-l-accent',
  cosmetic: 'border-l-[var(--border-strong)]',
};
const SEVERITY_DOT: Record<Severity, string> = {
  high: 'bg-danger',
  medium: 'bg-[var(--warn-strong)]',
  confirm: 'bg-accent',
  cosmetic: 'bg-[var(--border-strong)]',
};

const VIEW_LABEL: Record<string, string> = {
  roomGrid: 'Denah kamar',
  dpjpTable: 'Tabel DPJP',
  holderList: 'Holder list',
  listPasien: 'LIST PASIEN',
  header: 'Header',
  footer: 'Footer',
};

/**
 * One issue: what is wrong, the values each view holds (spec §7.5 — a table,
 * not prose), and, for 🟡 items only, the three answers.
 */
function IssueCard({
  issue,
  onAnswer,
}: {
  issue: Issue;
  onAnswer: (issue: Issue, resolution: Resolution) => void;
}): JSX.Element {
  const rows = Object.entries(issue.comparison ?? {}).filter((entry): entry is [string, string] => Boolean(entry[1]));
  const odd = oddValues(rows.map(([, value]) => value));
  return (
    <div className={`rounded-xl border border-l-4 border-border bg-surface px-3 py-2.5 text-xs ${SEVERITY_EDGE[issue.severity]}`}>
      <div className="flex flex-wrap items-start gap-2">
        <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug">{issue.title}</p>
        {issue.status === 'persisting' ? (
          <span className="shrink-0 rounded-full bg-bg-subtle px-2 py-0.5 text-[10px] font-medium text-fg-muted">
            masih ada
          </span>
        ) : issue.status === 'new' ? (
          <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-accent">
            baru
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 leading-relaxed text-fg-muted">{issue.detail}</p>
      {rows.length > 0 ? (
        <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 overflow-hidden rounded-lg border border-border text-[11px]">
          {rows.map(([key, value], index) => (
            <div key={key} className={`contents ${index > 0 ? '[&>*]:border-t [&>*]:border-border' : ''}`}>
              <dt className="bg-bg-subtle px-2 py-1 text-fg-muted">{VIEW_LABEL[key] ?? key}</dt>
              <dd className={`px-2 py-1 font-mono ${odd.has(value) ? 'font-semibold text-danger' : ''}`}>
                {value}
                {odd.has(value) ? <span className="sr-only"> (berbeda)</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {issue.severity === 'confirm' ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {(Object.keys(RESOLUTION_LABEL) as Resolution[]).map((resolution) => (
            <Button key={resolution} size="sm" onClick={() => onAnswer(issue, resolution)}>
              {RESOLUTION_LABEL[resolution]}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
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
          file ? 'bg-accent text-white' : 'bg-bg-subtle text-fg-muted',
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
