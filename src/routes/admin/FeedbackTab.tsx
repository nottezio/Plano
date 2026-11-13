import { useEffect, useState } from 'react';

import { setFeedbackStatus, subscribeFeedback } from '@/data/repositories/feedback.repo';
import { feedbackForClaude, type Feedback } from '@/domain/feedback';
import { copyText } from '@/lib/clipboard';
import { when } from './adminUi';

/**
 * Laporan: bug reports and suggestions, newest first, open ones by default.
 * "Salin untuk Claude" copies the whole report, errors and session log
 * included, as one block to paste into Claude Code.
 *
 * Mounted only while this tab is open, so the reports are not read on the
 * other tabs.
 */
export function FeedbackTab(): JSX.Element {
  const [reports, setReports] = useState<Feedback[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  useEffect(
    () =>
      subscribeFeedback(setReports, (cause: unknown) => {
        console.error('[admin] feedback list', cause);
        setError('Tidak dapat membaca laporan. Aturan Firestore baru mungkin belum ter-deploy.');
      }),
    [],
  );

  const open = (reports ?? []).filter((report) => report.status === 'baru');
  const visible = (reports ?? []).filter((report) => (report.status === 'selesai') === showDone);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-sm font-semibold">
          Laporan & saran{' '}
          <span className="font-normal text-fg-muted">{reports ? `${open.length} baru` : '…'}</span>
        </h2>
        <div role="tablist" aria-label="Saring laporan" className="flex gap-1">
          {([false, true] as const).map((done) => (
            <button
              key={String(done)}
              type="button"
              role="tab"
              aria-selected={showDone === done}
              onClick={() => setShowDone(done)}
              className={[
                'min-h-tap rounded-full border px-3 text-xs font-medium [@media(pointer:fine)]:min-h-8',
                showDone === done ? 'border-accent bg-accent text-on-accent' : 'border-border text-fg-muted',
              ].join(' ')}
            >
              {done ? 'Selesai' : 'Baru'}
            </button>
          ))}
        </div>
      </div>
      {error ? (
        <p role="alert" className="rounded-lg border border-danger px-3 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}
      {reports !== null && visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-fg-muted">
          {showDone ? 'Belum ada yang selesai.' : 'Tidak ada laporan baru.'}
        </p>
      ) : null}
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {visible.map((report) => (
          <FeedbackRow key={report.id} report={report} onError={setError} />
        ))}
      </ul>
    </section>
  );
}

function FeedbackRow({
  report,
  onError,
}: {
  report: Feedback;
  onError: (message: string) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const errors = report.log.filter((entry) => entry.kind === 'error');

  return (
    <li className="space-y-2 p-3 text-xs">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="block w-full text-left"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span
            className={[
              'rounded-full px-2 py-0.5 text-[11px] font-semibold',
              report.kind === 'bug' ? 'border border-danger text-danger' : 'bg-[var(--accent-soft)] text-accent',
            ].join(' ')}
          >
            {report.kind === 'bug' ? 'Bug' : 'Saran'}
          </span>
          <span className="truncate font-medium">{report.email || report.uid}</span>
          <span className="text-fg-muted">· {when(report.createdAt)}</span>
          <span className="font-mono text-fg-muted">· v{report.device.appVersion}</span>
          {errors.length ? <span className="text-danger">· {errors.length} kesalahan</span> : null}
        </span>
        <span className={['mt-1 whitespace-pre-wrap text-sm', open ? 'line-clamp-none' : 'line-clamp-2'].join(' ')}>
          {report.text}
        </span>
      </button>

      {open ? (
        <div className="space-y-2">
          <p className="break-all text-fg-muted">
            {report.device.userAgent} · {report.device.viewport} ·{' '}
            {report.device.standalone ? 'aplikasi terpasang' : 'tab browser'}
          </p>
          {errors.length ? (
            <ul className="space-y-1">
              {errors.map((entry, index) => (
                <li key={`${entry.at}-${index}`} className="break-all font-mono text-[11px] text-danger">
                  {new Date(entry.at).toLocaleString('id-ID')} {entry.detail}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            void copyText(feedbackForClaude(report)).then(setCopied);
          }}
          className="min-h-tap rounded-lg border border-border px-3 font-medium [@media(pointer:fine)]:min-h-8"
        >
          {copied ? 'Tersalin' : 'Salin untuk Claude'}
        </button>
        <button
          type="button"
          onClick={() => {
            void setFeedbackStatus(report.id, report.status === 'baru' ? 'selesai' : 'baru').catch(
              (cause: unknown) => {
                console.error('[admin] feedback status', cause);
                onError('Perubahan ditolak server. Coba lagi.');
              },
            );
          }}
          className="min-h-tap rounded-lg bg-accent px-3 font-medium text-on-accent [@media(pointer:fine)]:min-h-8"
        >
          {report.status === 'baru' ? 'Tandai selesai' : 'Buka lagi'}
        </button>
      </div>
    </li>
  );
}
