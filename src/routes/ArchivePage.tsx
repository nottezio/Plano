import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { AppShell } from '@/components/common/AppShell';
import { IconSearch } from '@/components/common/Icons';
import { archiveDate, archiveSummary, groupByMonth } from '@/domain/archive';
import { cardTitle, matchesQuery } from '@/domain/board';
import { formatShortDate } from '@/domain/clinicalDate';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePatients } from '@/hooks/usePatients';
import { purgePatient, setPatientStatus } from '@/data/repositories/patients.repo';
import { useSession } from '@/store/useSession';
import type { Patient } from '@/domain/types';

export default function ArchivePage(): JSX.Element {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 150);

  const showInitialsOnly = useSession(
    (state) => state.settings().privacy.boardShowInitialsOnly,
  );
  const { patients, loading } = usePatients('archived');
  const { patients: trashed } = usePatients('trashed');
  const [emptying, setEmptying] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  /**
   * Destroy every trashed patient, for real.
   *
   * Sequential rather than parallel: each purge is many batched deletes, and
   * firing them all at once on ward wifi is how half of them fail and leave
   * patients partly deleted. Slower and finishable beats fast and ragged.
   */
  const emptyTrash = async (): Promise<void> => {
    setEmptying(true);
    try {
      for (const patient of trashed) await purgePatient(patient.id);
    } catch (error) {
      console.error('[trash] purge failed', error);
    } finally {
      setEmptying(false);
      setConfirmEmpty(false);
    }
  };

  const filtered = useMemo(
    () => patients.filter((patient) => matchesQuery(patient, debouncedQuery)),
    [patients, debouncedQuery],
  );
  const groups = useMemo(() => groupByMonth(filtered), [filtered]);

  return (
    <AppShell title="Arsip">
      <div className="mx-auto w-full max-w-3xl">
      <div className="px-4 py-2">
        <label className="flex min-h-tap items-center gap-2 rounded-lg border border-border bg-surface px-3">
          <IconSearch className="shrink-0 text-fg-faint" width={18} height={18} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nama, RM, diagnosis…"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
          />
        </label>
      </div>

      {/*
        The trash, and only when something is in it.
        
        Below the archive rather than beside it: archive is where discharged
        patients live and get searched, trash is a queue on its way out. An
        empty trash shows nothing at all — a permanent "Sampah (0)" heading
        would take space on every visit to serve the rare one.
      */}
      {trashed.length > 0 ? (
        <div className="mx-4 mb-3 rounded-lg border border-border p-3">
          <div className="flex items-center gap-2">
            <span className="flex-1 text-xs font-medium text-fg-muted">
              Sampah · {trashed.length} pasien
            </span>
            {confirmEmpty ? (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmEmpty(false)}
                  className="min-h-tap rounded-lg px-2 text-xs text-fg-muted"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={emptying}
                  onClick={() => void emptyTrash()}
                  className="min-h-tap rounded-lg px-2 text-xs font-medium text-danger disabled:opacity-40"
                >
                  {emptying ? 'Menghapus…' : 'Ya, hapus permanen'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmEmpty(true)}
                className="min-h-tap rounded-lg px-2 text-xs text-fg-muted"
              >
                Kosongkan
              </button>
            )}
          </div>

          {/*
            The confirmation names what will be destroyed and says it cannot be
            undone, because it cannot: this deletes the notes and their whole
            revision history from Firestore, which is the point of it.
          */}
          {confirmEmpty ? (
            <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
              {trashed.length} pasien beserta seluruh SOAP dan riwayat perubahannya akan
              dihapus permanen dari server. Tidak bisa dikembalikan.
            </p>
          ) : null}

          <ul className="mt-2 space-y-1">
            {trashed.map((patient) => (
              <li key={patient.id} className="flex items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate text-fg-muted">
                  {cardTitle(patient, showInitialsOnly)}
                </span>
                <button
                  type="button"
                  onClick={() => void setPatientStatus(patient.id, 'archived')}
                  className="min-h-tap shrink-0 rounded-lg px-2 text-[11px] text-accent"
                >
                  Pulihkan
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {loading ? (
        <p className="px-4 py-10 text-center text-sm text-fg-muted">Memuat…</p>
      ) : groups.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-fg-muted">
          Belum ada pasien terarsip.
        </p>
      ) : (
        <div className="px-4 pb-4">
          {groups.map((group) => (
            <section key={group.key} className="mt-4 first:mt-0">
              <h2 className="sticky top-0 bg-bg/95 py-1 text-xs font-semibold text-fg-muted backdrop-blur">
                {group.label}
              </h2>
              <ul className="mt-1 space-y-2">
                {group.patients.map((patient) => (
                  <li key={patient.id}>
                    <ArchiveRow patient={patient} showInitialsOnly={showInitialsOnly} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      </div>
    </AppShell>
  );
}

/**
 * SPEC F9 — "still copyable".
 *
 * An archived patient links to the same patient page as an active one. The
 * record is not frozen and not read-only: discharge summaries are routinely
 * written after the patient has gone home, and the whole copy engine has to
 * still work there.
 */
function ArchiveRow({
  patient,
  showInitialsOnly,
}: {
  patient: Patient;
  showInitialsOnly: boolean;
}): JSX.Element {
  return (
    <Link
      to={`/p/${patient.id}`}
      className="block rounded-lg border border-border bg-surface px-3 py-2.5"
    >
      <span className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {cardTitle(patient, showInitialsOnly)}
        </span>
        <span className="shrink-0 text-[11px] text-fg-faint">
          {formatShortDate(archiveDate(patient))}
        </span>
      </span>
      <span className="mt-0.5 block truncate text-xs text-fg-muted">
        {archiveSummary(patient)}
      </span>
      {patient.diagnoses.length > 0 ? (
        <span className="mt-0.5 block truncate text-[11px] text-fg-faint">
          {patient.diagnoses.join(', ')}
        </span>
      ) : null}
    </Link>
  );
}
