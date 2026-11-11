import { useState } from 'react';

import { INPUT } from '@/components/common/ui';
import type { FloorDoc } from '@/domain/floorList/floor';
import { markCss, newBadgeOf, type NewBadge } from '@/domain/floorList/marks';
import { MarkColorPicker } from './MarkColorPicker';

/**
 * The Pasien baru badge (10 Nov 2026, Avi): on or off, its text ("Pasien
 * baru", "Pindahan"…) and colour, with a preview. Saved on blur / change, a
 * small write on the list document; skipped when nothing changed.
 */
export function NewBadgeField({ floor, editable, onSave }: { floor: FloorDoc; editable: boolean; onSave: (badge: NewBadge) => void }): JSX.Element {
  const badge = newBadgeOf(floor);
  const [label, setLabel] = useState(badge.label);
  const save = (next: NewBadge): void => {
    const clean = { ...next, label: next.label.trim().slice(0, 30) || badge.label };
    if (clean.label === badge.label && clean.color === badge.color && clean.on === badge.on) return;
    onSave(clean);
  };
  const preview = (
    <span
      className="inline-block rounded-full border px-1.5 text-[11px] font-semibold leading-4"
      style={{ borderColor: markCss(badge.color), color: markCss(badge.color), opacity: badge.on ? 1 : 0.4 }}
    >
      {badge.label}
    </span>
  );
  if (!editable) {
    return (
      <p className="flex items-center gap-2 text-xs">
        {preview}
        <span className="text-fg-muted">{badge.on ? 'Aktif' : 'Nonaktif'}</span>
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <label className="flex min-h-8 items-center gap-2 text-sm">
        <input type="checkbox" checked={badge.on} onChange={(e) => save({ ...badge, label, on: e.target.checked })} />
        Tampilkan lencana pada pasien baru
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={label}
          maxLength={30}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => save({ ...badge, label })}
          aria-label="Teks lencana pasien baru"
          className={`${INPUT} !w-44 text-xs`}
        />
        <MarkColorPicker label="Warna lencana pasien baru" value={badge.color} onChange={(color) => save({ ...badge, label, color })} />
        {preview}
      </div>
    </div>
  );
}
