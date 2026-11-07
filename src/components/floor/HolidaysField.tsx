import { DateField } from '@/components/common/DateField';
import { Button } from '@/components/common/ui';
import { formatDmy } from '@/domain/dateDmy';
import { localIso } from '@/domain/floorList/chiefHandover';

/**
 * The floor's tanggal merah (7 Nov 2026): picking a date adds it at once, and
 * the field empties for the next one. Past dates stay stored, unseen: they only
 * ever matter to the handover cycle in the days right after them.
 */
export function HolidaysField({
  holidays,
  editable,
  onAdd,
  onRemove,
}: {
  holidays: readonly string[];
  editable: boolean;
  onAdd: (iso: string) => void;
  onRemove: (iso: string) => void;
}): JSX.Element {
  const today = localIso(new Date());
  const upcoming = holidays.filter((iso) => iso >= today).sort();
  return (
    <div className="space-y-2">
      {editable ? <DateField value="" onChange={onAdd} min={today} ariaLabel="Tambah tanggal merah" className="max-w-xs" /> : null}
      {upcoming.length === 0 ? <p className="text-xs text-fg-muted">Belum ada tanggal merah.</p> : null}
      <ul className="space-y-1 text-sm">
        {upcoming.map((iso) => (
          <li key={iso} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate tabular-nums">
              {new Date(`${iso}T00:00`).toLocaleDateString('id-ID', { weekday: 'long' })}, {formatDmy(iso)}
            </span>
            {editable ? (
              <Button size="sm" variant="ghost" aria-label={`Hapus tanggal merah ${formatDmy(iso)}`} onClick={() => onRemove(iso)}>
                Hapus
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
