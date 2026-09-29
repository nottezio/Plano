import { useEffect, useMemo, useState } from 'react';

import { AppShell } from '@/components/common/AppShell';
import {
  setAccessStatus,
  setEnforcement,
  subscribeAllAccess,
  subscribeEnforcement,
} from '@/data/repositories/access.repo';
import { isAdmin, type AccessRecord, type AccessStatus } from '@/domain/access';
import { useSession } from '@/store/useSession';
import NotFoundPage from './NotFoundPage';
import { APP_VERSION } from '@/version.js';

/**
 * /admin — who uses Plano, and who may.
 *
 * Not linked for anyone else, and renders the ordinary "not found" page for
 * them. That is courtesy, not security: the data below comes from documents
 * the rules let only the admin read, so another account opening this route
 * gets nothing even if it bypasses this check.
 *
 * Shows registration details and the counts each app reports about itself.
 * Never anyone's notes: see `src/domain/access.ts`.
 */
export default function AdminPage(): JSX.Element {
  const uid = useSession((state) => state.user?.uid ?? null);
  if (!isAdmin(uid)) return <NotFoundPage />;
  return <AdminConsole adminUid={uid as string} />;
}

const STATUS_LABEL: Record<AccessStatus, string> = {
  approved: 'Disetujui',
  pending: 'Menunggu',
  revoked: 'Dicabut',
};

const STATUS_ORDER: Record<AccessStatus, number> = { pending: 0, approved: 1, revoked: 2 };

type Filter = 'pending' | 'approved' | 'revoked' | 'all';

const DAY_MS = 24 * 60 * 60 * 1000;

/** "5 mnt lalu", "3 jam lalu", "kemarin", "12 hari lalu", or the date. */
function ago(date: Date | null, now: number): string {
  if (!date) return 'belum pernah';
  const diff = now - date.getTime();
  if (diff < 60_000) return 'baru saja';
  if (diff < 3_600_000) return `${String(Math.floor(diff / 60_000))} mnt lalu`;
  if (diff < DAY_MS) return `${String(Math.floor(diff / 3_600_000))} jam lalu`;
  if (diff < 2 * DAY_MS) return 'kemarin';
  if (diff < 60 * DAY_MS) return `${String(Math.floor(diff / DAY_MS))} hari lalu`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * The admin console: who uses Plano, and who may.
 *
 * Laid out for the two questions it is opened for. "Is anyone waiting?" is
 * answered by the summary tiles and the default filter (Menunggu first when
 * anyone is waiting). "Who is actually using it, on which version?" by the
 * rows: last activity in words, and an outdated app version marked, since
 * an old version on someone's phone is the usual reason a fix "did not work".
 */
function AdminConsole({ adminUid }: { adminUid: string }): JSX.Element {
  const [records, setRecords] = useState<AccessRecord[] | null>(null);
  const [enforce, setEnforce] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter | null>(null);
  const [query, setQuery] = useState('');
  const now = Date.now();

  useEffect(() => {
    const report = (label: string) => (cause: unknown) => {
      console.error(`[admin] ${label}`, cause);
      setError(
        'Tidak dapat membaca data admin. Jika aturan Firestore baru belum ter-deploy, ' +
          'tunggu workflow firestore-deploy selesai.',
      );
    };
    const offRecords = subscribeAllAccess(setRecords, report('access list'));
    const offConfig = subscribeEnforcement(setEnforce, report('enforcement'));
    return () => {
      offRecords();
      offConfig();
    };
  }, []);

  const sorted = useMemo(
    () =>
      [...(records ?? [])].sort(
        (a, b) =>
          Number(isAdmin(b.uid)) - Number(isAdmin(a.uid)) ||
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          (b.lastSeenAt?.getTime() ?? 0) - (a.lastSeenAt?.getTime() ?? 0),
      ),
    [records],
  );
  const pending = sorted.filter((record) => record.status === 'pending' && !isAdmin(record.uid));
  const counts = {
    all: sorted.length,
    pending: pending.length,
    approved: sorted.filter((record) => record.status === 'approved' || isAdmin(record.uid)).length,
    revoked: sorted.filter((record) => record.status === 'revoked' && !isAdmin(record.uid)).length,
  };
  const activeWeek = sorted.filter(
    (record) => record.lastSeenAt && now - record.lastSeenAt.getTime() < 7 * DAY_MS,
  ).length;

  // Waiting accounts first, when there are any; otherwise everyone.
  const shown: Filter = filter ?? (pending.length > 0 ? 'pending' : 'all');
  const needle = query.trim().toLowerCase();
  const visible = sorted.filter((record) => {
    const admin = isAdmin(record.uid);
    if (shown === 'pending' && (record.status !== 'pending' || admin)) return false;
    if (shown === 'approved' && !(record.status === 'approved' || admin)) return false;
    if (shown === 'revoked' && (record.status !== 'revoked' || admin)) return false;
    if (!needle) return true;
    return `${record.email} ${record.displayName} ${record.uid}`.toLowerCase().includes(needle);
  });

  const act = (work: Promise<void>): void => {
    void work.catch((cause: unknown) => {
      console.error('[admin] write rejected', cause);
      setError('Perubahan ditolak server. Coba lagi, atau periksa aturan Firestore.');
    });
  };

  return (
    <AppShell title="Admin">
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-5">
        <header className="flex flex-wrap items-end gap-2">
          <div className="flex-1">
            <h1 className="text-xl font-semibold tracking-tight">Admin</h1>
            <p className="text-xs text-fg-muted">
              Siapa yang memakai Plano, dan siapa yang boleh. Tidak pernah menampilkan isi catatan.
            </p>
          </div>
          <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[11px] text-fg-muted">
            v{APP_VERSION}
          </span>
        </header>

        {error ? (
          <p role="alert" className="rounded-lg border border-danger px-3 py-2 text-xs text-danger">
            {error}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile label="Akun" value={records ? counts.all : null} />
          <Tile label="Aktif 7 hari" value={records ? activeWeek : null} />
          <Tile label="Menunggu" value={records ? counts.pending : null} tone={counts.pending > 0 ? 'warn' : undefined} />
          <Tile label="Dicabut" value={records ? counts.revoked : null} />
        </div>

        <section
          className={[
            'flex flex-wrap items-center gap-3 rounded-xl border p-4',
            enforce ? 'border-accent bg-[var(--accent-soft)]' : 'border-border bg-surface',
          ].join(' ')}
        >
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-semibold">
              Pembatasan akses
              <span
                className={[
                  'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                  enforce ? 'bg-accent text-white' : 'border border-border text-fg-muted',
                ].join(' ')}
              >
                {enforce === null ? '…' : enforce ? 'Aktif' : 'Nonaktif'}
              </span>
            </p>
            <p className="mt-1 text-xs text-fg-muted">
              {enforce === null
                ? 'Memuat…'
                : enforce
                  ? 'Hanya akun yang disetujui yang dapat membaca dan menulis data.'
                  : 'Semua akun Google yang masuk dapat memakai Plano. Akun tetap tercatat di bawah.'}
            </p>
            {enforce === false && pending.length > 0 ? (
              <p className="mt-1 text-xs text-danger">
                {pending.length} akun menunggu: setujui dulu, atau mereka langsung terkunci.
              </p>
            ) : null}
          </div>
          {enforce !== null ? (
            <ArmedButton
              label={enforce ? 'Nonaktifkan' : 'Aktifkan'}
              armedLabel={
                enforce
                  ? 'Ketuk lagi: semua akun dapat masuk'
                  : `Ketuk lagi: kunci ${pending.length} akun yang belum disetujui`
              }
              danger
              onConfirm={() => act(setEnforcement(!enforce, adminUid))}
            />
          ) : null}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label="Saring akun" className="flex flex-wrap gap-1">
              {(['pending', 'approved', 'revoked', 'all'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={shown === value}
                  onClick={() => setFilter(value)}
                  className={[
                    'min-h-tap rounded-full border px-3 text-xs font-medium [@media(pointer:fine)]:min-h-8',
                    shown === value ? 'border-accent bg-accent text-white' : 'border-border text-fg-muted',
                  ].join(' ')}
                >
                  {value === 'all' ? 'Semua' : STATUS_LABEL[value]}{' '}
                  <span className="opacity-80">{counts[value]}</span>
                </button>
              ))}
            </div>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari email atau nama…"
              aria-label="Cari akun"
              className="min-h-tap min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm [@media(pointer:fine)]:min-h-8"
            />
            {pending.length > 0 && shown === 'pending' ? (
              <ArmedButton
                label={`Setujui semua (${pending.length})`}
                armedLabel={`Ketuk lagi: setujui ${pending.length} akun`}
                onConfirm={() =>
                  act(
                    Promise.all(
                      pending.map((record) => setAccessStatus(record.uid, 'approved', adminUid)),
                    ).then(() => undefined),
                  )
                }
              />
            ) : null}
          </div>

          {records === null ? <p className="text-xs text-fg-muted">Memuat…</p> : null}
          {records !== null && visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-fg-muted">
              {records.length === 0
                ? 'Belum ada akun tercatat. Akun tercatat saat membuka Plano.'
                : 'Tidak ada akun di sini.'}
            </p>
          ) : null}

          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {visible.map((record) => (
              <AccountRow
                key={record.uid}
                record={record}
                now={now}
                onStatus={(status) => act(setAccessStatus(record.uid, status, adminUid))}
              />
            ))}
          </ul>
          <p className="text-[11px] text-fg-faint">
            Akun yang belum pernah membuka Plano versi terbaru belum tercatat. Bandingkan dengan
            Firebase Console → Authentication → Users.
          </p>
        </section>
      </div>
    </AppShell>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | null;
  tone?: 'warn' | undefined;
}): JSX.Element {
  return (
    <div
      className={[
        'rounded-xl border p-3',
        tone === 'warn' ? 'border-[var(--warn-strong)] bg-[var(--warn-soft)]' : 'border-border bg-surface',
      ].join(' ')}
    >
      <p className="text-[11px] text-fg-muted">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums">{value ?? '—'}</p>
    </div>
  );
}

const when = (date: Date | null): string =>
  date
    ? date.toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

function AccountRow({
  record,
  now,
  onStatus,
}: {
  record: AccessRecord;
  now: number;
  onStatus: (status: AccessStatus) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const admin = isAdmin(record.uid);
  const outdated = Boolean(record.appVersion) && record.appVersion !== APP_VERSION;
  const name = record.displayName || record.email || '(belum tercatat)';
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  const tone = admin
    ? 'bg-accent text-white'
    : record.status === 'approved'
      ? 'bg-[var(--accent-soft)] text-accent'
      : record.status === 'revoked'
        ? 'border border-danger text-danger'
        : 'border border-[var(--warn-strong)] bg-[var(--warn-soft)] text-fg';

  return (
    <li className="p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-subtle text-sm font-semibold"
        >
          {initial}
        </span>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left"
        >
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{name}</span>
            <span className={['shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', tone].join(' ')}>
              {admin ? 'Admin' : STATUS_LABEL[record.status]}
            </span>
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-fg-muted">
            {record.displayName && record.email ? <span className="truncate">{record.email}</span> : null}
            <span>· aktif {ago(record.lastSeenAt, now)}</span>
            {record.appVersion ? (
              <span className={outdated ? 'font-semibold text-danger' : ''}>
                · v{record.appVersion}
                {outdated ? ' (lama)' : ''}
              </span>
            ) : null}
            {record.stats ? <span>· {record.stats.patients} pasien</span> : null}
          </span>
        </button>

        {!admin ? (
          <div className="flex w-full shrink-0 flex-wrap justify-end gap-2 sm:w-auto">
            {record.status !== 'approved' ? (
              <button
                type="button"
                onClick={() => onStatus('approved')}
                className="min-h-tap rounded-lg bg-accent px-3 text-xs font-medium text-white [@media(pointer:fine)]:min-h-8"
              >
                {record.status === 'revoked' ? 'Setujui lagi' : 'Setujui'}
              </button>
            ) : null}
            {record.status !== 'revoked' ? (
              <ArmedButton
                label={record.status === 'pending' ? 'Tolak' : 'Cabut'}
                armedLabel="Ketuk lagi"
                danger
                onConfirm={() => onStatus('revoked')}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {open ? (
        <dl className="ml-12 mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-fg-muted sm:grid-cols-3">
          <Field label="Pertama tercatat" value={when(record.firstSeenAt)} />
          <Field label="Terakhir aktif" value={when(record.lastSeenAt)} />
          <Field label="Perangkat" value={record.device || '—'} />
          <Field label="Pasien" value={record.stats ? String(record.stats.patients) : '—'} />
          <Field label="Catatan harian" value={record.stats ? String(record.stats.entries) : '—'} />
          <Field
            label="Ukuran (perkiraan)"
            value={record.stats ? `≈ ${record.stats.approxKb.toLocaleString('id-ID')} KB` : '—'}
          />
          <div className="col-span-full min-w-0">
            <dt className="text-fg-faint">UID</dt>
            <dd className="break-all font-mono text-[10px]">{record.uid}</dd>
          </div>
        </dl>
      ) : null}
    </li>
  );
}

function Field({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="min-w-0">
      <dt className="text-fg-faint">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}

/** First tap arms, second acts; disarms after five seconds. */
function ArmedButton({
  label,
  armedLabel,
  danger = false,
  onConfirm,
}: {
  label: string;
  armedLabel: string;
  danger?: boolean;
  onConfirm: () => void;
}): JSX.Element {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const timer = window.setTimeout(() => setArmed(false), 5000);
    return () => window.clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onConfirm();
      }}
      className={[
        'min-h-tap rounded-lg border px-3 text-xs font-medium [@media(pointer:fine)]:min-h-8',
        armed || danger ? 'border-danger text-danger' : 'border-border',
      ].join(' ')}
    >
      {armed ? armedLabel : label}
    </button>
  );
}
