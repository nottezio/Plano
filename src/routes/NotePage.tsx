import { useCallback, useEffect, useRef } from 'react';

import { AppShell } from '@/components/common/AppShell';
import { updateProfileNote } from '@/data/repositories/settings.repo';
import { useTextSync } from '@/hooks/useTextSync';
import { useSession } from '@/store/useSession';

/**
 * A single scratch note, for the user rather than for a patient.
 *
 * One note, not a list: opening the tab puts a cursor in the text you were
 * already writing. A list would make you choose a note before you could write
 * in one, which is the friction this removes.
 *
 * This is the ONE editor in the app that stores rich text. Everywhere else the
 * body is plain, because it has to survive a byte-faithful copy into WhatsApp
 * and a lossless section parse. Nothing here is ever copied into a handover, so
 * none of that applies — and colour and size are genuinely useful for marking
 * what matters in a page of reminders.
 *
 * The cost, stated plainly: the three-way merge operates on the stored string,
 * which here is HTML. Merging two device's edits could in principle split a
 * tag. For a personal note edited on one device at a time that is a remote
 * risk, and the conflict dialog's "keep both" is still there if it happens.
 */

/**
 * Read from the token layer rather than hardcoded, so the note stays legible in
 * both themes — a red that reads well on white is too dark on the night-shift
 * background, and `execCommand` bakes whatever value it is given into the
 * stored HTML permanently.
 *
 * Resolved at click time, because the stored colour has to be a literal.
 */
const COLORS = [
  { label: 'Biasa', token: null },
  { label: 'Merah', token: '--note-red' },
  { label: 'Kuning', token: '--note-amber' },
  { label: 'Hijau', token: '--note-green' },
  { label: 'Biru', token: '--note-blue' },
] as const;

function resolveToken(token: string | null): string {
  if (!token) return 'inherit';
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value || 'inherit';
}

const SIZES = [
  { label: 'Kecil', value: '2' },
  { label: 'Normal', value: '3' },
  { label: 'Besar', value: '5' },
];

export default function NotePage(): JSX.Element {
  const uid = useSession((state) => state.user?.uid ?? null);
  const profile = useSession((state) => state.profile);
  const ref = useRef<HTMLDivElement>(null);

  const write = useCallback(
    (note: string) => (uid ? updateProfileNote(uid, note) : Promise.resolve()),
    [uid],
  );

  const sync = useTextSync({
    key: `scratch|${uid ?? 'none'}`,
    serverText: profile?.scratchNote ?? '',
    locked: uid === null,
    write,
  });

  /**
   * Written into the DOM only when the two have actually diverged.
   *
   * Assigning `innerHTML` on every render would move the caret to the start on
   * every keystroke — the same class of bug as the textarea autosize that used
   * to scroll the page to the top.
   */
  useEffect(() => {
    const node = ref.current;
    if (node && node.innerHTML !== sync.value) node.innerHTML = sync.value;
  }, [sync.value]);

  const apply = (command: string, value?: string): void => {
    ref.current?.focus();
    // `execCommand` is deprecated and has no replacement for this. Every
    // alternative means owning a document model, which for one personal note is
    // far more machinery than the feature is worth.
    document.execCommand(command, false, value);
    if (ref.current) sync.setValue(ref.current.innerHTML);
  };

  return (
    <AppShell title="Catatan">
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4 pb-4 pt-4">
        <div className="mb-2 flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-1">
          <ToolButton label="Tebal" onClick={() => apply('bold')}>
            <strong>B</strong>
          </ToolButton>
          <ToolButton label="Miring" onClick={() => apply('italic')}>
            <em>I</em>
          </ToolButton>
          <ToolButton label="Garis bawah" onClick={() => apply('underline')}>
            <span className="underline">U</span>
          </ToolButton>
          <ToolButton label="Daftar" onClick={() => apply('insertUnorderedList')}>
            •
          </ToolButton>

          <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />

          <select
            aria-label="Ukuran teks"
            defaultValue="3"
            onChange={(event) => apply('fontSize', event.target.value)}
            className="min-h-tap rounded-lg border border-border bg-surface px-2 text-xs"
          >
            {SIZES.map((size) => (
              <option key={size.value} value={size.value}>
                {size.label}
              </option>
            ))}
          </select>

          {COLORS.map((color) => (
            <button
              key={color.label}
              type="button"
              aria-label={`Warna ${color.label}`}
              title={color.label}
              onClick={() => apply('foreColor', resolveToken(color.token))}
              className="flex min-h-tap min-w-tap items-center justify-center"
            >
              <span
                aria-hidden="true"
                className="h-5 w-5 rounded-full border border-border-strong"
                style={{
                  backgroundColor: color.token ? `var(${color.token})` : 'transparent',
                }}
              />
            </button>
          ))}
        </div>

        <div
          ref={ref}
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-label="Catatan pribadi"
          spellCheck
          lang=""
          onInput={(event) => sync.setValue(event.currentTarget.innerHTML)}
          onBlur={sync.flush}
          className="min-h-[55vh] flex-1 rounded-lg border border-border bg-surface p-3 text-[15px] leading-7 outline-none [&_ul]:list-disc [&_ul]:pl-5"
        />

        <p className="pt-2 text-[11px] text-fg-faint">
          {sync.dirty ? 'Menyimpan…' : 'Tersimpan'} · Hanya untuk Anda, tidak ikut tersalin
          ke laporan.
        </p>
      </div>
    </AppShell>
  );
}

function ToolButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="min-h-tap min-w-tap rounded-lg text-sm text-fg-muted hover:bg-bg-subtle"
    >
      {children}
    </button>
  );
}
