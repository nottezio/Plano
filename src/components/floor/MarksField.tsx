import { useState } from 'react';

import { Button, INPUT } from '@/components/common/ui';
import { writeMarks } from '@/data/repositories/floors.repo';
import { dpjpById } from '@/domain/dpjp';
import { LIST_DPJP_ORDER, PEDIATRI_DPJP_IDS } from '@/domain/floorList/build';
import { AUTO_LABEL, MARK_COLORS, markCss, newMarkId, type FloorMark, type MarkAuto, type MarkColor } from '@/domain/floorList/marks';

const COLORS = Object.keys(MARK_COLORS) as MarkColor[];
const RULE_DPJPS = [...LIST_DPJP_ORDER, ...PEDIATRI_DPJP_IDS];
const code = (id: string): string => dpjpById(id)?.initials ?? id.toUpperCase();

function withAuto(mark: FloorMark, auto: MarkAuto | undefined): FloorMark {
  const { auto: _old, ...rest } = mark;
  return auto ? { ...rest, auto } : rest;
}

function describeAuto(auto: MarkAuto): string {
  return auto.kind === 'dpjp' ? `pasien ${auto.ids.map(code).join(', ')}` : AUTO_LABEL[auto.kind];
}

/**
 * When a mark goes on by itself (13.10): never, every new patient, the
 * patients of chosen DPJPs (e.g. NP; YP and AAU), KJS BTKV, consults, those
 * held by a division, or those still without a junior.
 */
function AutoRule({ mark, onChange }: { mark: FloorMark; onChange: (auto: MarkAuto | undefined) => void }): JSX.Element {
  const [picking, setPicking] = useState(false);
  const kind = mark.auto?.kind ?? (picking ? 'dpjp' : '');
  const ids = mark.auto?.kind === 'dpjp' ? mark.auto.ids : [];
  return (
    <div className="flex flex-wrap items-center gap-1.5 pl-5">
      <select
        aria-label={`Otomatis untuk ${mark.label}`}
        value={kind}
        onChange={(e) => {
          const next = e.target.value as MarkAuto['kind'] | '';
          // Choosing "DPJP tertentu" waits for the first DPJP chip.
          onChange(next === '' || next === 'dpjp' ? (next === 'dpjp' && ids.length > 0 ? { kind: 'dpjp', ids } : undefined) : { kind: next });
          setPicking(next === 'dpjp');
        }}
        className={`${INPUT} !w-auto max-w-full text-xs`}
      >
        <option value="">Otomatis: tidak</option>
        {(Object.keys(AUTO_LABEL) as Array<MarkAuto['kind']>).map((k) => (
          <option key={k} value={k}>
            Otomatis: {AUTO_LABEL[k]}
          </option>
        ))}
      </select>
      {kind === 'dpjp'
        ? RULE_DPJPS.map((id) => {
            const on = ids.includes(id);
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  const next = on ? ids.filter((x) => x !== id) : [...ids, id];
                  onChange(next.length > 0 ? { kind: 'dpjp', ids: next } : undefined);
                }}
                className={`min-h-8 rounded-full border px-2 text-[11px] font-semibold ${on ? 'border-accent bg-accent text-white' : 'border-border text-fg-muted'}`}
              >
                {code(id)}
              </button>
            );
          })
        : null}
    </div>
  );
}

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
          <li key={mark.id} className="space-y-1 text-xs">
            <div className="flex items-center gap-1.5">
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
            </div>
            {editable ? <AutoRule mark={mark} onChange={(auto) => save(marks.map((m) => (m.id === mark.id ? withAuto(m, auto) : m)))} /> : mark.auto ? (
              <p className="pl-5 text-[11px] text-fg-muted">Otomatis: {describeAuto(mark.auto)}</p>
            ) : null}
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
