import { useMemo, useState } from 'react';

import { stampAdminView } from '@/data/repositories/access.repo';
import { adminRecentEntries } from '@/data/repositories/entries.repo';
import { adminListPatients } from '@/data/repositories/patients.repo';
import { isAdmin, stampIsFresh, type AccessRecord } from '@/domain/access';
import { formatDmy } from '@/domain/dateDmy';
import type { Patient, PatientStatus } from '@/domain/types';

type Entries = Awaited<ReturnType<typeof adminRecentEntries>>;

/** How long to wait for the "last opened" stamp before giving up (the admin is offline). */
const STAMP_WAIT_MS = 8000;

const GROUPS: readonly { status: PatientStatus; label: string }[] = [
  { status: 'active', label: 'Aktif' },
  { status: 'archived', label: 'Diarsipkan' },
  { status: 'trashed', label: 'Sampah' },
];

const nameOf = (record: AccessRecord): string => record.displayName || record.email || record.uid;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

/**
 * Pasien: one account's patients and their newest notes, read only.
 *
 * What makes this acceptable, and why each part exists:
 * - The account is told in Akun, with the time of the last look. That time is
 *   written BEFORE anything is read, and if it cannot be written nothing is
 *   read: no stamp, no view.
 * - It reads on request only (no listener): one read per patient listed (at
 *   most 50) and up to 7 per patient opened.
 * - Nothing here edits, copies or exports a note; there is no such button.
 * - Never logs a name, an RM or a note.
 */
export function PatientsTab({
  records,
  onError,
}: {
  records: AccessRecord[] | null;
  onError: (message: string) => void;
}): JSX.Element {
  const accounts = useMemo(
    () =>
      (records ?? [])
        .filter((record) => !isAdmin(record.uid))
        .sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'id')),
    [records],
  );
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<AccessRecord | null>(null);
  const [patients, setPatients] = useState<Patient[] | null>(null);

  const open = async (): Promise<void> => {
    const record = accounts.find((entry) => entry.uid === pick);
    if (!record) return;
    setBusy(true);
    setViewing(null);
    setPatients(null);
    try {
      // Stamp first. Skipped only if the last stamp is under an hour old.
      if (!stampIsFresh(record.lastAdminViewAt, Date.now())) {
        await withTimeout(stampAdminView(record.uid), STAMP_WAIT_MS);
      }
      setPatients(await adminListPatients(record.uid));
      setViewing(record);
    } catch (cause) {
      console.error('[admin] patients', cause instanceof Error ? cause.name : 'error');
      onError(
        'Tidak dapat membuka pasien. Jejak "terakhir dibuka" harus tercatat dulu, jadi perlu online. ' +
          'Jika aturan Firestore baru belum ter-deploy, tunggu workflow firestore-deploy selesai.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Buka pasien sebuah akun</h2>
        <p className="text-xs leading-relaxed text-fg-muted">
          Hanya baca. Setiap kali Anda membuka, waktunya tercatat di akun itu dan terlihat olehnya di
          Akun. Data tersimpan di cache perangkat ini; Keluar (sign out) menghapusnya, jadi tutup tab
          Plano lain dulu. Pakai hanya di perangkat Anda sendiri.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={pick}
            onChange={(event) => setPick(event.target.value)}
            aria-label="Akun"
            className="min-h-tap min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm [@media(pointer:fine)]:min-h-8"
          >
            <option value="">Pilih akun…</option>
            {accounts.map((record) => (
              <option key={record.uid} value={record.uid}>
                {nameOf(record)}
                {record.displayName && record.email ? ` (${record.email})` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!pick || busy}
            onClick={() => void open()}
            className="min-h-tap rounded-lg bg-accent px-4 text-sm font-medium text-on-accent disabled:opacity-60 [@media(pointer:fine)]:min-h-8"
          >
            {busy ? 'Membuka…' : 'Buka pasien'}
          </button>
        </div>
      </section>

      {viewing && patients ? (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold">
            {nameOf(viewing)}{' '}
            <span className="font-normal text-fg-muted">
              {patients.length} pasien{patients.length >= 50 ? ' (50 pertama)' : ''}
            </span>
          </h2>
          {patients.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-fg-muted">
              Akun ini belum punya pasien.
            </p>
          ) : null}
          {GROUPS.map(({ status, label }) => {
            const group = patients
              .filter((patient) => patient.status === status)
              .sort((a, b) => a.name.localeCompare(b.name, 'id'));
            if (group.length === 0) return null;
            return (
              <div key={status} className="space-y-2">
                <h3 className="text-xs font-semibold text-fg-muted">
                  {label} <span className="font-normal">{group.length}</span>
                </h3>
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                  {group.map((patient) => (
                    <PatientRow key={patient.id} patient={patient} onError={onError} />
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}

function PatientRow({
  patient,
  onError,
}: {
  patient: Patient;
  onError: (message: string) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entries | null>(null);

  const toggle = (): void => {
    const next = !open;
    setOpen(next);
    if (next && entries === null) {
      adminRecentEntries(patient.id)
        .then(setEntries)
        .catch((cause: unknown) => {
          console.error('[admin] entries', cause instanceof Error ? cause.name : 'error');
          onError('Tidak dapat membaca catatan pasien.');
        });
    }
  };

  const place = [patient.ward, patient.room && `kamar ${patient.room}`, patient.bed && `bed ${patient.bed}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="p-3">
      <button type="button" onClick={toggle} aria-expanded={open} className="block w-full text-left">
        <span className="block truncate text-sm font-medium">{patient.name || '(tanpa nama)'}</span>
        <span className="block text-xs text-fg-muted">
          {patient.mrn ? `RM ${patient.mrn}` : 'tanpa RM'}
          {place ? ` · ${place}` : ''}
        </span>
      </button>
      {open ? (
        <div className="mt-3 space-y-3">
          {entries === null ? <p className="text-xs text-fg-muted">Memuat…</p> : null}
          {entries !== null && entries.length === 0 ? (
            <p className="text-xs text-fg-muted">Belum ada catatan harian.</p>
          ) : null}
          {(entries ?? []).map((entry) => (
            <div key={entry.date} className="space-y-1">
              <p className="text-xs font-semibold text-fg-muted">
                {/^\d{4}-\d{2}-\d{2}$/.test(entry.date) ? formatDmy(entry.date) : entry.date}
              </p>
              {/* Exactly as stored: plain text, never interpreted or rewritten. */}
              <pre className="whitespace-pre-wrap break-words rounded-lg bg-bg-subtle p-3 font-sans text-xs leading-relaxed">
                {entry.body}
              </pre>
            </div>
          ))}
        </div>
      ) : null}
    </li>
  );
}
