import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AppShell } from '@/components/common/AppShell';
import { COLOR_SENTINEL, stripSentinelColor } from '@/domain/format/noteColor';
import { updateScratchNotes } from '@/data/repositories/settings.repo';
import { useTextSync } from '@/hooks/useTextSync';
import { useSession } from '@/store/useSession';
import type { ScratchNote, ScratchNoteCategory } from '@/domain/types';

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

/**
 * The concrete colour for a palette token.
 *
 * `--note-red` and friends are CSS variables, and `execCommand('foreColor')`
 * takes a colour VALUE — it cannot read a variable — so the current computed
 * value is looked up and passed instead.
 */
function resolveToken(token: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  // A missing variable would otherwise pass `''` to `foreColor`, which some
  // browsers accept as black — wrong, and wrong in a way that looks deliberate.
  return value || 'currentColor';
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
  const [category, setCategory] = useState<ScratchNoteCategory>('umum');

  const visible = useMemo(
    () =>
      notes.filter(
        (note) =>
          // Absent category means `umum`. Notes written before the shelf
          // existed must not vanish from the only shelf that used to exist.
          (note.category ?? 'umum') === category &&
          (showArchived ? note.archived : !note.archived),
      ),
    [notes, showArchived, category],
  );
  const archivedCount = useMemo(
    () =>
      notes.filter((note) => note.archived && (note.category ?? 'umum') === category).length,
    [notes, category],
  );

  const [activeId, setActiveId] = useState<string>(() => notes[0]?.id ?? 'n1');
  /**
   * The note being edited, or nothing when this shelf is empty.
   *
   * The final fallback used to be `notes[0]`, which reaches ACROSS shelves: on
   * an empty jaga shelf it selected the first Umum note, so the editor showed
   * and saved a note from a shelf the user was not looking at, under a header
   * that said otherwise. Falling back to nothing is the honest answer — an
   * empty shelf is empty.
   */
  const active = visible.find((note) => note.id === activeId) ?? visible[0];

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
    // A new note lands on the shelf you are looking at. Adding one from the
    // jaga list and finding it under Umum would be a small betrayal every time.
    const next = [
      ...notes,
      {
        id,
        title: category === 'jaga' ? `Jaga ${notes.length + 1}` : `Catatan ${notes.length + 1}`,
        body: '',
        category,
      },
    ];
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
    // The last note ON THIS SHELF may still be deleted when the other shelf
    // has notes; the guard exists so the app is never left with none at all.
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

  /**
   * Put the selection back to the theme's own text colour.
   *
   * The palette's "Biasa" entry used to pass the string `'inherit'` to
   * `foreColor`. That is not a colour, the browser silently rejects it, and
   * the button did nothing — text went red with no way back. The swatch was
   * `transparent` too, so the one control that could have fixed it was also
   * invisible.
   *
   * `removeFormat` would work but takes bold and italic with it, which is more
   * than was asked for. Painting a sentinel and unwrapping it removes exactly
   * the colour.
   */
  const clearColor = (): void => {
    const node = ref.current;
    if (!node) return;
    node.focus();
    document.execCommand('foreColor', false, COLOR_SENTINEL);
    stripSentinelColor(node);
    sync.setValue(node.innerHTML);
  };

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
        {/*
          The two shelves, above the note tabs rather than mixed among them.

          A jaga list is a different KIND of thing from a reference note — it
          is written to be worked through and finished, not kept — and mixing
          both into one scrolling row of tabs makes the row longer every shift
          while hiding which are which.
        */}
        <div className="mb-2 flex items-center gap-1">
          {(['umum', 'jaga'] as const).map((shelf) => (
            <button
              key={shelf}
              type="button"
              aria-pressed={category === shelf}
              onClick={() => {
                sync.flush();
                setCategory(shelf);
                setShowArchived(false);
              }}
              className={[
                'min-h-tap flex-1 rounded-lg border px-3 text-xs',
                category === shelf
                  ? 'border-accent bg-bg-subtle font-medium text-accent'
                  : 'border-border text-fg-muted',
              ].join(' ')}
            >
              {shelf === 'umum' ? 'Catatan' : 'Catatan jaga'}
            </button>
          ))}
        </div>

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

        {/*
          An empty shelf says so and offers the one action that helps.

          Rendering the editor anyway would show a titled, toolbarred, empty
          box bound to no note — every keystroke discarded, with nothing on
          screen saying why.
        */}
        {!active ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12">
            <p className="text-sm text-fg-muted">
              {category === 'jaga'
                ? 'Belum ada catatan jaga.'
                : showArchived
                  ? 'Tidak ada catatan terarsip.'
                  : 'Belum ada catatan.'}
            </p>
            {!showArchived ? (
              <button
                type="button"
                onClick={addNote}
                className="min-h-tap rounded-lg border border-border px-4 text-sm font-medium text-accent"
              >
                {category === 'jaga' ? 'Buat catatan jaga' : 'Buat catatan'}
              </button>
            ) : null}
          </div>
        ) : (
        <>
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
              onClick={() =>
                color.token ? apply('foreColor', resolveToken(color.token)) : clearColor()
              }
              className="flex min-h-tap min-w-tap items-center justify-center"
            >
              <span
                aria-hidden="true"
                className="h-5 w-5 rounded-full border border-border-strong"
                style={{
                  // The reset swatch shows the body colour rather than
                  // `transparent`, which rendered it invisible — an option
                  // nobody could see was an option nobody used.
                  backgroundColor: color.token ? `var(${color.token})` : 'var(--fg)',
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
        </>
        )}
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
