import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { AppShell } from '@/components/common/AppShell';
import { IconSearch, IconTrash } from '@/components/common/Icons';
import { Sheet } from '@/components/common/Sheet';
import { archiveDate, archiveSummary, groupByMonth } from '@/domain/archive';
import { cardTitle, matchesQuery } from '@/domain/board';
import { formatShortDate } from '@/domain/clinicalDate';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePatients } from '@/hooks/usePatients';
import { formatLocation } from '@/domain/identity';
import { dpjpById } from '@/domain/dpjp';
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
  const [trashOpen, setTrashOpen] = useState(false);
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
      // Nothing left to show; leaving the sheet open on an empty list reads as
      // a failure.
      setTrashOpen(false);
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
      <div className="flex items-center gap-2 px-4 py-2">
        <label className="flex min-h-tap flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-3">
          <IconSearch className="shrink-0 text-fg-faint" width={18} height={18} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nama, RM, diagnosis…"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
          />
        </label>

        {/* Only when there is something in it — an empty bin is not a control. */}
        {trashed.length > 0 ? (
          <button
            type="button"
            onClick={() => setTrashOpen(true)}
            aria-label={`Sampah, ${trashed.length} pasien`}
            className="relative min-h-tap min-w-tap shrink-0 rounded-lg border border-border text-fg-muted"
          >
            <IconTrash className="mx-auto" width={18} height={18} />
            <span className="absolute -right-1 -top-1 rounded-full bg-accent px-1.5 text-[10px] font-medium text-white">
              {trashed.length}
            </span>
          </button>
        ) : null}
      </div>

      {/*
        The trash is an ICON, not a panel.

        It used to be a bordered block above the list, which put a destructive
        control between the user and the thing they came here to read — every
        visit to the archive, to serve the rare one where something needs
        emptying. A count on an icon says the same thing in a corner.
      */}
      <Sheet open={trashOpen} onOpenChange={setTrashOpen} title="Sampah">
        <div className="p-4">
          <p className="text-xs leading-relaxed text-fg-muted">
            Pasien di sini tidak muncul di mana pun. Pulihkan untuk mengembalikannya ke
            daftar aktif, atau kosongkan untuk menghapusnya permanen.
          </p>

          <ul className="mt-3 space-y-1">
            {trashed.map((patient) => (
              <li key={patient.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {cardTitle(patient, showInitialsOnly)}
                </span>
                <button
                  type="button"
                  /**
                   * Back to ACTIVE, not to the archive.
                   *
                   * Restoring is undoing a delete, and what is being undone is
                   * usually a mistake made from the board. Putting the patient
                   * in the archive instead would mean the undo left them
                   * somewhere they had never been.
                   */
                  onClick={() => void setPatientStatus(patient.id, 'active')}
                  className="min-h-tap shrink-0 rounded-lg px-2 text-xs text-accent"
                >
                  Pulihkan
                </button>
              </li>
            ))}
          </ul>

          {confirmEmpty ? (
            <div className="mt-4 rounded-lg border border-danger/40 p-3">
              <p className="text-xs leading-relaxed text-fg-muted">
                {trashed.length} pasien beserta seluruh SOAP dan riwayat perubahannya akan
                dihapus permanen dari server. Tidak bisa dikembalikan.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmEmpty(false)}
                  className="min-h-tap flex-1 rounded-lg border border-border text-sm"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={emptying}
                  onClick={() => void emptyTrash()}
                  className="min-h-tap flex-1 rounded-lg border border-danger text-sm font-medium text-danger disabled:opacity-40"
                >
                  {emptying ? 'Menghapus…' : 'Hapus permanen'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmEmpty(true)}
              className="mt-4 min-h-tap w-full rounded-lg border border-border text-sm text-danger"
            >
              Kosongkan sampah
            </button>
          )}
        </div>
      </Sheet>

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
              {/*
                A month heading that reads as a divider, with its count.
                
                It was a bare line of small text at the same weight as the rows
                under it, so the list read as one undifferentiated run — which
                is what "flat" meant here. A rule and a count give the eye
                somewhere to stop when scrolling back through a long archive.
              */}
              <h2 className="sticky top-0 z-10 flex items-center gap-3 bg-bg/95 py-2 backdrop-blur">
                <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
                  {group.label}
                </span>
                <span className="text-[11px] text-fg-faint">{group.patients.length}</span>
                <span aria-hidden="true" className="h-px flex-1 bg-border" />
              </h2>
              <ul className="mt-2 space-y-2">
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
  const dpjp = patient.dpjpId ? dpjpById(patient.dpjpId) : undefined;

  return (
    <Link
      to={`/p/${patient.id}`}
      className="block rounded-xl border border-border bg-surface px-3 py-3 transition-colors hover:border-border-strong"
    >
      <span className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {cardTitle(patient, showInitialsOnly)}
        </span>
        <span className="shrink-0 text-[11px] text-fg-faint">
          {formatShortDate(archiveDate(patient))}
        </span>
      </span>
      {/*
        RM, ward and consultant — the three facts you search an archive BY.
        
        The row used to carry the discharge reason and the diagnosis list, both
        of which answer "what happened", when the question being asked of an
        archive is "which patient was that". A name alone is not enough on a
        ward where two Tn. Muhammad are discharged in the same week.
      */}
      <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs text-fg-muted">
        {patient.mrn ? (
          <span className="whitespace-nowrap font-medium">RM {patient.mrn}</span>
        ) : null}
        {patient.age !== undefined ? <span>{patient.age} th</span> : null}
        {patient.sex ? <span>{patient.sex}</span> : null}
        {formatLocation(patient) ? (
          <span className="min-w-0 truncate">{formatLocation(patient)}</span>
        ) : null}
      </span>

      <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[11px] text-fg-faint">
        {dpjp ? <span className="min-w-0 truncate">{dpjp.initials} · {dpjp.name}</span> : null}
      </span>

      <span className="mt-0.5 block truncate text-[11px] text-fg-faint">
        {archiveSummary(patient)}
      </span>
    </Link>
  );
}
