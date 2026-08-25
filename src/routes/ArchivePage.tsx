import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { AppShell } from '@/components/common/AppShell';
import { IconSearch } from '@/components/common/Icons';
import { archiveDate, archiveSummary, groupByMonth } from '@/domain/archive';
import { cardTitle, matchesQuery } from '@/domain/board';
import { formatShortDate } from '@/domain/clinicalDate';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePatients } from '@/hooks/usePatients';
import { updateArchiveNote } from '@/data/repositories/patients.repo';
import { useSession } from '@/store/useSession';
import type { Patient } from '@/domain/types';

export default function ArchivePage(): JSX.Element {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 150);

  const showInitialsOnly = useSession(
    (state) => state.settings().privacy.boardShowInitialsOnly,
  );
  const { patients, loading } = usePatients('archived');

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
  /**
   * The note is editable; the reason and the date are not.
   *
   * Those two record what happened and when — a record you can rewrite is not
   * a record. The note is commentary, so it is the part that can be corrected
   * afterwards, which is usually when you find out what was actually wrong.
   */
  const [note, setNote] = useState(patient.archive?.note ?? '');
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-surface">
    <Link
      to={`/p/${patient.id}`}
      className="block px-3 py-2.5"
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

      <div className="border-t border-border px-3 py-2">
        {editing ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={note}
              autoFocus
              placeholder="Catatan arsip…"
              onChange={(event) => setNote(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              onBlur={() => {
                setEditing(false);
                if (note.trim() !== (patient.archive?.note ?? '')) {
                  void updateArchiveNote(patient.id, note).catch((error: unknown) =>
                    console.error('[archive] note write rejected', error),
                  );
                }
              }}
              className="min-h-tap min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 text-xs outline-none"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-tap w-full truncate text-left text-[11px] text-fg-muted"
          >
            {note.trim() || <span className="text-fg-faint">Tambah catatan arsip…</span>}
          </button>
        )}
      </div>
    </div>
  );
}
