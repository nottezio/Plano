import type { PendingFilter } from '@/domain/checklist';
import { hasActiveFilters, EMPTY_FILTERS, type BoardFilters } from '@/domain/board';

function Chip({
  active,
  onClick,
  children,
  colorToken,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  colorToken?: string;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      {...(colorToken ? { 'data-color-token': colorToken } : {})}
      className={[
        'min-h-tap shrink-0 rounded-full border px-3 text-xs',
        active
          ? 'border-transparent bg-token text-token-fg font-medium'
          : 'border-border text-fg-muted',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

/**
 * SPEC F2 — ward chips, label chips, and one "belum …" chip per checklist item.
 * The last set is generated from `checklistItems`, so adding a ninth item in
 * Settings produces a ninth chip with no code change.
 */
export function FilterBar({
  wards,
  labels,
  pending,
  filters,
  onChange,
}: {
  wards: string[];
  labels: string[];
  pending: PendingFilter[];
  filters: BoardFilters;
  onChange: (filters: BoardFilters) => void;
}): JSX.Element {
  const toggle = (key: 'wards' | 'labels' | 'pendingItemIds', value: string): void => {
    const current = filters[key];
    onChange({
      ...filters,
      [key]: current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    });
  };

  const active = hasActiveFilters({ ...filters, query: '' });

  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {active ? (
        <button
          type="button"
          onClick={() => onChange({ ...EMPTY_FILTERS, query: filters.query })}
          className="shrink-0 rounded-full border border-border-strong px-3 py-1.5 text-xs font-medium text-fg"
        >
          Hapus filter
        </button>
      ) : null}
      {pending.map((item) => (
        <Chip
          key={item.itemId}
          colorToken={item.colorToken}
          active={filters.pendingItemIds.includes(item.itemId)}
          onClick={() => toggle('pendingItemIds', item.itemId)}
        >
          {item.label}
        </Chip>
      ))}
      {wards.map((ward) => (
        <Chip
          key={ward}
          active={filters.wards.includes(ward)}
          onClick={() => toggle('wards', ward)}
        >
          {ward}
        </Chip>
      ))}
      {labels.map((label) => (
        <Chip
          key={label}
          active={filters.labels.includes(label)}
          onClick={() => toggle('labels', label)}
        >
          {label}
        </Chip>
      ))}
    </div>
  );
}
