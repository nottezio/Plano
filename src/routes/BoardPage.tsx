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
  sortPatients,
  EMPTY_FILTERS,
  type BoardFilters,
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

  const debouncedQuery = useDebouncedValue(query, 150);
  const items = settings.checklistItems;

  const cards = useMemo(() => {
    const matched = filterPatients(
      patients,
      { ...filters, query: debouncedQuery },
      items,
      today,
    );
    return sortPatients(matched).map((patient) =>
      buildCard(patient, items, today, settings.privacy.boardShowInitialsOnly),
    );
  }, [patients, filters, debouncedQuery, items, today, settings.privacy.boardShowInitialsOnly]);

  const quickPatient = patients.find((patient) => patient.id === quickPatientId) ?? null;
  const filtering = hasActiveFilters({ ...filters, query: debouncedQuery });

  return (
    <AppShell title="Aktif">
      <div className="px-4 pb-2 pt-1">
        <label className="flex min-h-tap items-center gap-2 rounded-lg border border-border bg-surface px-3">
          <IconSearch className="shrink-0 text-fg-faint" width={18} height={18} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nama, RM, bed, diagnosis…"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
          />
        </label>
      </div>

      <FilterBar
        wards={availableWards(patients)}
        labels={availableLabels(patients)}
        pending={pendingFilters(items)}
        filters={filters}
        onChange={setFilters}
      />

      {error ? (
        <p role="alert" className="px-4 py-6 text-center text-sm text-danger">
          {error}
        </p>
      ) : loading ? (
        <p className="px-4 py-10 text-center text-sm text-fg-muted">Memuat…</p>
      ) : cards.length === 0 ? (
        <EmptyState filtering={filtering} onCreate={createAndOpen} />
      ) : (
        // CSS multi-column masonry: no measurement pass, no layout library,
        // and it reflows correctly when a card grows as the note is typed.
        <div className="columns-1 gap-3 px-4 pt-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5">
          {cards.map((card) => (
            <PatientCard key={card.patient.id} card={card} onLongPress={setQuickPatientId} />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={createAndOpen}
        aria-label="Pasien baru"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+76px)] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-white shadow-lg sm:bottom-6"
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

function EmptyState({
  filtering,
  onCreate,
}: {
  filtering: boolean;
  onCreate: () => void;
}): JSX.Element {
  return (
    <div className="px-6 py-14 text-center">
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
