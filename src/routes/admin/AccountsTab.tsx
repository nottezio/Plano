import { useEffect, useMemo, useState } from 'react';

import {
  setAccessStatus,
  setEnforcement,
  setMinVersion,
  subscribeAccessConfig,
} from '@/data/repositories/access.repo';
import { NEW_HOST, isAdmin, type AccessConfig, type AccessRecord, type AccessStatus } from '@/domain/access';
import { isOlderVersion, isValidAppVersion } from '@/domain/appVersion';
import { summarizeAccount } from '@/domain/usage';
import { APP_VERSION } from '@/version.js';
import { ago, ArmedButton, DAY_MS, Field, Tile, when } from './adminUi';

const STATUS_LABEL: Record<AccessStatus, string> = {
  approved: 'Disetujui',
  viewer: 'Hanya list',
  pending: 'Menunggu',
  revoked: 'Dicabut',
};

const STATUS_ORDER: Record<AccessStatus, number> = { pending: 0, approved: 1, viewer: 2, revoked: 3 };

type Filter = 'pending' | 'approved' | 'revoked' | 'all';

/**
 * Akun: who uses Plano, and who may.
 *
 * Laid out for the two questions it is opened for. "Is anyone waiting?" is
 * answered by the summary tiles and the default filter (Menunggu first when
 * anyone is waiting). "Who is actually using it, on which version?" by the
 * rows: last activity in words, and an outdated app version marked, since
 * an old version on someone's phone is the usual reason a fix "did not work".
 *
 * The records come from the page (one listener shared by every tab); the
 * enforcement switch is read here, so it costs nothing on the other tabs.
 */
export function AccountsTab({
  records,
  adminUid,
  onError,
}: {
  records: AccessRecord[] | null;
  adminUid: string;
  onError: (message: string) => void;
}): JSX.Element {
  const [config, setConfig] = useState<AccessConfig | null>(null);
  const enforce = config ? config.enforce : null;
  const [filter, setFilter] = useState<Filter | null>(null);
  const [query, setQuery] = useState('');
  const now = Date.now();

  useEffect(
    () =>
      subscribeAccessConfig(setConfig, (cause: unknown) => {
        console.error('[admin] access config', cause);
        onError(
          'Tidak dapat membaca data admin. Jika aturan Firestore baru belum ter-deploy, ' +
            'tunggu workflow firestore-deploy selesai.',
        );
      }),
    [onError],
  );

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
      onError('Perubahan ditolak server. Coba lagi, atau periksa aturan Firestore.');
    });
  };

  return (
    <div className="space-y-5">
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
                'rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide',
                enforce ? 'bg-accent text-on-accent' : 'border border-border text-fg-muted',
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

      <ReleaseSection records={records} config={config} adminUid={adminUid} now={now} act={act} />

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
                  shown === value ? 'border-accent bg-accent text-on-accent' : 'border-border text-fg-muted',
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
        <p className="text-xs text-fg-faint">
          Akun yang belum pernah membuka Plano versi terbaru belum tercatat. Bandingkan dengan
          Firebase Console → Authentication → Users.
        </p>
      </section>
    </div>
  );
}

/**
 * Where people open Plano from, and the oldest version allowed.
 *
 * Both answer "who still needs a nudge": the first during the move to the new
 * address, the second after a fix that must reach every phone. Counts come from
 * what each app reports about itself, so an account that has not opened a
 * recent version cannot be placed yet and is counted apart.
 */
function ReleaseSection({
  records,
  config,
  adminUid,
  now,
  act,
}: {
  records: AccessRecord[] | null;
  config: AccessConfig | null;
  adminUid: string;
  now: number;
  act: (work: Promise<void>) => void;
}): JSX.Element {
  const [draft, setDraft] = useState(APP_VERSION);
  const minVersion = config?.minVersion ?? null;

  const active = (records ?? []).filter(
    (record) => record.lastSeenAt && now - record.lastSeenAt.getTime() < 7 * DAY_MS,
  );
  const moved = active.filter((record) => record.host === NEW_HOST).length;
  const old = active.filter((record) => record.host && record.host !== NEW_HOST).length;
  const silent = active.length - moved - old;

  const below = (version: string): number =>
    (records ?? []).filter(
      (record) => record.status !== 'revoked' && isOlderVersion(record.appVersion, version),
    ).length;
  const draftOk = isValidAppVersion(draft);
  const share = (count: number): string => `${active.length ? (count / active.length) * 100 : 0}%`;

  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface p-4">
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Pindah alamat</h2>
        {records === null ? (
          <p className="text-xs text-fg-muted">Memuat…</p>
        ) : active.length === 0 ? (
          <p className="text-xs text-fg-muted">Belum ada akun yang aktif dalam 7 hari terakhir.</p>
        ) : (
          <>
            <p className="text-xs text-fg-muted">
              <span className="font-semibold text-fg">
                {moved} dari {active.length}
              </span>{' '}
              akun aktif 7 hari sudah membuka {NEW_HOST}.
            </p>
            <div aria-hidden="true" className="flex h-2 overflow-hidden rounded-full bg-bg-subtle">
              <span className="bg-accent" style={{ width: share(moved) }} />
              <span className="bg-[var(--warn-strong)]" style={{ width: share(old) }} />
            </div>
            {old + silent > 0 ? (
              <p className="text-xs text-fg-muted">
                {old > 0 ? `${old} masih di alamat lama. ` : ''}
                {silent > 0
                  ? `${silent} belum melaporkan alamat: aplikasinya belum diperbarui ke versi ini.`
                  : ''}
              </p>
            ) : null}
          </>
        )}
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <h2 className="text-sm font-semibold">Versi minimum</h2>
        <p className="text-xs text-fg-muted">
          Aplikasi yang lebih lama dari batas ini menampilkan ajakan memperbarui. Tidak memblokir
          pemakaian, juga saat offline.
        </p>
        <p className="text-xs text-fg-muted">
          {minVersion
            ? `Batas saat ini v${minVersion}: ${below(minVersion)} akun masih di bawahnya.`
            : 'Belum ada batas.'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label="Versi minimum"
            aria-invalid={!draftOk}
            spellCheck={false}
            autoComplete="off"
            className={[
              'min-h-tap w-44 rounded-lg border bg-surface px-3 font-mono text-sm [@media(pointer:fine)]:min-h-8',
              draftOk ? 'border-border' : 'border-danger',
            ].join(' ')}
          />
          {draftOk && draft.trim() !== minVersion ? (
            <ArmedButton
              label="Terapkan"
              armedLabel={`Ketuk lagi: ${below(draft.trim())} akun diminta memperbarui`}
              onConfirm={() => act(setMinVersion(draft.trim(), adminUid))}
            />
          ) : null}
          {minVersion ? (
            <ArmedButton
              label="Hapus batas"
              armedLabel="Ketuk lagi: tanpa batas"
              danger
              onConfirm={() => act(setMinVersion(null, adminUid))}
            />
          ) : null}
        </div>
        {!draftOk ? (
          <p role="alert" className="text-xs text-danger">
            Format versi: tahun-bulan-tanggal.nomor, mis. {APP_VERSION}.
          </p>
        ) : null}
      </div>
    </section>
  );
}

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
  const errorsToday = summarizeAccount(record.usage, now).errorsToday;
  const name = record.displayName || record.email || '(belum tercatat)';
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  const tone = admin
    ? 'bg-accent text-on-accent'
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
            <span className={['shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', tone].join(' ')}>
              {admin ? 'Admin' : STATUS_LABEL[record.status]}
            </span>
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-fg-muted">
            {record.displayName && record.email ? <span className="truncate">{record.email}</span> : null}
            <span>· aktif {ago(record.lastSeenAt, now)}</span>
            {record.appVersion ? (
              <span className={outdated ? 'font-semibold text-danger' : ''}>
                · v{record.appVersion}
                {outdated ? ' (lama)' : ''}
              </span>
            ) : null}
            {record.stats ? <span>· {record.stats.patients} pasien</span> : null}
            {errorsToday > 0 ? (
              <span className="font-semibold text-danger">· {errorsToday} galat hari ini</span>
            ) : null}
            {record.host ? (
              <span
                className={[
                  'rounded-full px-1.5 text-[11px] font-medium',
                  record.host === NEW_HOST ? 'bg-[var(--accent-soft)] text-accent' : 'border border-border',
                ].join(' ')}
              >
                {record.host === NEW_HOST ? 'alamat baru' : 'alamat lama'}
              </span>
            ) : null}
          </span>
        </button>

        {!admin ? (
          <div className="flex w-full shrink-0 flex-wrap justify-end gap-2 sm:w-auto">
            {record.status !== 'approved' ? (
              <button
                type="button"
                onClick={() => onStatus('approved')}
                className="min-h-tap rounded-lg bg-accent px-3 text-xs font-medium text-on-accent [@media(pointer:fine)]:min-h-8"
              >
                {record.status === 'revoked' ? 'Setujui lagi' : 'Setujui'}
              </button>
            ) : null}
            {record.status !== 'viewer' ? (
              <button
                type="button"
                onClick={() => onStatus('viewer')}
                title="Hanya bisa melihat list di List Maker"
                className="min-h-tap rounded-lg border border-border px-3 text-xs font-medium [@media(pointer:fine)]:min-h-8"
              >
                Hanya list
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
        <dl className="ml-12 mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-fg-muted sm:grid-cols-3">
          <Field label="Pertama tercatat" value={when(record.firstSeenAt)} />
          <Field label="Terakhir aktif" value={when(record.lastSeenAt)} />
          <Field label="Perangkat" value={record.device || '—'} />
          <Field label="Alamat" value={record.host || '—'} />
          <Field label="Pasien" value={record.stats ? String(record.stats.patients) : '—'} />
          <Field label="Catatan harian" value={record.stats ? String(record.stats.entries) : '—'} />
          <Field
            label="Ukuran (perkiraan)"
            value={record.stats ? `≈ ${record.stats.approxKb.toLocaleString('id-ID')} KB` : '—'}
          />
          <div className="col-span-full min-w-0">
            <dt className="text-fg-faint">UID</dt>
            <dd className="break-all font-mono text-[11px]">{record.uid}</dd>
          </div>
        </dl>
      ) : null}
    </li>
  );
}
