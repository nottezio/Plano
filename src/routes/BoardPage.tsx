import { DEFAULT_REMINDER_KINDS } from '@/domain/reminders';
import { privateText } from '@/domain/identity';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CanvasViewer } from '@/components/board/CanvasViewer';
import { parseSharedCanvas, type CanvasLayouts } from '@/domain/board/canvasLayout';
import { saveSharedCanvas } from '@/data/repositories/boardCanvas.repo';
import { useNavigate } from 'react-router-dom';

import { AppShell } from '@/components/common/AppShell';
import { FilterBar } from '@/components/board/FilterBar';
import { DenahView } from '@/components/board/DenahView';
import { ARCHIVE_REASON_LABELS } from '@/domain/archive';
import type { ArchiveReason } from '@/domain/types';

import { CanvasBoard } from '@/components/board/CanvasBoard';
import { StickyNoteCard } from '@/components/board/StickyNoteCard';
import { CanvasStickers, CardStickers } from '@/components/board/CanvasStickers';
import { useBoardStickers } from '@/hooks/useBoardStickers';
import { createBoardNote } from '@/data/repositories/boardNotes.repo';
import { activeBoardNotes, noteIdFromCanvasId, stickyCanvasId } from '@/domain/boardNotes';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { usePersistentIdSet } from '@/hooks/usePersistentIdSet';
import { MasonryGrid, MasonryItem } from '@/components/board/MasonryGrid';
import { LabSheet } from '@/components/patient/LabSheet';
import { copyText } from '@/lib/clipboard';
import { PatientCard } from '@/components/board/PatientCard';
import { PatientPeekWindow } from '@/components/board/PatientPeekWindow';
import { QuickChecklistSheet } from '@/components/board/QuickChecklistSheet';
import { IconMore, IconSearch } from '@/components/common/Icons';
import { Sheet } from '@/components/common/Sheet';
import { useHideOnScroll } from '@/hooks/useHideOnScroll';
import { NoteSearchToggle, useSearchNotesPreference } from '@/components/archive/NoteSearchToggle';
import { useArchiveText } from '@/hooks/useArchiveText';
import { matchArchived, searchTokens } from '@/domain/archiveSearch';
import { useClinicalToday } from '@/hooks/useClinicalToday';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { archivePatient, createBlankPatient } from '@/data/repositories/patients.repo';
import { usePatients } from '@/hooks/usePatients';
import { setPatientStatus } from '@/data/repositories/patients.repo';
import {
  availableLabels,
  availableWards,
  buildCard,
  filterPatients,
  hasActiveFilters,
  groupLabel,
  orderPatients,
  reorderBoard,
  sortPatients,
  EMPTY_FILTERS,
  type BoardFilters,
  type BoardOrder,
} from '@/domain/board';
import { pendingFilters } from '@/domain/checklist';
import { useSession } from '@/store/useSession';

export default function BoardPage(): JSX.Element {
  const today = useClinicalToday();
  const navigate = useNavigate();
  const uid = useSession((state) => state.user?.uid ?? null);

  /**
   * SPEC 1.2 rule 5 — nothing between the tap and a cursor in a blank note.
   * The record is created locally and navigated to immediately; the write is
   * never awaited, so this works with no signal.
   */
  /**
   * New patients land in the list you are LOOKING AT.
   *
   * Not a prompt on every admission. The choice is real but lopsided — almost
   * every new patient is an ordinary one — and a modal on the most-pressed
   * button of the day charges every admission for the rare case. Inheriting
   * the scope gets it right without a tap: you are on Titipan because you are
   * dealing with a titipan patient.
   *
   * The choice is not hidden, it is MOVED: the new patient's page offers both
   * lists as a segmented control for as long as the note is still blank, where
   * it costs nothing to ignore and one tap to correct. A wrong guess here is
   * visible immediately and reversible from the same screen.
   */
  const createAndOpen = useCallback(() => {
    if (!uid) return;
    const { id, written } = createBlankPatient(uid, today, scopeRef.current === 'temporary');
    void written.catch((error: unknown) => console.error('[board] create rejected', error));
    navigate(`/p/${id}/${today}`);
  }, [uid, today, navigate]);
  const settings = useSession((state) => state.settings());
  const { patients, loading, error } = usePatients('active');

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<BoardFilters>(EMPTY_FILTERS);
  const [quickPatientId, setQuickPatientId] = useState<string | null>(null);
  /**
   * The lab extractor, reachable without opening a patient.
   *
   * A lab PDF often arrives before you know which chart it belongs to, and
   * having to open some patient first meant opening the wrong one to use a tool
   * that is not about them. Here it just copies; inserting still happens on the
   * patient page, where there is a note to insert into.
   */
  const [labOpen, setLabOpen] = useState(false);

  /**
   * Night-shift patients are held apart, not mixed in.
   *
   * They are covered for one shift and handed back, so they do not belong in a
   * count of "my patients" — a board that says twelve when four of them go home
   * with someone else at 7am is not telling you what you need. Same cards, same
   * checklist, separate list.
   */
  /**
   * Remembered, like the board order.
   *
   * It reset to "mine" on every navigation, so marking a patient as titipan and
   * coming back showed them gone from the list you were looking at — which is
   * indistinguishable from the flag not having saved. That is almost certainly
   * the "selalu kembali ke pasien utama": the write was fine, the tab was not.
   */
  /**
   * The scope, readable from a callback that must not change identity.
   *
   * `createAndOpen` is memoised and passed to a button; adding `scope` to its
   * dependency list would rebuild it on every tab switch for the sake of one
   * boolean read at press time.
   */
  const scopeRef = useRef<'mine' | 'temporary'>('mine');

  const [scope, setScope] = useState<'mine' | 'temporary'>(() => {
    try {
      return localStorage.getItem('visite.boardScope') === 'temporary' ? 'temporary' : 'mine';
    } catch {
      return 'mine';
    }
  });

  scopeRef.current = scope;

  /** The stickers of the scope on screen: one list, drawn by the canvas and by each card. */
  const stickerState = useBoardStickers(scope);

  const changeScope = (next: 'mine' | 'temporary'): void => {
    setScope(next);
    try {
      localStorage.setItem('visite.boardScope', next);
    } catch (error) {
      console.warn('[board] scope preference not saved', error);
    }
  };

  /**
   * Board order, remembered across sessions.
   *
   * `location` walks the ward the way the denah is laid out, which is the order
   * a round is actually done in. Stored in localStorage rather than settings
   * because it is a per-device view preference, not a fact about the user —
   * the phone in your pocket and the laptop at the desk are used differently.
   */
  const [order, setOrder] = useState<BoardOrder>(() => {
    try {
      const stored = localStorage.getItem('visite.boardOrder');
      return stored === 'location' || stored === 'visite' || stored === 'dpjp' || stored === 'custom'
        ? stored
        : 'recent';
    } catch {
      return 'recent';
    }
  });

  const changeOrder = (next: BoardOrder): void => {
    setOrder(next);
    try {
      localStorage.setItem('visite.boardOrder', next);
    } catch (error) {
      console.warn('[board] order preference not saved', error);
    }
  };

  /**
   * The hand-made order, as a list of patient ids.
   *
   * Beside the order preference in localStorage, for the same reason and with
   * the same tradeoff: it is a view arrangement, not a fact about the patient,
   * and keeping it out of Firestore means dragging a card writes nothing to
   * the server. The cost is that an order built on the phone is not the order
   * on the laptop — say so if that turns out to be the wrong side of it.
   */
  const [customIds, setCustomIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('visite.boardCustomOrder');
      const parsed: unknown = stored ? JSON.parse(stored) : null;
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  });

  // Read by the drag's window listeners, which outlive the render they
  // were created in.
  const customIdsRef = useRef(customIds);
  customIdsRef.current = customIds;

  const saveCustomIds = (ids: string[]): void => {
    setCustomIds(ids);
    customIdsRef.current = ids;
    try {
      localStorage.setItem('visite.boardCustomOrder', JSON.stringify(ids));
    } catch (error) {
      console.warn('[board] custom order not saved', error);
    }
  };

  /**
   * The card currently in hand, or null.
   *
   * Pointer events, not HTML5 drag-and-drop. The latter never fires on touch,
   * and this board is used one-handed on a phone on a ward round — a
   * reordering gesture that works only with a mouse is a reordering gesture
   * that does not work.
   */
  const [draggingId, setDraggingId] = useState<string | null>(null);

  /**
   * Multi-select, off by default.
   *
   * A mode rather than a checkbox on every card. The board's primary action is
   * opening a patient, and a permanent checkbox on each card both crowds it
   * and puts a destructive target next to the one you tap all day.
   */
  /** The patient whose note is being previewed, or null. */
  /**
   * Every peek window currently open, oldest first.
   *
   * An array rather than one id: the array IS the z-order, so bringing a
   * window forward is moving its id to the end and nothing has to track a
   * separate stacking number that can drift out of step with the list.
   */
  const [previewIds, setPreviewIds] = useState<string[]>([]);

  /** Cards folded to name and DPJP, remembered per device. */
  const [cardsFolded, toggleFolded] = usePersistentIdSet('visite.board.cardsFolded');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const toggleSelected = (patientId: string): void => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(patientId)) next.delete(patientId);
      else next.add(patientId);
      return next;
    });
  };

  const leaveSelection = (): void => {
    setSelecting(false);
    setSelected(new Set());
  };

  /**
   * Archive every selected patient, with one reason for the batch.
   *
   * A reason is asked for rather than defaulted. `ARCHIVE_REASON_LABELS` is
   * what the archive is later browsed and filtered by, and a batch filed under
   * a guessed reason is worse than an unfiled one — it is wrong in a way
   * nobody will re-check. Batching is honest here: the case this exists for is
   * the end of a round where several patients went home the same day, which is
   * one reason by construction.
   *
   * Archiving is not deletion — every entry, checklist day and revision
   * survives and the patient stays copyable. That is why it needs no
   * confirmation step beyond naming the reason.
   */
  const [archiveReason, setArchiveReason] = useState<ArchiveReason | null>(null);

  const archiveSelected = (reason: ArchiveReason): void => {
    for (const patientId of selected) {
      void archivePatient(patientId, reason).catch((error: unknown) =>
        console.error('[board] archive rejected', error),
      );
    }
    setArchiveReason(null);
    leaveSelection();
  };

  const trashSelected = (): void => {
    // Moving to the trash is reversible and needs no confirmation; emptying
    // the trash is the step that asks.
    for (const patientId of selected) void setPatientStatus(patientId, 'trashed');
    leaveSelection();
  };

  const onDragHandleDown = (event: React.PointerEvent, patientId: string): void => {
    const handle = event.currentTarget as HTMLElement;
    // Capture, so the gesture keeps reporting even when the finger leaves the
    // small handle — which it does immediately, because the point is to move
    // away from it.
    handle.setPointerCapture(event.pointerId);
    setDraggingId(patientId);

    const cardUnder = (clientX: number, clientY: number): string | null => {
      // `elementFromPoint` rather than measuring every card: the board is a
      // masonry column layout, so a card's position is not derivable from its
      // index, and re-measuring the lot on every move is work per frame.
      const element = document.elementFromPoint(clientX, clientY);
      return element?.closest<HTMLElement>('[data-patient-id]')?.dataset.patientId ?? null;
    };

    const onMove = (move: PointerEvent): void => {
      const targetId = cardUnder(move.clientX, move.clientY);
      if (!targetId || targetId === patientId) return;
      /**
       * Reorder DURING the drag, not on drop.
       *
       * The list rearranging under the finger is the feedback that the gesture
       * is working; without it the board sits still until release and the only
       * way to find out where a card landed is to let go.
       */
      saveCustomIds(
        reorderBoard(
          cards.map((card) => card.patient),
          patientId,
          targetId,
          { stored: customIdsRef.current, all: patients.map((patient) => patient.id) },
        ),
      );
    };

    const onUp = (): void => {
      setDraggingId(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    // `pointercancel` fires when the browser takes the gesture over — a scroll
    // it decided was a scroll, a call arriving. Without it the listeners stay
    // attached and the next tap anywhere moves a card.
    window.addEventListener('pointercancel', onUp);
  };

  /**
   * Is there room for a canvas at all?
   *
   * `lg` is where the masonry itself goes to three columns, which is the point
   * at which arranging cards side by side becomes a thing you can do rather
   * than a thing you can describe.
   */
  const canvasWidth = useMediaQuery('(min-width: 1024px)');
  /**
   * On a phone in Urutan sendiri: the laptop's canvas scaled down, or the
   * plain list. Per device, like the order itself.
   */
  const [phoneView, setPhoneViewState] = useState<'canvas' | 'list'>(() => {
    try {
      return localStorage.getItem('visite.board.phoneView') === 'list' ? 'list' : 'canvas';
    } catch {
      return 'canvas';
    }
  });
  const setPhoneView = (next: 'canvas' | 'list'): void => {
    setPhoneViewState(next);
    try {
      localStorage.setItem('visite.board.phoneView', next);
    } catch {
      // Per-device convenience only.
    }
  };

  /**
   * A callback ref, not `useRef`: the canvas needs to RE-RENDER once the slot
   * exists, and a ref object mutating does not cause that — the portal would
   * be told about a node that was null on the render it was decided in and
   * never look again.
   */
  const [canvasActions, setCanvasActions] = useState<HTMLElement | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  /**
   * The drag hint, shown until dismissed once. It was a permanent line of the
   * pinned header in Urutan sendiri: useful the first time, 20 px of a pinned
   * header every time after.
   */
  const [dragHintSeen, setDragHintSeen] = useState(() => {
    try {
      return localStorage.getItem('visite.board.dragHintSeen') === '1';
    } catch {
      return false;
    }
  });
  const dismissDragHint = (): void => {
    setDragHintSeen(true);
    try {
      localStorage.setItem('visite.board.dragHintSeen', '1');
    } catch {
      // No storage: hidden for this visit.
    }
  };


  const debouncedQuery = useDebouncedValue(query, 150);

  /**
   * The archive is searched too, but only while searching.
   *
   * A patient discharged last week is exactly who you look for by name, and
   * "not found" on the board is indistinguishable from "does not exist" —
   * which sends someone to create a duplicate record. The second listener
   * attaches only when there is a query, so an idle board still costs one.
   */
  const searching = debouncedQuery.trim().length > 0;

  /**
   * Sticky notes. Hidden while searching or selecting: a search asks "which
   * patient", and a note matching nothing would sit in the result looking like
   * an answer; in selection mode a tap means "tick", and a note cannot be
   * ticked for archive.
   */
  const rawBoardNotes = useSession((state) => state.profile?.boardNotes);
  const boardNotes = useMemo(() => activeBoardNotes(rawBoardNotes), [rawBoardNotes]);
  const showStickies = !searching && !selecting;
  const addSticky = (): void => {
    if (uid) createBoardNote(uid);
  };
  const { patients: archived } = usePatients('archived', searching);
  const [searchNotes, setSearchNotes] = useSearchNotesPreference();
  const archiveText = useArchiveText(archived, searching && searchNotes);

  const items = settings.checklistItems;
  const reminderKinds = settings.reminderKinds ?? DEFAULT_REMINDER_KINDS;

  /** The whole scope, unfiltered: what the canvas must make room for. */
  const scopeIds = useMemo(
    () =>
      orderPatients(
        patients.filter((patient) =>
          scope === 'temporary' ? patient.temporary === true : patient.temporary !== true,
        ),
        order,
        customIds,
      ).map((patient) => patient.id),
    [patients, scope, order, customIds],
  );

  /** One canvas cell: a sticky note or a patient card. Shared by the laptop canvas and the phone viewer. */
  const renderCanvasItem = (
    id: string,
    {
      fitHeight,
      onHeightBounds,
      maxPreviewLines,
    }: {
      fitHeight: boolean;
      onHeightBounds?: (bounds: { min: number; max: number }) => void;
      maxPreviewLines: number;
    },
  ): ReactNode => {
    const noteId = noteIdFromCanvasId(id);
    if (noteId !== null) {
      const entry = boardNotes.find((candidate) => candidate.id === noteId);
      return entry && uid ? (
        <StickyNoteCard
          uid={uid}
          id={entry.id}
          note={entry.note}
          fitHeight={fitHeight}
          onHeightBounds={onHeightBounds}
        />
      ) : null;
    }
    const card = cards.find((entry) => entry.patient.id === id);
    if (!card) return null;
    return (
      <PatientCard
        card={card}
        fitHeight={fitHeight}
        onHeightBounds={onHeightBounds}
        maxPreviewLines={maxPreviewLines}
        collapsed={cardsFolded.has(card.patient.id)}
        onToggleCollapsed={toggleFolded}
        onLongPress={setQuickPatientId}
        selectable={selecting}
        checked={selected.has(card.patient.id)}
        onToggleSelected={toggleSelected}
        onPreview={
          selecting
            ? undefined
            : (id: string) =>
                setPreviewIds((current) =>
                  // Re-peeking an open window brings it forward
                  // rather than opening a second copy of it.
                  current.includes(id)
                    ? [...current.filter((x) => x !== id), id]
                    : [...current, id]
                )
        }
      />
    );
  };

  /*
    The canvas mirrored to the account, for the phone (see SharedCanvas).
    Debounced: a drag ends in one stored change, but a resize of the window
    produces a burst. Skipped when nothing differs from what is already there.
  */
  const rawSharedCanvas = useSession((state) => state.profile?.boardCanvas);
  const sharedCanvas = useMemo(() => parseSharedCanvas(rawSharedCanvas), [rawSharedCanvas]);
  const mirrorTimer = useRef<number | undefined>(undefined);
  const lastMirrored = useRef<string | null>(null);
  const mirrorCanvas = useCallback(
    (layouts: CanvasLayouts, width: number) => {
      if (!uid) return;
      window.clearTimeout(mirrorTimer.current);
      mirrorTimer.current = window.setTimeout(() => {
        const key = JSON.stringify({ layouts, width: Math.round(width) });
        const remoteKey = sharedCanvas
          ? JSON.stringify({ layouts: sharedCanvas.layouts, width: Math.round(sharedCanvas.width) })
          : null;
        if (key === lastMirrored.current || key === remoteKey) return;
        lastMirrored.current = key;
        void saveSharedCanvas(uid, { layouts, width: Math.round(width), at: Date.now() }).catch(
          (error: unknown) => console.warn('[board] canvas not mirrored', error),
        );
      }, 2000);
    },
    [uid, sharedCanvas],
  );

  const cards = useMemo(() => {
    const matched = filterPatients(
      patients.filter((patient) =>
        scope === 'temporary' ? patient.temporary === true : patient.temporary !== true,
      ),
      { ...filters, query: debouncedQuery },
      items,
      today,
    );
    return orderPatients(matched, order, customIds).map((patient) =>
      buildCard(patient, items, today, settings.privacy.boardShowInitialsOnly, reminderKinds),
    );
  }, [
    patients,
    scope,
    filters,
    debouncedQuery,
    items,
    today,
    order,
    customIds,
    settings.privacy.boardShowInitialsOnly,
    reminderKinds,
  ]);

  /*
    A selection is of cards ON SCREEN. It used to survive a scope switch or a
    search, so "Pindahkan ke sampah" also trashed patients picked in the other
    view and no longer visible; only the count hinted at it.
  */
  useEffect(() => {
    const visible = new Set(cards.map((card) => card.patient.id));
    setSelected((current) => {
      const kept = [...current].filter((id) => visible.has(id));
      return kept.length === current.size ? current : new Set(kept);
    });
  }, [cards]);

  const temporaryCount = useMemo(
    () => patients.filter((patient) => patient.temporary === true).length,
    [patients],
  );

  /**
   * Cards grouped under their heading, in the order they already sit in.
   *
   * Grouping is a render concern, not a sort: the sort put them in walking
   * order, and this only inserts a heading each time the room changes. Doing it
   * the other way round — grouping first, then sorting groups — is how a board
   * ends up with Kamar 410 before Kamar 401.
   */
  const groups = useMemo(() => {
    // `custom` is flat like `recent`: the user arranged these by hand, and
    // inserting room or consultant headings would cut their arrangement into
    // sections it does not have.
    if (order === 'recent' || order === 'custom') return [{ label: '', cards }];

    const result: Array<{ label: string; cards: typeof cards }> = [];
    for (const card of cards) {
      const label = card.patient.pinned ? 'Disematkan' : groupLabel(card.patient, order);
      const last = result[result.length - 1];
      if (last && last.label === label) last.cards.push(card);
      else result.push({ label, cards: [card] });
    }
    return result;
  }, [cards, order]);

  /*
    Archived matches, with the notes searched too when that is switched on.
    `snippet` says where in the notes the words were found, so a match from
    inside a SOAP is not a card that seems to match nothing.
  */
  const archivedCards = useMemo(() => {
    if (!searching) return [];
    const tokens = searchTokens(debouncedQuery);
    return sortPatients(filterPatients(archived, { ...filters, query: '' }, items, today))
      .map((patient) => matchArchived(patient, tokens, archiveText.text(patient)))
      .filter((match): match is NonNullable<typeof match> => match !== null)
      .map((match) => ({
        ...buildCard(match.patient, items, today, settings.privacy.boardShowInitialsOnly, reminderKinds),
        snippet: match.snippet
          ? privateText(match.snippet, match.patient, settings.privacy.boardShowInitialsOnly)
          : match.snippet,
      }));
  }, [
    searching,
    archived,
    filters,
    debouncedQuery,
    items,
    today,
    settings.privacy.boardShowInitialsOnly,
    reminderKinds,
    archiveText,
  ]);

  // Archived search results are long-pressable too; they were looked up only
  // among active patients, so the long-press did nothing.
  const quickPatient =
    patients.find((patient) => patient.id === quickPatientId) ??
    archived.find((patient) => patient.id === quickPatientId) ??
    null;
  const filtering = hasActiveFilters({ ...filters, query: debouncedQuery });

  const headerRef = useRef<HTMLDivElement>(null);
  /*
    Phone and tablet only, and never while searching or selecting: the header
    is then the thing being used, and hiding it under the keyboard or mid-
    selection would take the control away from the hand using it.
  */
  const headerHidden = useHideOnScroll(headerRef, !canvasWidth && !searching && !selecting);

  /** The order dropdown: in the single row on a laptop, row two on a phone. */
  const orderControl = (
    <label className={`${CONTROL} flex min-w-0 flex-1 items-center gap-1 rounded-lg border border-border bg-surface pl-3 text-xs text-fg-muted lg:flex-none`}>
      Urutan
      <select
        value={order}
        onChange={(event) => changeOrder(event.target.value as BoardOrder)}
        aria-label="Urutan kartu"
        className="min-w-0 flex-1 cursor-pointer bg-transparent py-1.5 pr-2 font-semibold text-fg outline-none"
      >
        <option value="recent">Terbaru</option>
        <option value="location">Denah</option>
        <option value="visite">Urutan visite</option>
        <option value="dpjp">Per DPJP</option>
        <option value="custom">Urutan sendiri</option>
      </select>
    </label>
  );

  return (
    <AppShell title="Aktif">
      {/*
        THE HEADER STAYS; ONLY THE CARDS SCROLL.

        Search, scope, order and the actions used to scroll away with the
        board, so changing the order or searching from halfway down a long
        board meant scrolling back up first. Pinned to the top of the page's
        scroller, opaque, so cards pass cleanly underneath it.
      */}
      <div
        ref={headerRef}
        className={[
          'sticky top-0 z-20 border-b border-border bg-bg transition-transform duration-200',
          headerHidden ? '-translate-y-full' : 'translate-y-0',
        ].join(' ')}
      >
      {/*
        ONE ROW ON A LAPTOP, TWO ON A PHONE.

        Pinning the header made its size matter: four stacked rows (search;
        scope chips; four order chips plus actions; a hint line) took about a
        third of a laptop screen. The same controls now fit one row:

          search · Saya|Titipan · Urutan ▾ · [canvas actions] · actions · +Pasien baru

        - Scope is one segmented switch, not two pills on their own row.
        - The four order chips are one dropdown. Exactly one is ever on, which
          is what a select is for, and it costs one control's width.
        - Controls are 36 px tall with a mouse and 44 px on touch
          (`CONTROL`): the tap-target rule is about fingers.
        - On a phone the actions go behind ⋯, and the header hides while
          scrolling down and returns on scroll up (`useHideOnScroll`).
      */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 lg:flex-nowrap">
        <label className={`${CONTROL} flex min-w-0 flex-1 basis-40 items-center gap-2 rounded-lg border border-border bg-surface px-3 lg:max-w-sm`}>
          <IconSearch className="shrink-0 text-fg-faint" width={16} height={16} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Cari pasien"
            placeholder="Cari nama, RM, bed, diagnosis…"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none"
          />
        </label>

        {/* Titipan only exists when there are some; a one-option switch is
            not a control. */}
        {temporaryCount > 0 || scope === 'temporary' ? (
          <div role="group" aria-label="Daftar pasien" className="flex shrink-0 rounded-lg bg-bg-subtle p-0.5">
            {(
              [
                ['mine', 'Saya', patients.length - temporaryCount],
                ['temporary', 'Titipan', temporaryCount],
              ] as const
            ).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                aria-pressed={scope === value}
                onClick={() => changeScope(value)}
                className={[
                  `${CONTROL} rounded-md px-2.5 text-xs`,
                  scope === value ? 'bg-surface font-semibold text-accent shadow-sm' : 'text-fg-muted',
                ].join(' ')}
              >
                {label} <span className="font-normal opacity-70">{count}</span>
              </button>
            ))}
          </div>
        ) : null}

        {canvasWidth ? orderControl : null}

        {canvasWidth ? (
          <>
            {/*
              Where the canvas puts Rapikan / Urungkan / Penanda: portalled
              into this `contents` span so they sit in the row as if written
              here. Desktop only, which is the only place the canvas exists.
            */}
            <span ref={setCanvasActions} className="contents" />
            <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />
            <button
              type="button"
              onClick={addSticky}
              disabled={!uid}
              title="Tempel catatan singkat di papan"
              className={`${CONTROL} shrink-0 rounded-lg px-2.5 text-xs font-medium text-fg hover:bg-bg-subtle`}
            >
              + Catatan
            </button>
            <button
              type="button"
              onClick={() => setLabOpen(true)}
              className={`${CONTROL} shrink-0 rounded-lg px-2.5 text-xs font-medium text-fg hover:bg-bg-subtle`}
            >
              Format lab
            </button>
            <SelectButton selecting={selecting} onToggle={() => (selecting ? leaveSelection() : setSelecting(true))} />
          </>
        ) : null}

        {/* From tablet up the primary action sits in the row; on a phone it
            is the floating + in the corner. */}
        <button
          type="button"
          onClick={createAndOpen}
          className={`${CONTROL} hidden shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-white sm:flex lg:ml-auto`}
        >
          <span aria-hidden="true" className="text-base leading-none">+</span>
          Pasien baru
        </button>
      </div>

      {/* Phone and tablet: the occasional actions behind one button. Pilih
          stays visible while selecting, because it is how you leave. */}
      {!canvasWidth ? (
        <div className="-mt-1 flex items-center gap-2 px-4 pb-2">
          {orderControl}
          {selecting ? (
            <SelectButton selecting onToggle={leaveSelection} />
          ) : (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-label="Aksi lain"
              className="flex min-h-tap items-center gap-1 rounded-lg px-2 text-xs font-medium text-fg-muted"
            >
              <IconMore width={18} height={18} /> Aksi
            </button>
          )}
        </div>
      ) : null}

      {searching ? (
        <div className="px-4 pb-1">
          <NoteSearchToggle on={searchNotes} onChange={setSearchNotes} status={archiveText} />
        </div>
      ) : null}

      {selecting ? (
        <div className="mb-2 space-y-2 rounded-lg border border-border px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex-1 text-xs text-fg-muted">
              {selected.size === 0
                ? 'Ketuk kartu untuk memilih.'
                : `${selected.size} pasien dipilih`}
            </span>
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={() => setArchiveReason((current) => (current ? null : 'pulang'))}
              aria-expanded={archiveReason !== null}
              className="min-h-tap rounded-lg px-3 text-xs font-medium text-fg disabled:opacity-40"
            >
              Arsipkan
            </button>
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={trashSelected}
              className="min-h-tap rounded-lg px-3 text-xs font-medium text-danger disabled:opacity-40"
            >
              Pindahkan ke sampah
            </button>
          </div>

          {/*
            The reason, asked before anything is written.

            Opening a second row rather than a dialog: the selection is on
            screen behind it and staying able to see WHAT is about to be
            archived is most of the safety here.
          */}
          {archiveReason !== null && selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
              <span className="text-xs text-fg-muted">Alasan:</span>
              {(Object.keys(ARCHIVE_REASON_LABELS) as ArchiveReason[]).map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => archiveSelected(reason)}
                  className="min-h-tap rounded-lg border border-border px-3 text-xs font-medium"
                >
                  {ARCHIVE_REASON_LABELS[reason]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/*
        Says the handle is there.

        A gesture with no on-screen trace is one that gets forgotten between
        shifts, and the grip is deliberately quiet so it does not compete with
        the card. One line, only in the mode where it applies.
      */}
      {order === 'custom' && !dragHintSeen ? (
        <p className="flex items-center gap-2 px-4 pb-2 text-[11px] text-fg-faint">
          <span className="flex-1">Seret ⠿ untuk menyusun ulang. Urutan tersimpan di perangkat ini.</span>
          <button
            type="button"
            onClick={dismissDragHint}
            className="min-h-tap shrink-0 px-2 text-accent [@media(pointer:fine)]:min-h-8"
          >
            Mengerti
          </button>
        </p>
      ) : null}
      </div>

      {/* Filters hidden for now. The row of "Belum …" chips ate
          the top of the board and pushed the cards below the fold before there
          were enough patients for filtering to earn that space. The state and
          the component are untouched — restoring it is deleting this comment
          and the `false &&`. */}
      {false && (
        <FilterBar
          wards={availableWards(patients)}
          labels={availableLabels(patients)}
          pending={pendingFilters(items)}
          filters={filters}
          onChange={setFilters}
        />
      )}

      {/*
        Its own stacking context: canvas cards raise themselves with z-index
        up to 40 (bring-to-front), and without this they would paint over the
        pinned header as they scroll under it. Peek windows stay outside.
      */}
      <div className="isolate">
      {error ? (
        <p role="alert" className="px-4 py-6 text-center text-sm text-danger">
          {error}
        </p>
      ) : loading ? (
        <p className="px-4 py-10 text-center text-sm text-fg-muted">Memuat…</p>
      ) : cards.length === 0 && archivedCards.length === 0 ? (
        <EmptyState filtering={filtering} onCreate={createAndOpen} />
      ) : (
        <>
          {/* Headed only while searching. On an idle board the heading would be
              noise — there is nothing to distinguish it from. */}
          {!canvasWidth && order === 'custom' && !searching && cards.length > 0 ? (
            <div className="flex items-center gap-2 px-4 pb-2 pt-1">
              <div role="group" aria-label="Tampilan" className="flex overflow-hidden rounded-lg border border-border text-xs">
                {(
                  [
                    ['canvas', 'Kanvas'],
                    ['list', 'Daftar'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={phoneView === value}
                    onClick={() => setPhoneView(value)}
                    className={[
                      'min-h-tap px-3',
                      phoneView === value ? 'bg-accent font-semibold text-white' : 'text-fg-muted',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {phoneView === 'canvas' && !sharedCanvas ? (
                <span className="min-w-0 flex-1 text-[11px] text-fg-muted">
                  Belum ada kanvas: atur dulu di laptop (Urutan sendiri), lalu muncul di sini.
                </span>
              ) : null}
            </div>
          ) : null}

          {searching && cards.length > 0 ? (
            <SectionHeading label={`Pasien aktif (${cards.length})`} />
          ) : null}

          {cards.length > 0 && order === 'location' ? (
            <DenahView
              patients={cards.map((card) => card.patient)}
              today={today}
              showInitialsOnly={settings.privacy.boardShowInitialsOnly}
            />
          ) : cards.length > 0 && order === 'custom' && canvasWidth ? (
            /*
              THE FREE CANVAS, and why it is only here.

              `custom` is the one order that means "I decided where these go",
              so it is the only one where a hand position is not immediately
              contradicted by a sort. On `Terbaru` or `Denah` a dragged card
              would move back the moment anything changed, which teaches the
              user the drag does not work.

              Below `lg` the masonry renders instead. A canvas needs room for
              cards to be beside each other, and a phone has room for one
              column — where "where you put it" degenerates into a list, and a
              worse one, because the gaps arranged on a desktop survive as dead
              space you scroll through.
            */
            <CanvasBoard
              enabled
              seed={sharedCanvas?.layouts}
              onStoredChange={mirrorCanvas}
              /*
                Notes AFTER patients: the canvas auto-places in this order, so a
                new note takes the next free slot instead of pushing every
                arranged card down one.
              */
              ids={[
                ...cards.map((card) => card.patient.id),
                ...(showStickies ? boardNotes.map((entry) => stickyCanvasId(entry.id)) : []),
              ]}
              layoutIds={[
                ...scopeIds,
                ...boardNotes.map((entry) => stickyCanvasId(entry.id)),
              ]}
              actionsSlot={canvasActions}
              // Stickers are hidden while searching or selecting, like the
              // sticky notes and for the same reason: neither answers "which
              // patient" and neither can be ticked.
              overlay={(surfaceRef) => (
                <CanvasStickers
                  surfaceRef={surfaceRef}
                  enabled={showStickies}
                  actionsSlot={canvasActions}
                  state={stickerState}
                />
              )}
              renderInCard={(id) =>
                showStickies ? <CardStickers cardId={id} state={stickerState} /> : null
              }
              // Why a card is shown at natural height, if it is: folded to
              // one line, or its note is open. See `isUncapped` on the canvas
              // for how the two differ.
              isUncapped={(id) => {
                if (noteIdFromCanvasId(id) !== null) return false;
                if (cardsFolded.has(id)) return 'folded';
                // A note never uncaps a card any more: it opens in a
                // floating panel (PatientCard → NotePopover).
                return false;
              }}
              renderItem={renderCanvasItem}
            />
          ) : cards.length > 0 && order === 'custom' && sharedCanvas && phoneView === 'canvas' ? (
            <CanvasViewer
              ids={[
                ...cards.map((card) => card.patient.id),
                ...(showStickies ? boardNotes.map((entry) => stickyCanvasId(entry.id)) : []),
              ]}
              layouts={sharedCanvas.layouts}
              width={sharedCanvas.width}
              renderItem={(id, options) => renderCanvasItem(id, options)}
            />
          ) : cards.length > 0 ? (
            <>
            {/*
              Outside the canvas the notes sit in their own row above the
              patients. Masonry places by measurement, not by hand, so there is
              nowhere a note could be "left" among the cards; a row of their
              own keeps them findable and out of the patient order.
            */}
            {showStickies && boardNotes.length > 0 && uid ? (
              <MasonryGrid>
                {boardNotes.map((entry) => (
                  <MasonryItem key={stickyCanvasId(entry.id)}>
                    <StickyNoteCard uid={uid} id={entry.id} note={entry.note} />
                  </MasonryItem>
                ))}
              </MasonryGrid>
            ) : null}
            {groups.map((group) => (
              <section key={group.label || 'all'}>
                {group.label ? <SectionHeading label={group.label} /> : null}
                {/* Grid masonry rather than CSS multi-column, so a card with
                    its note open can span two columns and grow to the RIGHT.
                    Nothing inside a multicol column can be wider than the
                    column — see MasonryGrid for why that ruled it out. */}
                <MasonryGrid>
                  {group.cards.map((card) => (
                    <MasonryItem key={card.patient.id}>
                    <PatientCard
                      card={card}
                      collapsed={cardsFolded.has(card.patient.id)}
                      onToggleCollapsed={toggleFolded}
                      onLongPress={setQuickPatientId}
                      onDragHandleDown={
                        order === 'custom' && !selecting ? onDragHandleDown : undefined
                      }
                      dragging={draggingId === card.patient.id}
                      selectable={selecting}
                      checked={selected.has(card.patient.id)}
                      onToggleSelected={toggleSelected}
                      // Not offered while selecting: in that mode a tap means
                      // "tick this", and a second meaning on the same card is
                      // how the wrong one gets ticked.
                      onPreview={
                      selecting
                        ? undefined
                        : (id: string) =>
                            setPreviewIds((current) =>
                              // Re-peeking an open window brings it forward
                              // rather than opening a second copy of it.
                              current.includes(id)
                                ? [...current.filter((x) => x !== id), id]
                                : [...current, id]
                            )
                    }
                    />
                    </MasonryItem>
                  ))}
                </MasonryGrid>
              </section>
            ))}
            </>
          ) : searching ? (
            <p className="px-4 py-3 text-sm text-fg-muted">
              Tidak ada pasien aktif yang cocok.
            </p>
          ) : null}

          {searching && archivedCards.length > 0 ? (
            <>
              <SectionHeading label={`Arsip (${archivedCards.length})`} />
              <MasonryGrid>
                {archivedCards.map((card) => (
                  <MasonryItem key={card.patient.id}>
                    <PatientCard card={card} onLongPress={setQuickPatientId} />
                    {card.snippet ? (
                      <p className="px-2 pt-1 text-[11px] italic leading-snug text-fg-muted">
                        {card.snippet}
                      </p>
                    ) : null}
                  </MasonryItem>
                ))}
              </MasonryGrid>
            </>
          ) : null}
        </>
      )}
      </div>

      <button
        type="button"
        onClick={createAndOpen}
        aria-label="Pasien baru"
        // Phone only — the tablet/desktop equivalent lives beside the search box.
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+76px)] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-white shadow-lg sm:hidden"
      >
        +
      </button>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen} title="Aksi">
        <div className="space-y-2 p-4">
          {[
            ['+ Catatan tempel', () => addSticky()],
            ['Format lab', () => setLabOpen(true)],
            ['Pilih pasien (arsipkan / sampah)', () => setSelecting(true)],
          ].map(([label, run]) => (
            <button
              key={label as string}
              type="button"
              onClick={() => {
                setMoreOpen(false);
                (run as () => void)();
              }}
              className="min-h-tap w-full rounded-lg border border-border px-3 text-left text-sm font-medium"
            >
              {label as string}
            </button>
          ))}
        </div>
      </Sheet>

      <LabSheet
        open={labOpen}
        onOpenChange={setLabOpen}
        date={today}
        onInsert={(text) => void copyText(text)}
      />

      {/*
        A window, not a sheet.

        The peek is used WHILE looking at the board — comparing a plan against
        the card beside it, keeping a note open while writing a report. A sheet
        covers the board, so those two things alternate instead of being
        visible together.
      */}
      {/*
        Several at once, and that is the point of a window.

        One peek at a time is a sheet with extra steps. The case this exists
        for is comparing two patients, or keeping one open while working
        through the others — both need more than one.

        Focus order is the array order, so pressing a window moves it to the
        end and therefore to the front. Last-touched-on-top is the rule every
        window manager uses and the only one nobody has to be told.
      */}
      {previewIds.map((id, index) => {
        // Looked up in the full patient list, not in `cards`: a window must
        // not vanish because a filter or a search stopped matching the patient
        // it is showing.
        const peeked = patients.find((candidate) => candidate.id === id) ?? null;
        if (!peeked) return null;
        return (
          <PatientPeekWindow
            key={id}
            patient={peeked}
            today={today}
            index={index}
            z={40 + index}
            onFocus={() =>
              setPreviewIds((current) =>
                current.at(-1) === id ? current : [...current.filter((x) => x !== id), id],
              )
            }
            onClose={() => setPreviewIds((current) => current.filter((x) => x !== id))}
          />
        );
      })}

      <QuickChecklistSheet
        patient={quickPatient}
        items={items}
        today={today}
        onOpenChange={(open) => {
          if (!open) setQuickPatientId(null);
        }}
      />
    </AppShell>
  );
}

/**
 * Control height: 44 px for a finger, 36 px for a mouse. The 44 px rule is
 * about fingers; on a laptop it made every chip in the pinned header half
 * again as tall as it needed to be.
 */
const CONTROL = 'min-h-tap [@media(pointer:fine)]:min-h-9';

/** Pilih / Batal: enters and leaves selection mode. */
function SelectButton({
  selecting,
  onToggle,
}: {
  selecting: boolean;
  onToggle: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selecting}
      className={[
        `${CONTROL} shrink-0 rounded-lg px-2.5 text-xs font-medium`,
        selecting ? 'bg-accent text-white' : 'text-fg hover:bg-bg-subtle',
      ].join(' ')}
    >
      {selecting ? 'Batal' : 'Pilih'}
    </button>
  );
}

function SectionHeading({ label }: { label: string }): JSX.Element {
  return (
    <h2 className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-fg-faint">
      {label}
    </h2>
  );
}

function EmptyState({
  filtering,
  onCreate,
}: {
  filtering: boolean;
  onCreate: () => void;
}): JSX.Element {
  return (
    // Left-aligned and near the top from lg: a message centred in a 900 px
    // viewport reads as an error page rather than an empty list.
    <div className="px-6 py-14 text-center lg:px-4 lg:py-10 lg:text-left">
      <p className="text-sm text-fg-muted">
        {filtering ? 'Tidak ada pasien yang cocok.' : 'Belum ada pasien aktif.'}
      </p>
      {!filtering ? (
        <button
          type="button"
          onClick={onCreate}
          className="mt-3 min-h-tap rounded-lg border border-border px-4 text-sm text-accent"
        >
          Tambah pasien pertama
        </button>
      ) : null}
    </div>
  );
}
