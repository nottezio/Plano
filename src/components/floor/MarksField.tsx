import { useState } from 'react';

import { IconChevronRight } from '@/components/common/Icons';
import { Button, INPUT } from '@/components/common/ui';
import { writeMarks } from '@/data/repositories/floors.repo';
import { dpjpById } from '@/domain/dpjp';
import { LIST_DPJP_ORDER, PEDIATRI_DPJP_IDS } from '@/domain/floorList/build';
import { AUTO_LABEL, MARK_COLORS, markCss, newMarkId, type FloorMark, type MarkAuto, type MarkColor } from '@/domain/floorList/marks';
import { MarkColorPicker } from './MarkColorPicker';

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

/** The tag's rules in one line, for its row: "Otomatis: pasien NP · Hanya di layar · Tidak di-follow up". */
function markNotes(mark: FloorMark): string {
  return [
    mark.auto ? `Otomatis: ${describeAuto(mark.auto)}` : '',
    mark.auto?.kind === 'baru' || mark.print === false ? 'Hanya di layar' : '',
    mark.noFollowUp ? 'Tidak di-follow up' : '',
  ]
    .filter(Boolean)
    .join(' · ');
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
    <div className="space-y-1.5">
      <select
        aria-label={`Otomatis untuk ${mark.label}`}
        value={kind}
        onChange={(e) => {
          const next = e.target.value as MarkAuto['kind'] | '';
          // Choosing "DPJP tertentu" waits for the first DPJP chip.
          onChange(next === '' || next === 'dpjp' ? (next === 'dpjp' && ids.length > 0 ? { kind: 'dpjp', ids } : undefined) : { kind: next });
          setPicking(next === 'dpjp');
        }}
        className={`${INPUT} text-xs`}
      >
        <option value="">Otomatis: tidak</option>
        {/* "baru" is retired into the Pasien baru badge: listed only on a mark that still has it. */}
        {(Object.keys(AUTO_LABEL) as Array<MarkAuto['kind']>).filter((k) => k !== 'baru' || kind === 'baru').map((k) => (
          <option key={k} value={k}>
            Otomatis: {AUTO_LABEL[k]}
          </option>
        ))}
      </select>
      {kind === 'dpjp' ? (
        <div className="flex flex-wrap gap-1.5">
          {RULE_DPJPS.map((id) => {
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
                className={`min-h-8 rounded-full border px-2 text-xs font-semibold ${on ? 'border-accent bg-accent text-on-accent' : 'border-border text-fg-muted'}`}
              >
                {code(id)}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The floor's own colours (13.7): a label and a colour from the palette.
 * Set on a patient in the List tab, like red/green. Deleting a mark here
 * takes it off every patient (they show no colour; nothing else changes).
 *
 * One row per tag with its rules in one line (9 Nov 2026, Avi: a card per
 * tag, each with its DPJP chips open, ran the list far down Setelan). Its
 * editor opens under the row, one tag at a time.
 */
export function MarksField({ floorId, marks, editable }: { floorId: string; marks: readonly FloorMark[]; editable: boolean }): JSX.Element {
  const [label, setLabel] = useState('');
  const [color, setColor] = useState<MarkColor>(COLORS.find((c) => !marks.some((m) => m.color === c)) ?? 'blue');
  // The tag whose editor is open.
  const [openId, setOpenId] = useState<string | null>(null);
  const save = (next: readonly FloorMark[]): void => void writeMarks(floorId, next);
  const update = (id: string, change: (mark: FloorMark) => FloorMark): void => save(marks.map((m) => (m.id === id ? change(m) : m)));
  const add = (): void => {
    const text = label.trim();
    if (!text || marks.some((m) => m.label.toLowerCase() === text.toLowerCase())) return;
    const id = newMarkId(marks);
    const next = [...marks, { id, label: text, color }];
    save(next);
    // Open at once: a new tag is usually set up right away.
    setOpenId(id);
    setLabel('');
    setColor(COLORS.find((c) => !next.some((m) => m.color === c)) ?? color);
  };

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        <li className="flex items-center gap-2 px-2 text-xs">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: 'var(--note-red)' }} />
          <span className="flex-1">H-1 (merah) · tetap</span>
        </li>
        <li className="flex items-center gap-2 px-2 text-xs">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: 'var(--note-green)' }} />
          <span className="flex-1">Pulang hari ini (hijau) · tetap</span>
        </li>
        {marks.map((mark) => {
          const open = editable && openId === mark.id;
          const notes = markNotes(mark);
          const summary = (
            <>
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: markCss(mark.color) }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{mark.label}</span>
                {notes ? <span className="block truncate text-fg-muted">{notes}</span> : null}
              </span>
            </>
          );
          return (
            <li key={mark.id} className="rounded-lg border border-border text-xs">
              {editable ? (
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : mark.id)}
                  className="flex min-h-tap w-full items-center gap-2 px-2 py-1 text-left [@media(pointer:fine)]:min-h-9"
                >
                  {summary}
                  <IconChevronRight width="14" height="14" aria-hidden="true" className={`shrink-0 text-fg-muted transition-transform ${open ? 'rotate-90' : ''}`} />
                </button>
              ) : (
                <div className="flex min-h-9 items-center gap-2 px-2 py-1">{summary}</div>
              )}
              {open ? (
                <div className="space-y-2 border-t border-border p-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      key={mark.label}
                      defaultValue={mark.label}
                      aria-label={`Nama warna ${mark.label}`}
                      onBlur={(e) => {
                        const text = e.target.value.trim();
                        if (text && text !== mark.label) update(mark.id, (m) => ({ ...m, label: text }));
                      }}
                      className={`${INPUT} !w-0 min-w-0 flex-1 text-xs`}
                    />
                    <Button size="sm" variant="ghost" aria-label={`Hapus warna ${mark.label}`} onClick={() => save(marks.filter((m) => m.id !== mark.id))}>
                      Hapus
                    </Button>
                  </div>
                  <MarkColorPicker
                    label={`Warna ${mark.label}`}
                    value={mark.color}
                    onChange={(color) => {
                      if (color !== mark.color) update(mark.id, (m) => ({ ...m, color }));
                    }}
                  />
                  <AutoRule mark={mark} onChange={(auto) => update(mark.id, (m) => withAuto(m, auto))} />
                  {mark.auto?.kind === 'baru' ? (
                    <p className="text-xs text-fg-muted">
                      Pasien baru kini ditandai oleh Lencana pasien baru di bawah; warna ini tidak lagi dipasang otomatis. Hapus atau pilih aturan lain.
                    </p>
                  ) : (
                    // Screen only (13.12): a working mark stays off the Word/PDF sent to consultants.
                    <label className="flex min-h-8 items-center gap-1.5 text-xs text-fg-muted">
                      <input
                        type="checkbox"
                        checked={mark.print !== false}
                        onChange={(e) =>
                          update(mark.id, (m) => {
                            const { print: _old, ...rest } = m;
                            return e.target.checked ? rest : { ...rest, print: false as const };
                          })
                        }
                      />
                      Ikut dicetak di Word/PDF
                    </label>
                  )}
                  {/* 9 Nov 2026: titipan or chosen DPJPs; Ganti chief skips a patient with this tag. */}
                  <label className="flex min-h-8 items-center gap-1.5 text-xs text-fg-muted">
                    <input
                      type="checkbox"
                      checked={mark.noFollowUp === true}
                      onChange={(e) =>
                        update(mark.id, (m) => {
                          const { noFollowUp: _old, ...rest } = m;
                          return e.target.checked ? { ...rest, noFollowUp: true as const } : rest;
                        })
                      }
                    />
                    Tidak di-follow up
                  </label>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {editable ? (
        <div className="space-y-1.5">
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
          <MarkColorPicker label="Warna baru" value={color} onChange={setColor} />
          <Button size="sm" onClick={add} disabled={!label.trim()} aria-label="Tambah warna">
            +
          </Button>
        </div>
        </div>
      ) : null}
    </div>
  );
}
