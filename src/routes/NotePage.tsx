import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AppShell } from '@/components/common/AppShell';
import { reorderWithinVisible } from '@/domain/reorder';
import { applyPending, settlePending } from '@/domain/pendingBodies';
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

  /**
   * Drag a note tab to reorder the shelf.
   *
   * Order is the stored array order, so a move rewrites `notes` — and it has
   * to be rewritten in terms of the FULL list, not the visible one. `visible`
   * is filtered by shelf and by archived state, so splicing within it and
   * writing that back would drop every note the current filter hides.
   *
   * HTML drag-and-drop rather than the pointer-based drag the board uses: this
   * is a row of small tabs on a desktop, not cards on a canvas, and the native
   * API gives the drop target and the reorder for free. The board needed
   * pointer events because it needed positions.
   */
  const [dragId, setDragId] = useState<string | null>(null);

  /**
   * Bodies sent and not yet echoed back by Firestore.
   *
   * These notes live in ONE document as an array, so saving any note rewrites
   * all of them — and on a tab switch two saves happen in quick succession: a
   * flush for the note being left, then a save for the note being entered. The
   * second used to build its array from a render that had not yet seen the
   * first echo back, so it carried the OLD body for the note just left and
   * overwrote a checklist added seconds earlier.
   *
   * Replaying what is in flight makes the second write carry the first.
   */
  const pendingBodies = useRef(new Map<string, string>());
  const notesRef = useRef(notes);
  notesRef.current = notes;

  useEffect(() => {
    settlePending(notes, pendingBodies.current);
  }, [notes]);


  const reorder = (fromId: string, toId: string): void => {
    if (!uid || fromId === toId) return;

    const next = applyPending(
      reorderWithinVisible(notes, visible, (note) => note.id, fromId, toId),
      // Reordering rewrites the same array, so an unsaved body in flight would
      // be reverted by it exactly as the tab-switch save was.
      pendingBodies.current,
    );

    void updateScratchNotes(uid, next).catch((error: unknown) =>
      console.error('[catatan] reorder rejected', error),
    );
  };

  const setArchived = (archived: boolean): void => {
    if (!uid || !active) return;
    void updateScratchNotes(
      uid,
      applyPending(
        notes.map((note) => (note.id === active.id ? { ...note, archived } : note)),
        pendingBodies.current,
      ),
    ).catch((error: unknown) => console.error('[catatan] archive rejected', error));
  };

  const write = useCallback(
    (body: string) => {
      if (!uid || !active) return Promise.resolve();
      pendingBodies.current.set(active.id, body);
      // `notesRef`, not the closed-over `notes`: this callback is memoised and
      // a save can fire from a render older than the one that created it.
      return updateScratchNotes(uid, applyPending(notesRef.current, pendingBodies.current));
    },
    [uid, active],
  );

  const sync = useTextSync({
    // Keyed per note: two tabs sharing a draft key would each see the other's
    // text as a remote edit, which is how the standing-note panel broke.
    key: `scratch|${uid ?? 'none'}|${active?.id ?? 'n1'}`,
    serverText: active?.body ?? '',
    locked: uid === null,
    write,
  });

  /**
   * Ticking a checklist box — on a NATIVE listener, not React's `onChange`.
   *
   * This is why the ticks kept disappearing, and it was never the sync race
   * fixed on 14 September: the tick was never saved in the first place.
   *
   * React's change plugin handles checkboxes through `click`, and only for
   * inputs React itself rendered. These boxes are inserted by `execCommand`
   * into a contenteditable, so they have no fiber. React walks up to the
   * nearest element it does know — this `div` — sees that a `div` is not a
   * checkbox, and dispatches nothing. The `onChange` prop on the container
   * looked correct and had simply never run.
   *
   * The ATTRIBUTE is written rather than the property, because `innerHTML` is
   * how this note is stored and it serialises attributes and ignores
   * properties. A box ticked without this looks ticked until the value is
   * reloaded, and is then blank again.
   *
   * `click` as well as `change`: the two are redundant here, and redundancy is
   * cheap because the handler is idempotent — it reads the box's own state
   * rather than toggling anything.
   */
  const syncRef = useRef(sync);
  syncRef.current = sync;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const onToggle = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox') return;
      if (target.checked) target.setAttribute('checked', '');
      else target.removeAttribute('checked');
      syncRef.current.setValue(node.innerHTML);
    };

    node.addEventListener('change', onToggle);
    node.addEventListener('click', onToggle);
    return () => {
      node.removeEventListener('change', onToggle);
      node.removeEventListener('click', onToggle);
    };
  }, []);

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

  /**
   * The title, held locally while typing and written on a pause.
   *
   * Every keystroke used to write the WHOLE notes array to Firestore, and the
   * input read its value back from that round trip — so each character waited
   * on a network write before it appeared, and the caret jumped whenever a
   * snapshot landed mid-word. On ward wifi that is the lag.
   *
   * `null` means "not being edited", so the input falls back to the stored
   * title and a rename made on another device still shows up.
   */
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const titleTimer = useRef<number | undefined>(undefined);

  const commitTitle = useCallback(
    (title: string) => {
      if (!uid || !active) return;
      void updateScratchNotes(
        uid,
        notes.map((note) => (note.id === active.id ? { ...note, title } : note)),
      ).catch((error: unknown) => console.error('[catatan] could not rename', error));
    },
    [uid, active, notes],
  );

  const renameNote = (title: string): void => {
    setTitleDraft(title);
    window.clearTimeout(titleTimer.current);
    titleTimer.current = window.setTimeout(() => {
      commitTitle(title);
      // Back to the stored value once the write is out, so a later remote
      // rename is not masked by a stale draft.
      setTitleDraft(null);
    }, 400);
  };

  /** Blur writes immediately: leaving the field is a finished edit. */
  const flushTitle = (): void => {
    if (titleDraft === null) return;
    window.clearTimeout(titleTimer.current);
    commitTitle(titleDraft);
    setTitleDraft(null);
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
  /**
   * Insert one checklist row at the caret.
   *
   * `insertHTML` rather than building nodes by hand: it splits whatever the
   * caret is inside and puts the markup at the right depth, which is the part
   * that is genuinely awkward to do manually in a contentEditable.
   *
   * The input carries `contenteditable="false"` so the caret cannot land
   * inside the box itself, and a trailing space so there is somewhere to type.
   * One row per press — a list grows by pressing Enter, the same as any other
   * list here.
   */
  const insertChecklistItem = (): void => {
    const node = ref.current;
    if (!node) return;
    restoreSelection();
    document.execCommand(
      'insertHTML',
      false,
      '<ul class="cl"><li><input type="checkbox" contenteditable="false">&nbsp;</li></ul>',
    );
    sync.setValue(node.innerHTML);
  };

  const clearColor = (): void => {
    const node = ref.current;
    if (!node) return;
    restoreSelection();
    document.execCommand('foreColor', false, COLOR_SENTINEL);
    stripSentinelColor(node);
    sync.setValue(node.innerHTML);
  };

  /**
   * The last selection made INSIDE the note, kept so a toolbar control can put
   * it back.
   *
   * This is the fix for "ukuran teks kadang tidak jalan". The size control is
   * a native `<select>`, and opening one MUST move focus away from the
   * contenteditable — at which point the browser is free to drop the document
   * selection. `apply` then called `focus()` and `execCommand('fontSize')`
   * against a caret, not a range, and the size was applied to nothing.
   *
   * It looked intermittent because it depends on whether the browser happened
   * to preserve the range across the focus change, and on a LONG note it
   * almost never does: `focus()` scrolls the caret into view, and on a
   * document that scrolls, that is a different position from the one the user
   * had selected.
   *
   * Recorded from `selectionchange` rather than from a click handler, because
   * a selection can also be made with the keyboard, or extended after the
   * mouse is released.
   */
  const lastRange = useRef<Range | null>(null);

  useEffect(() => {
    const onSelectionChange = (): void => {
      const node = ref.current;
      const selection = window.getSelection();
      if (!node || !selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      // Only ranges inside this editor. A selection in the sidebar or in
      // another note must not be restored into this one.
      if (!node.contains(range.commonAncestorContainer)) return;
      lastRange.current = range.cloneRange();
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, []);

  /** Put the caret back where the user left it, before any `execCommand`. */
  const restoreSelection = (): void => {
    const node = ref.current;
    const range = lastRange.current;
    if (!node) return;
    // `preventScroll`, so restoring focus on a long note does not jump the
    // page away from what the user is looking at.
    node.focus({ preventScroll: true });
    if (!range || !node.contains(range.commonAncestorContainer)) return;
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const apply = (command: string, value?: string): void => {
    restoreSelection();
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
              /**
               * A filled tab, not another outlined pill.
               *
               * These sat in a row of outlined buttons that all looked alike —
               * the note tabs below, the archive toggle beside them — so the
               * one control that changes WHICH LIST you are looking at read as
               * just another button. Filling the selected shelf makes the
               * choice visible without adding a fourth border weight.
               */
              className={[
                'min-h-tap flex-1 rounded-lg px-3 text-xs transition-colors',
                category === shelf
                  ? 'bg-accent font-semibold text-white'
                  : 'border border-border text-fg-muted hover:bg-bg-subtle',
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
              draggable
              onDragStart={(event) => {
                setDragId(note.id);
                // Required by Firefox, which refuses to start a drag without
                // something on the transfer object.
                event.dataTransfer.setData('text/plain', note.id);
                event.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(event) => {
                if (dragId && dragId !== note.id) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragId) reorder(dragId, note.id);
                setDragId(null);
              }}
              onDragEnd={() => setDragId(null)}
              onClick={() => {
                sync.flush();
                setActiveId(note.id);
              }}
              className={[
                'min-h-tap shrink-0 cursor-grab rounded-lg border px-3 text-xs',
                note.id === active?.id
                  ? 'border-accent bg-bg-subtle font-medium text-accent'
                  : 'border-border text-fg-muted',
                dragId === note.id ? 'opacity-50' : '',
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
            value={titleDraft ?? active?.title ?? ''}
            onChange={(event) => renameNote(event.target.value)}
            onBlur={flushTitle}
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
      {/*
        THE TOOLBAR FOLLOWS THE PAGE.

        A reference note runs to several screens, and the formatting controls
        sat at the top of it — so applying bold to something two screens down
        meant selecting the text, scrolling back up, and losing the selection
        on the way. Sticky keeps them where the text is.

        `z-10` and an opaque background, not a translucent one: this sits over
        body text as it scrolls under, and a translucent bar makes both
        unreadable at exactly the moment you are aiming at a small button.

        `top-0` relative to the page's own scroller rather than the viewport —
        the shelf tabs and note tabs above scroll away, which is right. They
        are navigation and you have already used them by the time you are
        formatting.
      */}
      <div className="sticky top-0 z-10 mb-2 flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-1">
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
          <ToolButton label="Checklist" onClick={insertChecklistItem}>
            ☑
          </ToolButton>

          <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />

          {/*
            `value`, not `defaultValue`, with the choice reset after applying.

            A `<select>` left showing "Besar" after the size was applied makes
            the next press of the same option a no-op — `onChange` does not
            fire when the value has not changed — so applying the same size to
            a second paragraph silently did nothing. Resetting to the neutral
            label turns it into a command rather than a state.
          */}
          <select
            aria-label="Ukuran teks"
            value="label"
            onChange={(event) => {
              apply('fontSize', event.target.value);
              event.target.value = 'label';
            }}
            className="min-h-tap rounded-lg border border-border bg-surface px-2 text-xs"
          >
            <option value="label" disabled>
              Ukuran
            </option>
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
          /**
           * `ul.cl` is the checklist list: no bullet, because each row already
           * carries a box, and two markers per line reads as a mistake.
           */
          className="min-h-[55vh] flex-1 rounded-lg border border-border bg-surface p-3 text-[15px] leading-7 outline-none [&_ul.cl]:list-none [&_ul.cl]:pl-0 [&_ul.cl_input]:mr-2 [&_ul:not(.cl)]:list-disc [&_ul:not(.cl)]:pl-5"
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
