import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AppShell } from '@/components/common/AppShell';
import { FilterBar } from '@/components/board/FilterBar';
import { PatientCard } from '@/components/board/PatientCard';
import { QuickChecklistSheet } from '@/components/board/QuickChecklistSheet';
import { IconSearch } from '@/components/common/Icons';
import { useClinicalToday } from '@/hooks/useClinicalToday';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { createBlankPatient } from '@/data/repositories/patients.repo';
import { usePatients } from '@/hooks/usePatients';
import {
  availableLabels,
  availableWards,
  buildCard,
  filterPatients,
  hasActiveFilters,
  groupLabel,
  orderPatients,
  sortPatients,
  EMPTY_FILTERS,
  type BoardFilters,
  type BoardOrder,
} from '@/domain/board';
import { pendingFilters } from '@/domain/checklist';
import { useSession } from '@/store/useSession';

export default function BoardPage(): JSX.Element {
  const today = useClinicalToday();
  const navigate = useNavigate();
  const uid = useSession((state) => state.user?.uid ?? null);

  /**
   * SPEC 1.2 rule 5 — nothing between the tap and a cursor in a blank note.
   * The record is created locally and navigated to immediately; the write is
   * never awaited, so this works with no signal.
   */
  const createAndOpen = useCallback(() => {
    if (!uid) return;
    const { id, written } = createBlankPatient(uid, today);
    void written.catch((error: unknown) => console.error('[board] create rejected', error));
    navigate(`/p/${id}/${today}`);
  }, [uid, today, navigate]);
  const settings = useSession((state) => state.settings());
  const { patients, loading, error } = usePatients('active');

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<BoardFilters>(EMPTY_FILTERS);
  const [quickPatientId, setQuickPatientId] = useState<string | null>(null);

  /**
   * Board order, remembered across sessions.
   *
   * `location` walks the ward the way the denah is laid out, which is the order
   * a round is actually done in. Stored in localStorage rather than settings
   * because it is a per-device view preference, not a fact about the user —
   * the phone in your pocket and the laptop at the desk are used differently.
   */
  const [order, setOrder] = useState<BoardOrder>(() => {
    try {
      const stored = localStorage.getItem('visite.boardOrder');
      return stored === 'location' || stored === 'dpjp' ? stored : 'recent';
    } catch {
      return 'recent';
    }
  });

  const changeOrder = (next: BoardOrder): void => {
    setOrder(next);
    try {
      localStorage.setItem('visite.boardOrder', next);
    } catch (error) {
      console.warn('[board] order preference not saved', error);
    }
  };

  const debouncedQuery = useDebouncedValue(query, 150);

  /**
   * The archive is searched too, but only while searching.
   *
   * A patient discharged last week is exactly who you look for by name, and
   * "not found" on the board is indistinguishable from "does not exist" —
   * which sends someone to create a duplicate record. The second listener
   * attaches only when there is a query, so an idle board still costs one.
   */
  const searching = debouncedQuery.trim().length > 0;
  const { patients: archived } = usePatients('archived', searching);

  const items = settings.checklistItems;

  const cards = useMemo(() => {
    const matched = filterPatients(
      patients,
      { ...filters, query: debouncedQuery },
      items,
      today,
    );
    return orderPatients(matched, order).map((patient) =>
      buildCard(patient, items, today, settings.privacy.boardShowInitialsOnly),
    );
  }, [
    patients,
    filters,
    debouncedQuery,
    items,
    today,
    order,
    settings.privacy.boardShowInitialsOnly,
  ]);

  /**
   * Cards grouped under their heading, in the order they already sit in.
   *
   * Grouping is a render concern, not a sort: the sort put them in walking
   * order, and this only inserts a heading each time the room changes. Doing it
   * the other way round — grouping first, then sorting groups — is how a board
   * ends up with Kamar 410 before Kamar 401.
   */
  const groups = useMemo(() => {
    if (order === 'recent') return [{ label: '', cards }];

    const result: Array<{ label: string; cards: typeof cards }> = [];
    for (const card of cards) {
      const label = card.patient.pinned ? 'Disematkan' : groupLabel(card.patient, order);
      const last = result[result.length - 1];
      if (last && last.label === label) last.cards.push(card);
      else result.push({ label, cards: [card] });
    }
    return result;
  }, [cards, order]);

  const archivedCards = useMemo(() => {
    if (!searching) return [];
    return sortPatients(
      filterPatients(archived, { ...filters, query: debouncedQuery }, items, today),
    ).map((patient) => buildCard(patient, items, today, settings.privacy.boardShowInitialsOnly));
  }, [
    searching,
    archived,
    filters,
    debouncedQuery,
    items,
    today,
    settings.privacy.boardShowInitialsOnly,
  ]);

  const quickPatient = patients.find((patient) => patient.id === quickPatientId) ?? null;
  const filtering = hasActiveFilters({ ...filters, query: debouncedQuery });

  return (
    <AppShell title="Aktif">
      <div className="flex items-center gap-2 px-4 pb-2 pt-1 lg:pt-3">
        <label className="flex min-h-tap flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-3 lg:max-w-md">
          <IconSearch className="shrink-0 text-fg-faint" width={18} height={18} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nama, RM, bed, diagnosis…"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
          />
        </label>

        {/* From tablet up the primary action belongs in the content flow, not
            floating over the bottom-right corner of a desktop window. */}
        <button
          type="button"
          onClick={createAndOpen}
          className="hidden min-h-tap shrink-0 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-white sm:flex lg:ml-auto"
        >
          <span aria-hidden="true" className="text-base leading-none">+</span>
          Pasien baru
        </button>
      </div>

      {/* Walking order. Labels say what the order IS, not what it sorts by:
          "Sesuai denah" is the thing a resident recognises. */}
      <div className="flex gap-2 px-4 pb-2">
        {(
          [
            ['recent', 'Terbaru'],
            ['location', 'Sesuai denah'],
            ['dpjp', 'Per DPJP'],
          ] as Array<[BoardOrder, string]>
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={order === value}
            onClick={() => changeOrder(value)}
            className={[
              'min-h-tap rounded-full border px-3 text-xs',
              order === value
                ? 'border-accent bg-bg-subtle font-medium text-accent'
                : 'border-border text-fg-muted',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filters hidden for now. The row of "Belum …" chips ate
          the top of the board and pushed the cards below the fold before there
          were enough patients for filtering to earn that space. The state and
          the component are untouched — restoring it is deleting this comment
          and the `false &&`. */}
      {false && (
        <FilterBar
          wards={availableWards(patients)}
          labels={availableLabels(patients)}
          pending={pendingFilters(items)}
          filters={filters}
          onChange={setFilters}
        />
      )}

      {error ? (
        <p role="alert" className="px-4 py-6 text-center text-sm text-danger">
          {error}
        </p>
      ) : loading ? (
        <p className="px-4 py-10 text-center text-sm text-fg-muted">Memuat…</p>
      ) : cards.length === 0 && archivedCards.length === 0 ? (
        <EmptyState filtering={filtering} onCreate={createAndOpen} />
      ) : (
        <>
          {/* Headed only while searching. On an idle board the heading would be
              noise — there is nothing to distinguish it from. */}
          {searching && cards.length > 0 ? (
            <SectionHeading label={`Pasien aktif (${cards.length})`} />
          ) : null}

          {cards.length > 0 ? (
            groups.map((group) => (
              <section key={group.label || 'all'}>
                {group.label ? <SectionHeading label={group.label} /> : null}
                {/* CSS multi-column masonry: no measurement pass, no layout
                    library, and it reflows correctly when a card grows as the
                    note is typed. */}
                <div className="columns-1 gap-3 px-4 pt-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5">
                  {group.cards.map((card) => (
                    <PatientCard
                      key={card.patient.id}
                      card={card}
                      onLongPress={setQuickPatientId}
                    />
                  ))}
                </div>
              </section>
            ))
          ) : searching ? (
            <p className="px-4 py-3 text-sm text-fg-muted">
              Tidak ada pasien aktif yang cocok.
            </p>
          ) : null}

          {searching && archivedCards.length > 0 ? (
            <>
              <SectionHeading label={`Arsip (${archivedCards.length})`} />
              <div className="columns-1 gap-3 px-4 pt-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5">
                {archivedCards.map((card) => (
                  <PatientCard
                    key={card.patient.id}
                    card={card}
                    onLongPress={setQuickPatientId}
                  />
                ))}
              </div>
            </>
          ) : null}
        </>
      )}

      <button
        type="button"
        onClick={createAndOpen}
        aria-label="Pasien baru"
        // Phone only — the tablet/desktop equivalent lives beside the search box.
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+76px)] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-white shadow-lg sm:hidden"
      >
        +
      </button>

      <QuickChecklistSheet
        patient={quickPatient}
        items={items}
        today={today}
        onOpenChange={(open) => {
          if (!open) setQuickPatientId(null);
        }}
      />
    </AppShell>
  );
}

function SectionHeading({ label }: { label: string }): JSX.Element {
  return (
    <h2 className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-fg-faint">
      {label}
    </h2>
  );
}

function EmptyState({
  filtering,
  onCreate,
}: {
  filtering: boolean;
  onCreate: () => void;
}): JSX.Element {
  return (
    // Left-aligned and near the top from lg: a message centred in a 900 px
    // viewport reads as an error page rather than an empty list.
    <div className="px-6 py-14 text-center lg:px-4 lg:py-10 lg:text-left">
      <p className="text-sm text-fg-muted">
        {filtering ? 'Tidak ada pasien yang cocok.' : 'Belum ada pasien aktif.'}
      </p>
      {!filtering ? (
        <button
          type="button"
          onClick={onCreate}
          className="mt-3 min-h-tap rounded-lg border border-border px-4 text-sm text-accent"
        >
          Tambah pasien pertama
        </button>
      ) : null}
    </div>
  );
}
