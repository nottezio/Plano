import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AppShell } from '@/components/common/AppShell';
import { updateScratchNotes } from '@/data/repositories/settings.repo';
import { useTextSync } from '@/hooks/useTextSync';
import { useSession } from '@/store/useSession';
import type { ScratchNote } from '@/domain/types';

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

  /**
   * The stored list, with the original single note folded in.
   *
   * Anyone who wrote in the app before tabs existed has their text in
   * `scratchNote`. Migrating it on read rather than with a write means nothing
   * is rewritten while they might be mid-sentence in it, and the old field is
   * simply never written again.
   */
  const notes = useMemo<ScratchNote[]>(() => {
    const stored = profile?.notes ?? [];
    if (stored.length > 0) return stored;

    const legacy = profile?.scratchNote ?? '';
    return [{ id: 'n1', title: 'Catatan', body: legacy }];
  }, [profile?.notes, profile?.scratchNote]);

  const [showArchived, setShowArchived] = useState(false);

  const visible = useMemo(
    () => notes.filter((note) => (showArchived ? note.archived : !note.archived)),
    [notes, showArchived],
  );
  const archivedCount = useMemo(
    () => notes.filter((note) => note.archived).length,
    [notes],
  );

  const [activeId, setActiveId] = useState<string>(() => notes[0]?.id ?? 'n1');
  const active = visible.find((note) => note.id === activeId) ?? visible[0] ?? notes[0];

  const setArchived = (archived: boolean): void => {
    if (!uid || !active) return;
    void updateScratchNotes(
      uid,
      notes.map((note) => (note.id === active.id ? { ...note, archived } : note)),
    ).catch((error: unknown) => console.error('[catatan] archive rejected', error));
  };

  const write = useCallback(
    (body: string) => {
      if (!uid || !active) return Promise.resolve();
      return updateScratchNotes(
        uid,
        notes.map((note) => (note.id === active.id ? { ...note, body } : note)),
      );
    },
    [uid, notes, active],
  );

  const sync = useTextSync({
    // Keyed per note: two tabs sharing a draft key would each see the other's
    // text as a remote edit, which is how the standing-note panel broke.
    key: `scratch|${uid ?? 'none'}|${active?.id ?? 'n1'}`,
    serverText: active?.body ?? '',
    locked: uid === null,
    write,
  });

  const addNote = (): void => {
    if (!uid) return;
    const id = `n${Date.now().toString(36)}`;
    const next = [...notes, { id, title: `Catatan ${notes.length + 1}`, body: '' }];
    void updateScratchNotes(uid, next).catch((error: unknown) =>
      console.error('[catatan] could not add', error),
    );
    setActiveId(id);
  };

  const renameNote = (title: string): void => {
    if (!uid || !active) return;
    void updateScratchNotes(
      uid,
      notes.map((note) => (note.id === active.id ? { ...note, title } : note)),
    ).catch((error: unknown) => console.error('[catatan] could not rename', error));
  };

  const deleteNote = (): void => {
    if (!uid || !active || notes.length <= 1) return;
    const next = notes.filter((note) => note.id !== active.id);
    void updateScratchNotes(uid, next).catch((error: unknown) =>
      console.error('[catatan] could not delete', error),
    );
    setActiveId(next[0]?.id ?? 'n1');
  };

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
        <div className="mb-2 flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visible.map((note) => (
            <button
              key={note.id}
              type="button"
              aria-pressed={note.id === active?.id}
              onClick={() => {
                sync.flush();
                setActiveId(note.id);
              }}
              className={[
                'min-h-tap shrink-0 rounded-lg border px-3 text-xs',
                note.id === active?.id
                  ? 'border-accent bg-bg-subtle font-medium text-accent'
                  : 'border-border text-fg-muted',
              ].join(' ')}
            >
              {note.title || 'Tanpa judul'}
            </button>
          ))}
          {archivedCount > 0 || showArchived ? (
            <button
              type="button"
              onClick={() => setShowArchived((current) => !current)}
              className="min-h-tap shrink-0 rounded-lg border border-border px-2 text-[11px] text-fg-muted"
            >
              {showArchived ? 'Aktif' : `Arsip (${archivedCount})`}
            </button>
          ) : null}
          <button
            type="button"
            onClick={addNote}
            aria-label="Catatan baru"
            className="min-h-tap min-w-tap shrink-0 rounded-lg border border-dashed border-border-strong text-sm text-fg-muted"
          >
            +
          </button>
        </div>

        <div className="mb-2 flex items-center gap-2">
          <input
            type="text"
            value={active?.title ?? ''}
            onChange={(event) => renameNote(event.target.value)}
            placeholder="Judul catatan"
            className="min-h-tap min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-sm font-medium outline-none focus:border-border"
          />
          <button
            type="button"
            onClick={() => setArchived(!active?.archived)}
            className="min-h-tap shrink-0 px-2 text-xs text-accent"
          >
            {active?.archived ? 'Pulihkan' : 'Arsipkan'}
          </button>
          {notes.length > 1 ? (
            <button
              type="button"
              onClick={deleteNote}
              className="min-h-tap shrink-0 px-2 text-xs text-danger"
            >
              Hapus
            </button>
          ) : null}
        </div>
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
