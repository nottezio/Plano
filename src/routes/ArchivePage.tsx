import { privateText } from '@/domain/identity';
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { ArchiveScopePicker, useArchiveScopes } from '@/components/archive/NoteSearchToggle';
import { AppShell } from '@/components/common/AppShell';
import { Highlight } from '@/components/common/Highlight';
import { IconSearch, IconTrash } from '@/components/common/Icons';
import { Sheet } from '@/components/common/Sheet';
import {
  ARCHIVE_REASON_LABELS,
  archiveDate,
  groupByMonth,
  isMonthOpen,
  isWeekOpen,
  setAllFolds,
  type ArchiveFolds,
} from '@/domain/archive';
import {
  NO_ARCHIVE_FILTERS,
  archiveFacets,
  hasArchiveFilters,
  matchArchivedScoped,
  matchesArchiveFilters,
  searchTokens,
  type ArchiveFilters,
  type Facet,
} from '@/domain/archiveSearch';
import { cardTitle } from '@/domain/board';
import { formatShortDate } from '@/domain/clinicalDate';
import { dpjpById } from '@/domain/dpjp';
import { formatLocation } from '@/domain/identity';
import { purgePatient, setPatientStatus } from '@/data/repositories/patients.repo';
import { useArchiveText } from '@/hooks/useArchiveText';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePatients } from '@/hooks/usePatients';
import { useSession } from '@/store/useSession';
import type { Patient } from '@/domain/types';

/**
 * Arsip — finding a patient who has gone home.
 *
 * REDESIGNED AROUND THE QUESTION "WHICH PATIENT WAS THAT?"
 *
 * The old page was a search box over one long run of identical bordered
 * boxes, three lines of small grey text each, grouped by month with no way to
 * jump to one. Finding "Prof PK's patient from August who died" meant
 * scrolling and reading.
 *
 *  - The header is pinned: search, the switch to search inside notes, and the
 *    four filters stay reachable from anywhere in a long list.
 *  - Filters are DPJP, ward, reason and month, each offering only values that
 *    occur, with counts (`archiveFacets`).
 *  - A row reads in one glance: name, then RM · location · DPJP, and the
 *    reason only when it is not the ordinary "Pulang", so Meninggal and
 *    Pindah stand out instead of being one more grey word.
 *  - When the notes matched, the row shows where, and the words are marked.
 */

type FacetKey = keyof ArchiveFilters;

const FACET_TITLES: Record<FacetKey, string> = {
  dpjp: 'DPJP',
  ward: 'Ruang',
  reason: 'Alasan',
  month: 'Bulan',
};

export default function ArchivePage(): JSX.Element {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 150);
  const tokens = useMemo(() => searchTokens(debouncedQuery), [debouncedQuery]);
  const [filters, setFilters] = useState<ArchiveFilters>(NO_ARCHIVE_FILTERS);
  const [picking, setPicking] = useState<FacetKey | null>(null);

  const showInitialsOnly = useSession(
    (state) => state.settings().privacy.boardShowInitialsOnly,
  );
  const { patients, loading } = usePatients('archived');
  const { patients: trashed } = usePatients('trashed');

  const [scopes, toggleScope] = useArchiveScopes();
  const searchSoap = scopes.has('soap');
  const noteText = useArchiveText(patients, searchSoap);

  const facets = useMemo(() => archiveFacets(patients), [patients]);

  const matches = useMemo(
    () =>
      patients
        .filter((patient) => matchesArchiveFilters(patient, filters))
        .map((patient) => matchArchivedScoped(patient, tokens, scopes, noteText.text(patient)))
        .filter((match): match is NonNullable<typeof match> => match !== null),
    [patients, filters, tokens, scopes, noteText],
  );
  const snippets = useMemo(
    () => new Map(matches.map((match) => [match.patient.id, match.snippet])),
    [matches],
  );
  const groups = useMemo(() => groupByMonth(matches.map((match) => match.patient)), [matches]);
  const narrowing = tokens.length > 0 || hasArchiveFilters(filters);
  const [folds, setFolds] = useArchiveFolds();
  const toggleFold = (key: string, open: boolean): void => setFolds({ ...folds, [key]: !open });
  const allOpen = groups.every((group, position) => isMonthOpen(folds, group.key, position, false));

  const facetOptions = (key: FacetKey): Facet<string>[] =>
    key === 'dpjp'
      ? facets.dpjps
      : key === 'ward'
        ? facets.wards
        : key === 'reason'
          ? facets.reasons
          : facets.months;

  const chipLabel = (key: FacetKey): string => {
    const value = filters[key];
    if (value === null) return FACET_TITLES[key];
    return facetOptions(key).find((option) => option.value === value)?.label ?? value;
  };

  return (
    <AppShell title="Arsip">
      <div className="sticky top-0 z-20 border-b border-border bg-bg">
        <div className="mx-auto w-full max-w-3xl px-4 pb-2 pt-2">
          <div className="flex items-center gap-2">
            <label className="flex min-h-tap flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-3 focus-within:border-accent">
              <IconSearch className="shrink-0 text-fg-faint" width={18} height={18} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Cari pasien arsip"
                placeholder={`Cari ${[
                  scopes.has('identitas') ? 'nama, RM, diagnosis' : '',
                  scopes.has('arsip') ? 'catatan arsip' : '',
                  scopes.has('soap') ? 'isi SOAP' : '',
                ]
                  .filter(Boolean)
                  .join(', ')}…`}
                className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
              />
            </label>
            {trashed.length > 0 ? <TrashButton trashed={trashed} showInitialsOnly={showInitialsOnly} /> : null}
          </div>

          <div className="mt-1">
            <ArchiveScopePicker scopes={scopes} onToggle={toggleScope} status={noteText} />
          </div>

          {/* Scrolls sideways rather than wrapping: four chips and a reset
              must not take two rows of a phone screen. */}
          <div className="-mx-4 mt-1 flex items-center gap-2 overflow-x-auto px-4">
            {(Object.keys(FACET_TITLES) as FacetKey[]).map((key) => {
              const active = filters[key] !== null;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPicking(key)}
                  aria-haspopup="dialog"
                  className={[
                    'min-h-tap shrink-0 whitespace-nowrap rounded-full border px-3 text-xs',
                    active
                      ? 'border-accent bg-accent font-semibold text-white'
                      : 'border-border text-fg-muted hover:bg-bg-subtle',
                  ].join(' ')}
                >
                  {chipLabel(key)} {active ? '' : '▾'}
                </button>
              );
            })}
            {hasArchiveFilters(filters) ? (
              <button
                type="button"
                onClick={() => setFilters(NO_ARCHIVE_FILTERS)}
                className="min-h-tap shrink-0 px-2 text-xs text-accent"
              >
                Reset
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 pb-6">
        {loading ? (
          <p className="py-10 text-center text-sm text-fg-muted">Memuat…</p>
        ) : patients.length === 0 ? (
          <p className="py-12 text-center text-sm text-fg-muted">Belum ada pasien terarsip.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 pb-1 pt-3">
              <p className="min-w-0 flex-1 text-xs text-fg-muted" aria-live="polite">
                {narrowing
                  ? `${matches.length} dari ${patients.length} pasien · semua bulan dibuka`
                  : `${patients.length} pasien`}
              </p>
              {!narrowing && groups.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setFolds(setAllFolds(groups, !allOpen))}
                  className="min-h-tap rounded-lg px-2 text-xs font-medium text-accent hover:bg-bg-subtle [@media(pointer:fine)]:min-h-8"
                >
                  {allOpen ? 'Tutup semua' : 'Buka semua'}
                </button>
              ) : null}
            </div>

            {matches.length === 0 ? (
              <div className="py-10 text-center text-sm text-fg-muted">
                <p>Tidak ada yang cocok.</p>
                {!searchSoap && tokens.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => toggleScope('soap')}
                    className="mt-2 min-h-tap text-xs text-accent"
                  >
                    Cari juga di isi SOAP
                  </button>
                ) : null}
              </div>
            ) : (
              groups.map((group, position) => {
                const monthOpen = isMonthOpen(folds, group.key, position, narrowing);
                const monthBody = `arsip-${group.key}`;
                return (
                  <section key={group.key} className="mt-3">
                    <h2>
                      <button
                        type="button"
                        aria-expanded={monthOpen}
                        aria-controls={monthBody}
                        disabled={narrowing}
                        onClick={() => toggleFold(group.key, monthOpen)}
                        className="flex min-h-tap w-full items-center gap-2 rounded-lg px-1 text-left hover:bg-bg-subtle disabled:hover:bg-transparent [@media(pointer:fine)]:min-h-9"
                      >
                        <Chevron open={monthOpen} />
                        <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
                          {group.label}
                        </span>
                        <span className="rounded-full bg-bg-subtle px-1.5 text-[11px] font-medium text-fg-muted">
                          {group.patients.length}
                        </span>
                        <span aria-hidden="true" className="h-px flex-1 bg-border" />
                        {!monthOpen ? (
                          <span className="shrink-0 text-[11px] text-fg-faint">
                            {group.weeks.length} minggu
                          </span>
                        ) : null}
                      </button>
                    </h2>
                    {monthOpen ? (
                      <div id={monthBody}>
                        {group.weeks.map((week) => {
                          const weekOpen = isWeekOpen(folds, week.key, narrowing);
                          const weekBody = `arsip-${week.key}`;
                          return (
                            <div key={week.key} className="mt-1">
                              <h3>
                                <button
                                  type="button"
                                  aria-expanded={weekOpen}
                                  aria-controls={weekBody}
                                  disabled={narrowing}
                                  onClick={() => toggleFold(week.key, weekOpen)}
                                  className="flex min-h-tap w-full items-center gap-2 rounded-lg pl-5 pr-1 text-left text-[11px] font-medium text-fg-muted hover:bg-bg-subtle disabled:hover:bg-transparent [@media(pointer:fine)]:min-h-8"
                                >
                                  <Chevron open={weekOpen} small />
                                  <span>{week.label}</span>
                                  <span className="text-fg-faint">{week.patients.length}</span>
                                </button>
                              </h3>
                              {weekOpen ? (
                                <ul
                                  id={weekBody}
                                  className="mb-1 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface"
                                >
                                  {week.patients.map((patient) => (
                                    <li key={patient.id}>
                                      <ArchiveRow
                                        patient={patient}
                                        showInitialsOnly={showInitialsOnly}
                                        tokens={tokens}
                                        snippet={snippets.get(patient.id) ?? null}
                                      />
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </section>
                );
              })
            )}
          </>
        )}
      </div>

      {picking ? (
        <Sheet
          open
          onOpenChange={(open) => {
            if (!open) setPicking(null);
          }}
          title={`Filter ${FACET_TITLES[picking]}`}
        >
          <div className="max-h-[60vh] space-y-1 overflow-y-auto p-2">
            <FacetOption
              label="Semua"
              count={patients.length}
              selected={filters[picking] === null}
              onPick={() => {
                setFilters((current) => ({ ...current, [picking]: null }));
                setPicking(null);
              }}
            />
            {facetOptions(picking).map((option) => (
              <FacetOption
                key={option.value}
                label={
                  picking === 'dpjp'
                    ? `${option.label} · ${dpjpById(option.value)?.name ?? ''}`
                    : option.label
                }
                count={option.count}
                selected={filters[picking] === option.value}
                onPick={() => {
                  setFilters((current) => ({ ...current, [picking]: option.value }));
                  setPicking(null);
                }}
              />
            ))}
          </div>
        </Sheet>
      ) : null}
    </AppShell>
  );
}

function FacetOption({
  label,
  count,
  selected,
  onPick,
}: {
  label: string;
  count: number;
  selected: boolean;
  onPick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className={[
        'flex min-h-tap w-full items-center gap-3 rounded-lg px-3 text-left text-sm',
        selected ? 'bg-bg-subtle font-semibold text-accent' : 'hover:bg-bg-subtle',
      ].join(' ')}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-xs text-fg-faint">{count}</span>
    </button>
  );
}

/**
 * One archived patient. Links to the same patient page as an active one: the
 * record is not frozen, and discharge summaries are written after discharge.
 */
function ArchiveRow({
  patient,
  showInitialsOnly,
  tokens,
  snippet,
}: {
  patient: Patient;
  showInitialsOnly: boolean;
  tokens: readonly string[];
  snippet: string | null;
}): JSX.Element {
  const dpjp = patient.dpjpId ? dpjpById(patient.dpjpId) : undefined;
  const reason = patient.archive?.reason;
  const location = formatLocation(patient);
  const facts = [patient.age !== undefined ? `${patient.age} th` : '', patient.sex ?? '']
    .filter(Boolean)
    .join(' · ');

  return (
    <Link
      to={`/p/${patient.id}`}
      className="block px-3 py-2.5 transition-colors hover:bg-bg-subtle"
    >
      <span className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          <Highlight text={cardTitle(patient, showInitialsOnly, false)} tokens={tokens} />
          {facts ? <span className="ml-1.5 text-xs font-normal text-fg-faint">{facts}</span> : null}
        </span>
        <span className="shrink-0 text-[11px] text-fg-faint">
          {formatShortDate(archiveDate(patient))}
        </span>
      </span>

      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
        {patient.mrn && !showInitialsOnly ? (
          <span className="font-mono">
            <Highlight text={`RM ${patient.mrn}`} tokens={tokens} />
          </span>
        ) : null}
        {location ? <span className="min-w-0 truncate">{location}</span> : null}
        {dpjp ? (
          <span
            title={`DPJP: ${dpjp.name}`}
            className="rounded-full bg-bg-subtle px-1.5 text-[10px] font-semibold"
          >
            {dpjp.initials}
          </span>
        ) : null}
        {reason && reason !== 'pulang' ? (
          <span
            className={[
              'rounded-sm border px-1 text-[10px] font-bold uppercase tracking-wide',
              reason === 'meninggal' ? 'border-danger text-danger' : 'border-border-strong',
            ].join(' ')}
          >
            {ARCHIVE_REASON_LABELS[reason]}
          </span>
        ) : null}
      </span>

      {/* The note written at discharge: why they left, what to follow up. On
          the row itself, because it is usually the reason to find them. */}
      {patient.archive?.note?.trim() ? (
        <span className="mt-1.5 block whitespace-pre-line border-l-2 border-[var(--warn-strong)] pl-2 text-xs leading-snug text-fg [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden">
          <Highlight text={privateText(patient.archive.note.trim(), patient, showInitialsOnly)} tokens={tokens} />
        </span>
      ) : null}

      {snippet ? (
        <span className="mt-1 block text-[11px] italic leading-snug text-fg-muted">
          <Highlight text={privateText(snippet, patient, showInitialsOnly)} tokens={tokens} />
        </span>
      ) : null}
    </Link>
  );
}

/**
 * The trash: an icon with a count, and a sheet to restore or empty it.
 * Only present when something is in it; an empty bin is not a control.
 */
function TrashButton({
  trashed,
  showInitialsOnly,
}: {
  trashed: readonly Patient[];
  showInitialsOnly: boolean;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [emptying, setEmptying] = useState(false);

  /**
   * Destroy every trashed patient, for real. Sequential: each purge is many
   * batched deletes, and firing them all at once on ward wifi is how half of
   * them fail and leave patients partly deleted.
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
      setOpen(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Sampah, ${trashed.length} pasien`}
        className="relative flex min-h-tap min-w-tap shrink-0 items-center justify-center rounded-lg border border-border text-fg-muted"
      >
        <IconTrash width={18} height={18} />
        <span className="absolute -right-1 -top-1 rounded-full bg-accent px-1.5 text-[10px] font-medium text-white">
          {trashed.length}
        </span>
      </button>

      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) setConfirmEmpty(false);
          setOpen(next);
        }}
        title="Sampah"
      >
        <div className="p-4">
          <p className="text-xs leading-relaxed text-fg-muted">
            Pasien di sini tidak muncul di mana pun. Pulihkan untuk mengembalikannya ke daftar
            aktif, atau kosongkan untuk menghapusnya permanen.
          </p>

          <ul className="mt-3 space-y-1">
            {trashed.map((patient) => (
              <li key={patient.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{cardTitle(patient, showInitialsOnly)}</span>
                {/* Back to ACTIVE, not the archive: restoring undoes a delete,
                    usually one made from the board. */}
                <button
                  type="button"
                  onClick={() => void setPatientStatus(patient.id, 'active')}
                  className="min-h-tap shrink-0 rounded-lg px-2 text-xs text-accent"
                >
                  Pulihkan
                </button>
              </li>
            ))}
          </ul>

          {confirmEmpty ? (
            <div className="mt-4 rounded-lg border border-danger p-3">
              <p className="text-xs leading-relaxed text-fg-muted">
                {trashed.length} pasien beserta seluruh SOAP dan riwayat perubahannya akan dihapus
                permanen dari server. Tidak bisa dikembalikan.
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
    </>
  );
}

const FOLDS_KEY = 'plano.archiveFolds';

/** The months and weeks this device has opened or closed (see `domain/archive`). */
function useArchiveFolds(): [ArchiveFolds, (next: ArchiveFolds) => void] {
  const [folds, setState] = useState<ArchiveFolds>(() => {
    try {
      const raw = localStorage.getItem(FOLDS_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? (parsed as ArchiveFolds) : {};
    } catch {
      return {};
    }
  });
  const set = useCallback((next: ArchiveFolds) => {
    setState(next);
    try {
      localStorage.setItem(FOLDS_KEY, JSON.stringify(next));
    } catch {
      // Blocked storage: the choice lasts until the page is left.
    }
  }, []);
  return [folds, set];
}

function Chevron({ open, small = false }: { open: boolean; small?: boolean }): JSX.Element {
  const size = small ? 12 : 14;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={['shrink-0 text-fg-faint transition-transform', open ? 'rotate-90' : ''].join(' ')}
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
