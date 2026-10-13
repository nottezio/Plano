import { useState } from 'react';

import { Button, INPUT } from '@/components/common/ui';
import { writeMarks } from '@/data/repositories/floors.repo';
import { MARK_COLORS, markCss, newMarkId, type FloorMark, type MarkColor } from '@/domain/floorList/marks';

const COLORS = Object.keys(MARK_COLORS) as MarkColor[];

/**
 * The floor's own colours (13.7): a label and a colour from the palette.
 * Set on a patient in the List tab, like red/green. Deleting a mark here
 * takes it off every patient (they show no colour; nothing else changes).
 */
export function MarksField({ floorId, marks, editable }: { floorId: string; marks: readonly FloorMark[]; editable: boolean }): JSX.Element {
  const [label, setLabel] = useState('');
  const [color, setColor] = useState<MarkColor>(COLORS.find((c) => !marks.some((m) => m.color === c)) ?? 'blue');
  const save = (next: readonly FloorMark[]): void => void writeMarks(floorId, next);
  const add = (): void => {
    const text = label.trim();
    if (!text || marks.some((m) => m.label.toLowerCase() === text.toLowerCase())) return;
    const next = [...marks, { id: newMarkId(marks), label: text, color }];
    save(next);
    setLabel('');
    setColor(COLORS.find((c) => !next.some((m) => m.color === c)) ?? color);
  };

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        <li className="flex items-center gap-2 text-xs">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: 'var(--note-red)' }} />
          <span className="flex-1">H-1 (merah) · tetap</span>
        </li>
        <li className="flex items-center gap-2 text-xs">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: 'var(--note-green)' }} />
          <span className="flex-1">Pulang hari ini (hijau) · tetap</span>
        </li>
        {marks.map((mark) => (
          <li key={mark.id} className="flex items-center gap-1.5 text-xs">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: markCss(mark.color) }} />
            {editable ? (
              <>
                <input
                  key={mark.label}
                  defaultValue={mark.label}
                  aria-label={`Nama warna ${mark.label}`}
                  onBlur={(e) => {
                    const text = e.target.value.trim();
                    if (text && text !== mark.label) save(marks.map((m) => (m.id === mark.id ? { ...m, label: text } : m)));
                  }}
                  className={`${INPUT} !w-0 min-w-0 flex-1 text-xs sm:!w-48 sm:flex-none`}
                />
                <select
                  aria-label={`Warna ${mark.label}`}
                  value={mark.color}
                  onChange={(e) => save(marks.map((m) => (m.id === mark.id ? { ...m, color: e.target.value as MarkColor } : m)))}
                  className={`${INPUT} !w-28 shrink-0 text-xs`}
                >
                  {COLORS.map((c) => (
                    <option key={c} value={c}>
                      {MARK_COLORS[c].name}
                    </option>
                  ))}
                </select>
                <Button size="sm" variant="ghost" aria-label={`Hapus warna ${mark.label}`} onClick={() => save(marks.filter((m) => m.id !== mark.id))}>
                  Hapus
                </Button>
              </>
            ) : (
              <span style={{ color: markCss(mark.color) }} className="font-semibold">
                {mark.label}
              </span>
            )}
          </li>
        ))}
      </ul>
      {editable ? (
        <div className="flex items-center gap-1.5">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Nama, mis. Pre-op, Tunggu ICU"
            aria-label="Nama warna baru"
            className={`${INPUT} !w-0 min-w-0 flex-1 text-xs sm:!w-48 sm:flex-none`}
          />
          <select aria-label="Warna baru" value={color} onChange={(e) => setColor(e.target.value as MarkColor)} className={`${INPUT} !w-28 shrink-0 text-xs`}>
            {COLORS.map((c) => (
              <option key={c} value={c}>
                {MARK_COLORS[c].name}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={add} disabled={!label.trim()} aria-label="Tambah warna">
            <span className="mr-1 inline-block h-3 w-3 rounded-full align-middle" style={{ background: markCss(color) }} aria-hidden="true" />+
          </Button>
        </div>
      ) : null}
    </div>
  );
}
