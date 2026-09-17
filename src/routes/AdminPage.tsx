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

function AdminConsole({ adminUid }: { adminUid: string }): JSX.Element {
  const [records, setRecords] = useState<AccessRecord[] | null>(null);
  const [enforce, setEnforce] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const act = (work: Promise<void>): void => {
    void work.catch((cause: unknown) => {
      console.error('[admin] write rejected', cause);
      setError('Perubahan ditolak server. Coba lagi, atau periksa aturan Firestore.');
    });
  };

  return (
    <AppShell title="Admin">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-4">
        {error ? (
          <p role="alert" className="rounded-lg border border-danger px-3 py-2 text-xs text-danger">
            {error}
          </p>
        ) : null}

        <section className="space-y-2 rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">Pembatasan akses</h2>
          <p className="text-xs text-fg-muted">
            {enforce === null
              ? 'Memuat…'
              : enforce
                ? 'AKTIF — hanya akun yang disetujui yang dapat membaca dan menulis data.'
                : 'NONAKTIF — semua akun yang masuk dapat memakai Plano, seperti sebelumnya. ' +
                  'Akun yang membuka Plano tetap tercatat di bawah.'}
          </p>
          {enforce === false && pending.length > 0 ? (
            <p className="text-xs text-danger">
              {pending.length} akun masih menunggu. Setujui dulu sebelum mengaktifkan, atau
              mereka langsung terkunci.
            </p>
          ) : null}
          {enforce !== null ? (
            <ArmedButton
              label={enforce ? 'Nonaktifkan pembatasan' : 'Aktifkan pembatasan'}
              armedLabel={
                enforce
                  ? 'Ketuk lagi: semua akun dapat masuk'
                  : `Ketuk lagi: kunci ${pending.length} akun yang belum disetujui`
              }
              danger
              onConfirm={() => act(setEnforcement(!enforce, adminUid))}
            />
          ) : null}
          <p className="text-[11px] text-fg-faint">
            Akun yang belum pernah membuka Plano versi ini belum tercatat. Bandingkan dengan
            daftar di Firebase Console → Authentication.
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex-1 text-sm font-semibold">
              Akun {records ? `(${records.length})` : ''}
            </h2>
            {pending.length > 0 ? (
              <ArmedButton
                label={`Setujui semua yang menunggu (${pending.length})`}
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
          {records?.length === 0 ? (
            <p className="text-xs text-fg-muted">
              Belum ada akun tercatat. Akun tercatat saat membuka Plano versi ini.
            </p>
          ) : null}

          <ul className="space-y-2">
            {sorted.map((record) => (
              <AccountCard
                key={record.uid}
                record={record}
                onStatus={(status) => act(setAccessStatus(record.uid, status, adminUid))}
              />
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
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

function AccountCard({
  record,
  onStatus,
}: {
  record: AccessRecord;
  onStatus: (status: AccessStatus) => void;
}): JSX.Element {
  const admin = isAdmin(record.uid);
  const tone =
    record.status === 'approved'
      ? 'bg-accent/15 text-accent'
      : record.status === 'revoked'
        ? 'border border-danger text-danger'
        : 'border border-border text-fg';

  return (
    <li className="rounded-xl border border-border bg-surface p-3">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{record.email || '(email belum tercatat)'}</p>
          <p className="truncate text-xs text-fg-muted">{record.displayName || '—'}</p>
        </div>
        <span className={['shrink-0 rounded px-2 py-0.5 text-[11px] font-medium', tone].join(' ')}>
          {admin ? 'Admin' : STATUS_LABEL[record.status]}
        </span>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-fg-muted sm:grid-cols-3">
        <Field label="Pertama tercatat" value={when(record.firstSeenAt)} />
        <Field label="Terakhir aktif" value={when(record.lastSeenAt)} />
        <Field
          label="Perangkat · versi"
          value={[record.device, record.appVersion].filter(Boolean).join(' · ') || '—'}
        />
        <Field label="Pasien" value={record.stats ? String(record.stats.patients) : '—'} />
        <Field label="Catatan harian" value={record.stats ? String(record.stats.entries) : '—'} />
        <Field
          label="Ukuran (perkiraan)"
          value={record.stats ? `≈ ${record.stats.approxKb.toLocaleString('id-ID')} KB` : '—'}
        />
      </dl>
      <p className="mt-1 break-all font-mono text-[10px] text-fg-faint">{record.uid}</p>

      {!admin ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {record.status !== 'approved' ? (
            <button
              type="button"
              onClick={() => onStatus('approved')}
              className="min-h-tap rounded-lg border border-accent px-3 text-xs font-medium text-accent"
            >
              {record.status === 'revoked' ? 'Setujui lagi' : 'Setujui'}
            </button>
          ) : null}
          {record.status !== 'revoked' ? (
            <ArmedButton
              label={record.status === 'pending' ? 'Tolak' : 'Cabut akses'}
              armedLabel="Ketuk lagi untuk mencabut"
              danger
              onConfirm={() => onStatus('revoked')}
            />
          ) : null}
        </div>
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
        'min-h-tap rounded-lg border px-3 text-xs font-medium',
        armed || danger ? 'border-danger text-danger' : 'border-border',
      ].join(' ')}
    >
      {armed ? armedLabel : label}
    </button>
  );
}
