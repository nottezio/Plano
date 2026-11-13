import { useMemo, useState } from 'react';

import type { AccessRecord } from '@/domain/access';
import { QUOTA_DAILY, quotaLevel, summarizeAccount, type AccountUsage, type QuotaLevel } from '@/domain/usage';

const fmt = (value: number): string => value.toLocaleString('id-ID');

const LEVEL_TEXT: Record<QuotaLevel, string> = {
  ok: 'Aman.',
  warn: 'Mulai tinggi. Pantau akun dengan bacaan terbanyak di bawah.',
  danger: 'Hampir habis. Periksa akun dengan bacaan terbanyak di bawah.',
};

const LEVEL_FILL: Record<QuotaLevel, string> = {
  ok: 'bg-accent',
  warn: 'bg-[var(--warn-strong)]',
  danger: 'bg-danger',
};

const LEVEL_BORDER: Record<QuotaLevel, string> = {
  ok: 'border-border',
  warn: 'border-[var(--warn-strong)]',
  danger: 'border-danger',
};

/**
 * Kuota: which accounts read the most from Firestore.
 *
 * Every number here is an ESTIMATE counted on each device and sent at most
 * every six hours (see `domain/usage.ts`). It adds no reads: it only reads the
 * access records the page already holds.
 */
export function KuotaTab({ records }: { records: AccessRecord[] | null }): JSX.Element {
  const rows = useMemo(() => {
    const now = Date.now();
    return (records ?? [])
      .map((record) => ({ record, usage: summarizeAccount(record.usage, now) }))
      .filter((row) => row.usage.devices > 0)
      .sort((a, b) => b.usage.readsToday - a.usage.readsToday || b.usage.readsWeek - a.usage.readsWeek);
  }, [records]);

  if (records === null) return <p className="text-xs text-fg-muted">Memuat…</p>;

  const total = rows.reduce((sum, row) => sum + row.usage.readsToday, 0);
  const level = quotaLevel(total);
  const silent = records.length - rows.length;

  return (
    <div className="space-y-5">
      <section className={['space-y-3 rounded-xl border bg-surface p-4', LEVEL_BORDER[level]].join(' ')}>
        <h2 className="text-sm font-semibold">
          Bacaan Firestore hari ini <span className="font-normal text-fg-muted">(perkiraan)</span>
        </h2>
        <p className="text-sm">
          <span className="text-lg font-semibold tabular-nums">{fmt(total)}</span>{' '}
          <span className="text-fg-muted">dari {fmt(QUOTA_DAILY)} batas harian gratis</span>
        </p>
        <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-bg-subtle">
          <div
            className={['h-full', LEVEL_FILL[level]].join(' ')}
            style={{ width: `${Math.min(100, (total / QUOTA_DAILY) * 100)}%` }}
          />
        </div>
        <p role="status" className={['text-xs', level === 'ok' ? 'text-fg-muted' : 'font-semibold'].join(' ')}>
          {LEVEL_TEXT[level]}
        </p>
        <p className="text-xs text-fg-muted">
          Dihitung di tiap perangkat dan dikirim paling lama tiap 6 jam, hanya dari aplikasi yang sudah
          versi ini ({rows.length} dari {records.length} akun). Angka sebenarnya ada di Firebase Console →
          Firestore → Usage.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Per akun</h2>
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-fg-muted">
            Belum ada akun yang melapor. Laporan pertama dikirim saat aplikasi versi ini dibuka.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {rows.map(({ record, usage }) => (
              <UsageRow key={record.uid} record={record} usage={usage} />
            ))}
          </ul>
        )}
        {silent > 0 && rows.length > 0 ? (
          <p className="text-xs text-fg-faint">
            {silent} akun belum melapor: aplikasinya belum diperbarui ke versi ini.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function UsageRow({ record, usage }: { record: AccessRecord; usage: AccountUsage }): JSX.Element {
  const [open, setOpen] = useState(false);
  const name = record.displayName || record.email || record.uid;
  return (
    <li className="p-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block text-xs text-fg-muted">
            7 hari {fmt(usage.readsWeek)} · tulis {fmt(usage.writesToday)}
            {usage.errorsToday > 0 ? (
              <span className="font-semibold text-danger"> · {fmt(usage.errorsToday)} galat</span>
            ) : null}{' '}
            · {usage.devices} perangkat
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-semibold tabular-nums">{fmt(usage.readsToday)}</span>
          <span className="block text-xs text-fg-muted">bacaan hari ini</span>
        </span>
      </button>
      {open ? (
        usage.top.length > 0 ? (
          <dl className="ml-1 mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-xs">
            {usage.top.map((source) => (
              <div key={source.l} className="contents">
                <dt className="min-w-0 truncate font-mono text-fg-muted">{source.l}</dt>
                <dd className="tabular-nums">{fmt(source.r)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-xs text-fg-muted">Belum ada rincian hari ini.</p>
        )
      ) : null}
    </li>
  );
}
