import { useState } from 'react';

import { AiError, aiEnabled } from '@/lib/ai';
import { copyText } from '@/lib/clipboard';
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
 * Verifikasi sensus bangsal — WIP.
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

  return (
    <section className="space-y-3 rounded-xl border border-border p-3">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-sm font-medium">Verifikasi sensus bangsal</h2>
        <span className="rounded bg-[var(--warn-soft)] px-1.5 text-[10px] font-semibold text-[var(--warn-strong)]">
          WIP
        </span>
      </div>

      {!enabled ? (
        <p className="text-xs text-fg-muted">
          Aktifkan <strong>Verifikasi sensus bangsal</strong> di Pengaturan → Fitur AI. PDF dikirim
          utuh ke Anthropic dengan API key Anda untuk ditranskripsi; pengecekannya berjalan di
          perangkat ini.
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <PdfSlot label="DENAH PASIEN" file={denahFile} onPick={setDenahFile} />
            <PdfSlot label="LIST PASIEN" file={listFile} onPick={setListFile} />
          </div>
          <button
            type="button"
            onClick={() => void run()}
            disabled={busy !== null || (!denahFile && !listFile)}
            className="min-h-tap w-full rounded-lg border border-accent px-3 text-sm font-medium text-accent disabled:opacity-40"
          >
            {busy ?? 'Transkripsi dan periksa'}
          </button>
          <p className="text-[11px] text-fg-faint">
            Model {CENSUS_MODEL}. AI hanya menyalin; tidak ada hasil yang disimpan.
          </p>
        </>
      )}

      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}

      {report && view ? (
        <div className="space-y-3 text-xs">
          {/* Pre-flight first (spec §7.2): a missing document or a date
              mismatch changes how everything below should be read. */}
          {report.issues
            .filter((issue) => issue.ruleId === 'P1' || issue.ruleId === 'P2')
            .map((issue) => (
              <p key={issue.id} role="alert" className="rounded-lg border border-danger px-3 py-2 text-danger">
                <strong>{issue.title}.</strong> {issue.detail}
              </p>
            ))}

          <div className="flex flex-wrap items-center gap-2">
            <p className="flex-1 text-sm font-semibold">
              {view.verdict === 'CLEAN'
                ? 'CLEAN ✅'
                : view.verdict === 'PARTIAL'
                  ? 'PARTIAL — satu dokumen tidak ada'
                  : `NOT CLEAN — ${String(view.open.length)} masalah`}
              <span className="ml-2 font-normal text-fg-muted">
                {report.shiftDate ?? 'tanggal tidak terbaca'} · {String(report.patientCount)} pasien
              </span>
            </p>
            <button
              type="button"
              onClick={() => {
                void copyText(toMarkdown(report)).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                });
              }}
              className="min-h-tap rounded-lg border border-border px-2 text-[11px]"
            >
              {copied ? 'Tersalin' : 'Salin laporan'}
            </button>
          </div>

          {warnings.length > 0 ? (
            // The model's own counts disagree with its arrays: a row may have
            // been dropped or doubled. Read before trusting the rest.
            <Block title="Peringatan transkripsi" tone="warn">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </Block>
          ) : null}

          {report.resolvedSinceLastRun.length > 0 ? (
            <Block title={`Selesai sejak pemeriksaan terakhir (${String(report.resolvedSinceLastRun.length)})`} tone="plain">
              {report.resolvedSinceLastRun.map((issue) => (
                <li key={issue.id}>✅ {issue.title}</li>
              ))}
            </Block>
          ) : null}

          {SEVERITIES.map(({ id, label }) => {
            const group = view.open.filter((issue) => issue.severity === id && issue.ruleId !== 'P1' && issue.ruleId !== 'P2');
            if (group.length === 0) return null;
            return (
              <div key={id} className="space-y-1.5">
                <p className="font-semibold">{label}</p>
                {group.map((issue) => (
                  <IssueCard key={issue.id} issue={issue} onAnswer={answer} />
                ))}
              </div>
            );
          })}

          {view.answered.length > 0 ? (
            <Block title="Sudah dijawab" tone="plain">
              {view.answered.map((issue) => (
                <li key={issue.id}>
                  {issue.title} — <span className="text-fg-muted">{RESOLUTION_LABEL[issue.resolution]}</span>
                </li>
              ))}
            </Block>
          ) : null}

          {notes.length > 0 ? (
            <Block title="Catatan dari AI" tone="plain">
              {notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </Block>
          ) : null}

          <details>
            <summary className="min-h-tap cursor-pointer text-fg-muted">
              Lihat hasil transkripsi (JSON)
            </summary>
            <pre className="mt-1 max-h-80 overflow-auto rounded-lg border border-border bg-bg-subtle p-2 text-[10px]">
              {JSON.stringify({ denah, list }, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}
    </section>
  );
}

const SEVERITIES: ReadonlyArray<{ id: Severity; label: string }> = [
  { id: 'high', label: '🔴 High' },
  { id: 'medium', label: '🟠 Medium' },
  { id: 'confirm', label: '🟡 Perlu konfirmasi' },
  { id: 'cosmetic', label: 'Kosmetik' },
];

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
  return (
    <div className="rounded-lg border border-border p-2">
      <p className="font-medium">
        {issue.title}
        {issue.status === 'persisting' ? (
          <span className="ml-1.5 rounded bg-bg-subtle px-1 text-[10px] font-normal text-fg-muted">
            masih ada
          </span>
        ) : null}
      </p>
      <p className="mt-0.5 text-fg-muted">{issue.detail}</p>
      {issue.comparison ? (
        <table className="mt-1.5 w-full text-[11px]">
          <tbody>
            {Object.entries(issue.comparison)
              .filter(([, value]) => value)
              .map(([key, value]) => (
                <tr key={key} className="border-t border-border">
                  <td className="py-0.5 pr-2 text-fg-muted">{VIEW_LABEL[key] ?? key}</td>
                  <td className="py-0.5 font-mono">{value}</td>
                </tr>
              ))}
          </tbody>
        </table>
      ) : null}
      {issue.severity === 'confirm' ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(Object.keys(RESOLUTION_LABEL) as Resolution[]).map((resolution) => (
            <button
              key={resolution}
              type="button"
              onClick={() => onAnswer(issue, resolution)}
              className="min-h-tap rounded-lg border border-border px-2 text-[11px]"
            >
              {RESOLUTION_LABEL[resolution]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PdfSlot({
  label,
  file,
  onPick,
}: {
  label: string;
  file: File | null;
  onPick: (file: File | null) => void;
}): JSX.Element {
  return (
    <label className="flex min-h-tap cursor-pointer flex-col justify-center rounded-lg border border-dashed border-border-strong px-3 py-2">
      <span className="text-xs font-medium">{label}</span>
      <span className="truncate text-[11px] text-fg-muted">{file ? file.name : 'Pilih PDF…'}</span>
      <input
        type="file"
        accept="application/pdf"
        className="sr-only"
        onChange={(event) => onPick(event.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function Block({
  title,
  tone,
  children,
}: {
  title: string;
  tone: 'warn' | 'plain';
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div
      className={[
        'rounded-lg border p-2',
        tone === 'warn' ? 'border-[var(--warn-strong)]' : 'border-border',
      ].join(' ')}
    >
      <p className={tone === 'warn' ? 'mb-1 font-medium text-[var(--warn-strong)]' : 'mb-1 font-medium'}>
        {title}
      </p>
      <ul className="list-disc space-y-0.5 pl-4">{children}</ul>
    </div>
  );
}
