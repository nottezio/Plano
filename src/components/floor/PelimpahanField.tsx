import { useState } from 'react';

import { DateField } from '@/components/common/DateField';
import { Button, INPUT } from '@/components/common/ui';
import { formatDmy } from '@/domain/dateDmy';
import { dpjpTitle, LIST_DPJP_ORDER } from '@/domain/floorList/build';
import { localIso } from '@/domain/floorList/chiefHandover';
import { parsePelimpahan, pelimpahanEntry } from '@/domain/floorList/floor';

/**
 * Pelimpahan of a day (13 Nov 2026, Avi): the DPJP is on leave and another one
 * covers. Pick the day, who is away and who covers; that day the code on every
 * line of the list and the denah reads "AFG->ZD". A small write on the list
 * document, like the tanggal merah. Past days stay stored, unseen.
 */
export function PelimpahanField({
  entries,
  editable,
  onAdd,
  onRemove,
}: {
  entries: readonly string[];
  editable: boolean;
  onAdd: (entry: string) => void;
  onRemove: (entry: string) => void;
}): JSX.Element {
  const today = localIso(new Date());
  const [date, setDate] = useState(today);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const upcoming = entries
    .map((entry) => ({ entry, parsed: parsePelimpahan(entry) }))
    .filter((row): row is { entry: string; parsed: NonNullable<typeof row.parsed> } => row.parsed !== null && row.parsed.date >= today)
    .sort((a, b) => a.entry.localeCompare(b.entry));
  const ready = Boolean(date && from && to && from !== to);
  const options = (
    <>
      <option value="">Pilih DPJP</option>
      {LIST_DPJP_ORDER.map((id) => (
        <option key={id} value={id}>
          {dpjpTitle(id)}
        </option>
      ))}
    </>
  );
  return (
    <div className="space-y-2">
      {editable ? (
        <div className="flex flex-wrap items-end gap-2">
          <DateField value={date} onChange={setDate} min={today} ariaLabel="Tanggal pelimpahan" className="max-w-[10rem]" />
          <select value={from} onChange={(e) => setFrom(e.target.value)} aria-label="DPJP yang cuti" className={`${INPUT} !w-32 text-xs`}>
            {options}
          </select>
          <span aria-hidden="true" className="pb-2 text-fg-muted">
            →
          </span>
          <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="DPJP pengganti" className={`${INPUT} !w-32 text-xs`}>
            {options}
          </select>
          <Button
            size="sm"
            disabled={!ready}
            onClick={() => {
              onAdd(pelimpahanEntry(date, from, to));
              setFrom('');
              setTo('');
            }}
          >
            Tambah
          </Button>
        </div>
      ) : null}
      {upcoming.length === 0 ? <p className="text-xs text-fg-muted">Belum ada pelimpahan.</p> : null}
      <ul className="space-y-1 text-sm">
        {upcoming.map(({ entry, parsed }) => (
          <li key={entry} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate tabular-nums">
              {formatDmy(parsed.date)} · {dpjpTitle(parsed.from)} → {dpjpTitle(parsed.to)}
            </span>
            {editable ? (
              <Button size="sm" variant="ghost" aria-label={`Hapus pelimpahan ${formatDmy(parsed.date)}`} onClick={() => onRemove(entry)}>
                Hapus
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
