import { useState } from 'react';

import { newReminderId, type ReminderKind } from '@/domain/reminders';

/**
 * The list of daily reminders a patient can be given (Pengaturan → Pengingat
 * harian). EKG and Urine output are the defaults; the user adds their own
 * (GDS, balance cairan, EKG post-PCI…).
 *
 * Renaming keeps the id, so every patient who already has the reminder keeps
 * it under the new name. Removing a kind only hides it: the patients' settings
 * stay in their documents, and adding a kind with the same name brings them
 * back (same label, same id).
 */
export function ReminderKindsEditor({
  kinds,
  onChange,
}: {
  kinds: readonly ReminderKind[];
  onChange: (next: ReminderKind[]) => void;
}): JSX.Element {
  const [draft, setDraft] = useState('');

  const add = (): void => {
    const label = draft.trim();
    if (!label) return;
    if (kinds.some((kind) => kind.label.toLowerCase() === label.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...kinds, { id: newReminderId(label, kinds), label }]);
    setDraft('');
  };

  const move = (index: number, direction: -1 | 1): void => {
    const target = index + direction;
    if (target < 0 || target >= kinds.length) return;
    const next = [...kinds];
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(target, 0, moved);
    onChange(next);
  };

  return (
    <div>
      <ul className="space-y-2">
        {kinds.map((kind, index) => (
          <li key={kind.id} className="flex items-center gap-1">
            <input
              type="text"
              value={kind.label}
              aria-label={`Nama pengingat ${String(index + 1)}`}
              onChange={(event) =>
                onChange(
                  kinds.map((other) =>
                    other.id === kind.id ? { ...other, label: event.target.value } : other,
                  ),
                )
              }
              className="min-h-tap min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm"
            />
            <button
              type="button"
              aria-label={`Naikkan ${kind.label}`}
              disabled={index === 0}
              onClick={() => move(index, -1)}
              className="min-h-tap min-w-tap rounded-lg text-fg-muted disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`Turunkan ${kind.label}`}
              disabled={index === kinds.length - 1}
              onClick={() => move(index, 1)}
              className="min-h-tap min-w-tap rounded-lg text-fg-muted disabled:opacity-30"
            >
              ↓
            </button>
            <button
              type="button"
              aria-label={`Hapus ${kind.label}`}
              onClick={() => onChange(kinds.filter((other) => other.id !== kind.id))}
              className="min-h-tap min-w-tap rounded-lg text-danger"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={draft}
          placeholder="mis. GDS, Balance cairan"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
          className="min-h-tap min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="min-h-tap rounded-lg border border-accent px-3 text-sm font-medium text-accent disabled:opacity-40"
        >
          Tambah
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
        Pasang per pasien dengan tekan lama kartu di papan, atau menu ⋯ di halaman pasien:
        <em> Hari ini</em> atau <em>Setiap hari</em>. Ketuk penanda di kartu untuk mencentang;
        centang hilang sendiri besok.
      </p>
    </div>
  );
}
