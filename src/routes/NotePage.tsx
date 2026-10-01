import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { AppShell } from '@/components/common/AppShell';
import { IconClose, IconPlus, IconSearch } from '@/components/common/Icons';
import { Sheet } from '@/components/common/Sheet';
import { NoteEditor } from '@/components/notes/NoteEditor';
import { NoteList } from '@/components/notes/NoteList';
import {
  createScratchNote,
  patchScratchNote,
  purgeScratchNote,
} from '@/data/repositories/scratchNotes.repo';
import {
  countView,
  displayTitle,
  isDateOrdered,
  notePlainText,
  notesForView,
  orderAtTop,
  orderForMove,
  resolveNotes,
  searchNotes,
  type NoteView,
  type ResolvedNote,
} from '@/domain/notes/scratchNotes';
import type { ScratchNoteCategory } from '@/domain/types';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { copyText } from '@/lib/clipboard';
import { useSession } from '@/store/useSession';

/**
 * Catatan — personal notes, not for any patient.
 *
 * LAYOUT
 *
 *  - ≥1024 px: the list and the open note side by side. Switching notes is one
 *    press; the old page swapped the whole screen between board and editor,
 *    so every switch was "← Semua" and then a card.
 *  - Phone: the list, and a note opens full screen. The open note is in the
 *    URL (`?n=`), so the Android back gesture closes the note instead of
 *    leaving Catatan altogether.
 *
 * STORAGE: `domain/notes/scratchNotes` (a map written one field at a time).
 */

const SHELF_KEY = 'visite.catatan.shelf';

function readShelf(): ScratchNoteCategory {
  try {
    return localStorage.getItem(SHELF_KEY) === 'jaga' ? 'jaga' : 'umum';
  } catch {
    return 'umum';
  }
}

export default function NotePage(): JSX.Element {
  const uid = useSession((state) => state.user?.uid ?? null);
  const profile = useSession((state) => state.profile);
  const wide = useMediaQuery('(min-width: 1024px)');
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const notes = useMemo(() => resolveNotes(profile), [profile]);

  const [shelf, setShelfState] = useState<ScratchNoteCategory>(readShelf);
  const setShelf = (next: ScratchNoteCategory): void => {
    setShelfState(next);
    setView('aktif');
    try {
      localStorage.setItem(SHELF_KEY, next);
    } catch {
      // No storage: the choice lasts for this visit.
    }
  };
  const [view, setView] = useState<NoteView>('aktif');
  const [query, setQuery] = useState('');
  const searching = query.trim() !== '';

  // Relative times ("12 mnt") stay honest without a re-render per keystroke.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const listed = useMemo(
    () => (searching ? searchNotes(notes, query) : notesForView(notes, shelf, view)),
    [notes, shelf, view, query, searching],
  );

  // ── Which note is open ─────────────────────────────────────────────────────
  const requested = params.get('n');
  const byId = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes]);
  /*
    Wide: the requested note, or the first in the list, so the right pane is
    never an empty frame. Phone: only an explicitly opened note — the list IS
    the phone's first screen.
  */
  const open: ResolvedNote | null =
    (requested ? byId.get(requested) : undefined) ?? (wide ? listed[0] ?? null : null);

  const openNote = (id: string): void => {
    const next = new URLSearchParams(params);
    next.set('n', id);
    // Wide: switching is not navigation, so it must not pile up history.
    // Phone: opening IS navigation, so back closes it.
    setParams(next, wide ? { replace: true } : { state: { fromList: true } });
  };

  const closeNote = (): void => {
    if ((location.state as { fromList?: boolean } | null)?.fromList) {
      navigate(-1);
      return;
    }
    const next = new URLSearchParams(params);
    next.delete('n');
    setParams(next, { replace: true });
  };

  const [justCreated, setJustCreated] = useState<string | null>(null);

  const addNote = (): void => {
    if (!uid) return;
    setQuery('');
    setView('aktif');
    const id = createScratchNote(uid, {
      title: '',
      body: '',
      category: shelf,
      order: orderAtTop(notes),
    });
    setJustCreated(id);
    openNote(id);
  };

  const moveNote = (
    group: readonly ResolvedNote[],
    fromId: string,
    targetId: string,
    place: 'before' | 'after',
  ): void => {
    const note = byId.get(fromId);
    const order = orderForMove(group, fromId, targetId, place);
    if (!uid || !note || order === null) return;
    void patchScratchNote(uid, note, { order }).catch((error: unknown) =>
      console.error('[catatan] reorder rejected', error),
    );
  };

  // ── The ⋯ menu ─────────────────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [copied, setCopied] = useState(false);

  const patchOpen = (patch: Parameters<typeof patchScratchNote>[2]): void => {
    if (!uid || !open) return;
    void patchScratchNote(uid, open, patch).catch((error: unknown) =>
      console.error('[catatan] update rejected', error),
    );
  };

  /** After a note leaves the current list, a phone goes back to the list. */
  const leave = (): void => {
    setMenuOpen(false);
    if (!wide) closeNote();
    else {
      const next = new URLSearchParams(params);
      next.delete('n');
      setParams(next, { replace: true });
    }
  };

  const archivedCount = countView(notes, shelf, 'arsip');
  const trashCount = countView(notes, shelf, 'sampah');

  // ── Rendering ──────────────────────────────────────────────────────────────
  const listPane = (
    <div className="flex flex-col gap-2 p-3">
      {/* Shelf: which list you are looking at, filled so it reads as a choice. */}
      <div role="group" aria-label="Rak catatan" className="flex gap-1 rounded-xl bg-bg-subtle p-1">
        {(['umum', 'jaga'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={shelf === value && !searching}
            onClick={() => {
              setQuery('');
              setShelf(value);
            }}
            className={[
              'min-h-tap flex-1 rounded-lg text-sm transition-colors',
              shelf === value && !searching
                ? 'bg-surface font-semibold text-fg shadow-sm'
                : 'text-fg-muted hover:text-fg',
            ].join(' ')}
          >
            {value === 'umum' ? 'Catatan' : 'Catatan jaga'}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <label className="flex min-h-tap min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3 focus-within:border-accent">
          <IconSearch width="16" height="16" className="shrink-0 text-fg-faint" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setQuery('');
            }}
            placeholder="Cari semua catatan"
            aria-label="Cari catatan"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          {searching ? (
            <button
              type="button"
              aria-label="Hapus pencarian"
              onClick={() => setQuery('')}
              className="-mr-2 flex min-h-tap min-w-tap items-center justify-center text-fg-faint"
            >
              <IconClose width="16" height="16" />
            </button>
          ) : null}
        </label>
        <button
          type="button"
          onClick={addNote}
          disabled={!uid}
          className="flex min-h-tap shrink-0 items-center gap-1 rounded-xl bg-accent px-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <IconPlus width="18" height="18" />
          Baru
        </button>
      </div>

      {!searching ? (
        <div className="flex items-center gap-1 text-xs">
          {(
            [
              ['aktif', 'Aktif', null],
              ['arsip', 'Arsip', archivedCount],
              ['sampah', 'Sampah', trashCount],
            ] as const
          ).map(([value, label, count]) =>
            // Arsip and Sampah appear only when they have something in them.
            value === 'aktif' || (count ?? 0) > 0 || view === value ? (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => setView(value)}
                className={[
                  'min-h-tap rounded-lg px-2',
                  view === value ? 'font-semibold text-accent' : 'text-fg-muted hover:text-fg',
                ].join(' ')}
              >
                {label}
                {count ? ` (${count})` : ''}
              </button>
            ) : null,
          )}
        </div>
      ) : (
        <p className="px-1 text-xs text-fg-muted">
          {listed.length === 0 ? 'Tidak ditemukan.' : `${listed.length} catatan`} · kedua rak dan
          arsip
        </p>
      )}

      {listed.length > 0 ? (
        <NoteList
          notes={listed}
          activeId={wide ? open?.id ?? null : null}
          onOpen={openNote}
          onMove={moveNote}
          now={now}
          reorderable={!searching && view !== 'sampah' && !isDateOrdered(shelf, view)}
          showShelf={searching}
        />
      ) : !searching ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-fg-muted">
            {view === 'arsip'
              ? 'Tidak ada catatan terarsip.'
              : view === 'sampah'
                ? 'Sampah kosong.'
                : shelf === 'jaga'
                  ? 'Belum ada catatan jaga.'
                  : 'Belum ada catatan.'}
          </p>
          {view === 'aktif' ? (
            <button
              type="button"
              onClick={addNote}
              disabled={!uid}
              className="min-h-tap rounded-lg border border-border px-4 text-sm font-medium text-accent"
            >
              {shelf === 'jaga' ? 'Buat catatan jaga' : 'Buat catatan'}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const editorPane = open ? (
    <NoteEditor
      key={open.id}
      uid={uid}
      note={open}
      now={now}
      autoFocus={open.id === justCreated}
      onBack={wide ? undefined : closeNote}
      onMenu={() => {
        setConfirmPurge(false);
        setMenuOpen(true);
      }}
    />
  ) : (
    <div className="flex h-full items-center justify-center p-8 text-sm text-fg-faint">
      Pilih catatan, atau buat yang baru.
    </div>
  );

  return (
    <AppShell title="Catatan">
      {wide ? (
        <div className="flex h-full min-h-0">
          <aside className="w-[22rem] shrink-0 overflow-y-auto border-r border-border">
            {listPane}
          </aside>
          <section className="min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto h-full max-w-3xl">{editorPane}</div>
          </section>
        </div>
      ) : open ? (
        editorPane
      ) : (
        <div className="mx-auto max-w-2xl">{listPane}</div>
      )}

      {open ? (
        <Sheet
          open={menuOpen}
          onOpenChange={(next) => {
            if (!next) setConfirmPurge(false);
            setMenuOpen(next);
          }}
          title={displayTitle(open)}
        >
          <div className="space-y-2">
            {open.deletedAt !== undefined ? (
              <>
                <MenuButton
                  onClick={() => {
                    patchOpen({ deletedAt: undefined });
                    setMenuOpen(false);
                  }}
                >
                  Pulihkan dari Sampah
                </MenuButton>
                {confirmPurge ? (
                  <div className="rounded-lg border border-danger p-3">
                    <p className="text-xs text-fg-muted">
                      Hapus “{displayTitle(open)}” selamanya? Isinya tidak bisa dikembalikan.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmPurge(false)}
                        className="min-h-tap flex-1 rounded-lg border border-border text-sm"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (uid) {
                            void purgeScratchNote(uid, open.id).catch((error: unknown) =>
                              console.error('[catatan] purge rejected', error),
                            );
                          }
                          leave();
                        }}
                        className="min-h-tap flex-1 rounded-lg bg-danger text-sm font-semibold text-white"
                      >
                        Hapus permanen
                      </button>
                    </div>
                  </div>
                ) : (
                  <MenuButton danger onClick={() => setConfirmPurge(true)}>
                    Hapus permanen…
                  </MenuButton>
                )}
              </>
            ) : (
              <>
                <MenuButton
                  onClick={() => {
                    patchOpen({ pinned: !open.pinned });
                    setMenuOpen(false);
                  }}
                >
                  {open.pinned ? 'Lepas pin' : 'Pin di atas'}
                </MenuButton>
                <MenuButton
                  onClick={() => {
                    void copyText(
                      `${open.title.trim() ? `${open.title.trim()}\n\n` : ''}${notePlainText(open.body)}`,
                    ).then((ok) => {
                      setCopied(ok);
                      window.setTimeout(() => setCopied(false), 1500);
                    });
                  }}
                >
                  {copied ? 'Tersalin ✓' : 'Salin sebagai teks'}
                </MenuButton>
                <MenuButton
                  onClick={() => {
                    const target: ScratchNoteCategory = open.category === 'jaga' ? 'umum' : 'jaga';
                    patchOpen({ category: target, order: orderAtTop(notes) });
                    setMenuOpen(false);
                    if (!searching) setShelf(target);
                  }}
                >
                  Pindahkan ke {open.category === 'jaga' ? 'Catatan' : 'Catatan jaga'}
                </MenuButton>
                <MenuButton
                  onClick={() => {
                    patchOpen({ archived: !open.archived });
                    leave();
                  }}
                >
                  {open.archived ? 'Keluarkan dari arsip' : 'Arsipkan'}
                </MenuButton>
                {/*
                  Soft delete. It was a hard delete, unconfirmed, beside
                  Arsipkan — one mis-tap from gone. Now it goes to Sampah, so
                  no confirmation is needed: nothing is lost.
                */}
                <MenuButton
                  danger
                  onClick={() => {
                    patchOpen({ deletedAt: Date.now(), pinned: false });
                    leave();
                  }}
                >
                  Pindahkan ke Sampah
                </MenuButton>
              </>
            )}
          </div>
        </Sheet>
      ) : null}
    </AppShell>
  );
}

function MenuButton({
  onClick,
  danger = false,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'min-h-tap w-full rounded-lg border px-3 py-2 text-left text-sm font-medium',
        danger ? 'border-danger/40 text-danger' : 'border-border',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
