import { useEffect, useMemo, useState } from 'react';
import { DateField } from '@/components/common/DateField';
import { formatDmy } from '@/domain/dateDmy';
import { useSearchParams } from 'react-router-dom';
import { useGoUp } from '@/lib/useGoUp';

import { AppShell } from '@/components/common/AppShell';
import { IconBack, IconCopy } from '@/components/common/Icons';
import { Button, Callout, ChipRow, ChoiceChip, Field, INPUT, Section, Segmented } from '@/components/common/ui';
import { useJagaSync } from '@/hooks/useJagaSync';
import { CensusVerifier } from '@/components/helper/CensusVerifier';
import { SensusMaker } from '@/components/helper/SensusMaker';
import { MorningReport } from '@/components/helper/MorningReport';
import { SavedResults } from '@/components/helper/SavedResults';
import { SaveResultButton, SavedResultsProvider } from '@/components/helper/SaveResult';

import { copyText } from '@/lib/clipboard';
import { extractPdf } from '@/lib/pdfItems';
import { describeVersion, nearestYear, refuseOlder, rosterFreshness, type RosterFreshness } from '@/domain/jaga/recency';
import {
  buildFormasi,
  buildKonfirmasi,
  longDate,
  shiftDateLabel,
  nextDate,
  resolveShift,
} from '@/domain/jaga/formasi';
import type { JagaPostId, JarkomDirectory, JarkomEntry } from '@/domain/jaga/types';
import type { PostSwap } from '@/domain/jaga/store';
import {
  buildDirectory,
  refreshSwap,
  searchResidents,
  type Resident,
} from '@/domain/jaga/directory';
import { describeMismatch, identifyJagaPdf } from '@/domain/jaga/identify';
import { describeDates, dpjpGaps, missingDates } from '@/domain/jaga/coverage';
import { isLegacy, provenance, upgradeParsed } from '@/domain/jaga/reparse';
import type { JagaRosterKind } from '@/domain/jaga/sync';
import { parseDpjpRoster } from '@/domain/jaga/parseDpjp';
import { parseJagaRoster } from '@/domain/jaga/parseRoster';
import { parseJarkom } from '@/domain/jaga/parseJarkom';
import { parsePediatri, pediatriFor } from '@/domain/jaga/parsePediatri';
import { parsePediatriText } from '@/domain/jaga/parsePediatriText';
import { PARSER_VERSION } from '@/domain/jaga/reparse';
import {
  readConfirmed,
  readDpjp,
  readJarkom,
  readRoster,
  readDpjpEdit,
  readNameOverrides,
  readJarkomLinks,
  setJarkomLink,
  readReligion,
  readPediatri,
  readPostOverrides,
  readSender,
  writeConfirmed,
  writeDpjp,
  setDpjpEdit,
  countShiftEdits,
  resetShiftEdits,
  setNameOverride,
  setReligion,
  setPostOverride,
  writeJarkom,
  writePediatri,
  writeRoster,
  writeSender,
} from '@/domain/jaga/store';
import { useClinicalToday } from '@/hooks/useClinicalToday';

const HELPER_TABS = [
  { id: 'jaga', label: 'Konfirmasi Jaga' },
  // "Verifikasi List" (renamed from "Verifikasi Sensus"): it checks the ward LIST against the
  // denah, and "Sensus" read too close to "Buat Sensus" beside it. The URL id
  // stays 'sensus' so existing bookmarks and history entries still open it.
  { id: 'sensus', label: 'Verifikasi List' },
  { id: 'buatsensus', label: 'Buat Sensus' },
  { id: 'mr', label: 'Morning Report' },
  // Every result saved from the four tools above, on this account.
  { id: 'tersimpan', label: 'Tersimpan' },
] as const;

type HelperTab = (typeof HELPER_TABS)[number]['id'];

/**
 * Helper — four unrelated tools, one tab each, and Tersimpan.
 *
 * They share a page only because they share a purpose (the ward's paperwork),
 * never data: none reads or writes another's state. The one thing they share
 * is the saved-results listener (`SavedResultsProvider`), so every Simpan
 * button knows what is already saved without a listener of its own. Only the open tab is
 * mounted, so Konfirmasi Jaga's sync listener runs only while that tab is
 * open, as before.
 *
 * The tab lives in the URL (`?tab=`), so the back button, a bookmark and a
 * reload all return to it.
 */
export function HelperPage(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const goUp = useGoUp('/');
  const requested = params.get('tab');
  const tab: HelperTab = HELPER_TABS.some((entry) => entry.id === requested)
    ? (requested as HelperTab)
    : 'jaga';

  /*
    Inside AppShell like every other page. It used to render bare, with no tab
    bar or sidebar, so in the installed app there was no way out of it but
    closing the app.
  */
  return (
    <AppShell
      title="Helper"
      titleBadge={
        <span className="rounded-full border border-danger px-2 py-0.5 text-[10px] font-semibold text-danger">
          WIP
        </span>
      }
    >
      <div className="mx-auto max-w-6xl space-y-4 px-4 pb-4 pt-0 lg:pt-4">
        {/* Desktop only: below lg the shell's title bar already says "Helper"
            (with the WIP mark), and this row said it a second time. */}
        <div className="hidden flex-wrap items-center gap-2 lg:flex">
          <button
            type="button"
            onClick={goUp}
            aria-label="Kembali"
            className="-ml-2 flex min-h-tap min-w-tap items-center justify-center rounded-lg text-fg-muted hover:bg-bg-subtle"
          >
            <IconBack />
          </button>
          <h1 className="text-lg font-semibold">Helper</h1>
          <span className="rounded-full border border-danger px-2 py-0.5 text-[10px] font-semibold text-danger">
            Work in progress
          </span>
        </div>
        <div
          role="tablist"
          aria-label="Fitur Helper"
          className="flex overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {HELPER_TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              onClick={() => setParams({ tab: entry.id }, { replace: true })}
              className={[
                // Four tabs no longer fit a 360 px phone as equal widths ("Verifikasi
                // Sensus" broke onto two lines), so the row scrolls there and
                // shares the width from sm up.
                'min-h-tap shrink-0 whitespace-nowrap border-b-2 px-3 text-xs font-medium sm:flex-1 sm:px-1 sm:text-sm',
                tab === entry.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-fg-muted',
              ].join(' ')}
            >
              {entry.label}
            </button>
          ))}
        </div>
        {/*
          Said once, above every Helper tab: each one turns pasted text into a
          message for a consultant or a group, and a parser — or the AI — can
          misread a list it has not seen before.
        */}
        <p
          role="note"
          className="flex gap-2 rounded-xl border border-[var(--warn-strong)] bg-[var(--warn-soft)] px-3 py-2 text-[11px] leading-relaxed text-fg"
        >
          <span aria-hidden="true" className="font-semibold text-[var(--warn-strong)]">!</span>
          <span>
            Hasil Helper disusun otomatis dari teks yang ditempel. <b>Periksa sendiri isinya</b> — nama, RM,
            DPJP, diagnosis, jumlah pasien — sebelum disalin atau dikirim.
          </span>
        </p>
        <SavedResultsProvider>
          <div role="tabpanel">
            {tab === 'jaga' ? (
              <KonfirmasiJaga />
            ) : tab === 'sensus' ? (
              <CensusVerifier />
            ) : tab === 'buatsensus' ? (
              <SensusMaker />
            ) : tab === 'mr' ? (
              <MorningReport />
            ) : (
              <SavedResults />
            )}
          </div>
        </SavedResultsProvider>
      </div>
    </AppShell>
  );
}

/**
 * Konfirmasi Jaga — WORK IN PROGRESS.
 *
 * The process this replaces is four lookups chained together, three of them
 * against documents that change once a month: find tomorrow's initials in the
 * jaga roster, resolve each initial in the legend beside it, find that person
 * in the Jarkom sheet for their nickname and agama, and read both DPJP rows.
 *
 * None of that is judgement — it is joining four tables by hand, at night,
 * from a PDF on a phone. So the tables are imported once and the rest is a
 * query.
 *
 * Kept entirely separate from the patient side: nothing here imports from
 * `patients/` or `entries/`, and nothing there imports from here. The only
 * shared code is the greeting/time expander and the clipboard helper. If this
 * ever becomes its own app, that boundary is where it cuts.
 */
function KonfirmasiJaga(): JSX.Element {
  const today = useClinicalToday();

  const [roster, setRoster] = useState(() => readRoster());
  const [dpjp, setDpjp] = useState(() => readDpjp());
  const [jarkom, setJarkom] = useState(() => readJarkom());
  const [pediatri, setPediatri] = useState(() => readPediatri());
  const [sender, setSender] = useState(() => readSender());
  const [busy, setBusy] = useState<string | null>(null);
  const sync = useJagaSync();
  const [error, setError] = useState<string | null>(null);

  /**
   * Tomorrow, because that is when this is done.
   *
   * The confirmation round happens the evening BEFORE a jaga, so defaulting to
   * today would be right on none of the days anyone opens this.
   */
  const [date, setDate] = useState(() => {
    const at = new Date();
    at.setDate(at.getDate() + 1);
    return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
  });

  const shifts = useMemo(
    () => (roster?.shifts ?? []).filter((shift) => shift.date === date),
    [roster, date],
  );
  /** Each monthly schedule judged against the date being confirmed (see recency.ts). */
  const freshness = useMemo(
    () => ({
      roster: rosterFreshness('roster', roster, date, today),
      dpjp: rosterFreshness('dpjp', dpjp, date, today),
      pediatri: rosterFreshness('pediatri', pediatri, date, today),
    }),
    [roster, dpjp, pediatri, date, today],
  );
  const staleSchedules = (
    [
      ['Jadwal Jaga PPDS', freshness.roster, Boolean(roster)],
      ['Jadwal DPJP', freshness.dpjp, Boolean(dpjp)],
      ['Jadwal Jaga Pediatri', freshness.pediatri, Boolean(pediatri)],
    ] as Array<[string, RosterFreshness, boolean]>
  ).filter(([, state, present]) => present && state.state !== 'ok');
  const [shiftIndex, setShiftIndex] = useState(0);
  const shift = shifts[Math.min(shiftIndex, shifts.length - 1)] ?? null;

  const [overrides, setOverrides] = useState(() => readNameOverrides());
  const [links, setLinks] = useState(() => readJarkomLinks());

  /**
   * Per-date edits: who swapped onto a post, and which consultants swapped.
   *
   * Re-read whenever the date or shift changes, for the same reason the
   * confirmation set is: these are small, the read is synchronous, and holding
   * every date in state would re-render a page carrying three parsed PDFs on
   * every keystroke.
   */
  const [postEdits, setPostEdits] = useState<Record<string, PostSwap>>({});
  const [religion, setReligionMap] = useState(() => readReligion());

  /** Everyone on this month's rota, for the swap picker. */
  const directory = useMemo(() => buildDirectory(roster, jarkom, links), [roster, jarkom, links]);
  const [dpjpEdits, setDpjpEdits] = useState<
    Record<string, { utama?: string; tindakan?: string }>
  >({});
  const [editKey, setEditKey] = useState('');

  /** Swaps re-read against the directory, so a corrected person shows corrected. */
  const livePosts = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(postEdits).map(([id, swap]) => [id, refreshSwap(swap, directory)]),
      ),
    [postEdits, directory],
  );

  const posts = useMemo(
    () =>
      shift && roster
        ? resolveShift(
            shift,
            roster,
            jarkom,
            overrides,
            livePosts,
            religion,
            pediatriFor(pediatri, shift.date, shift.shift),
            links,
          )
        : [],
    [shift, roster, jarkom, overrides, livePosts, religion, pediatri, links],
  );

  /**
   * Who has replied, for the shift on screen.
   *
   * Re-read whenever the date or shift changes rather than held as one big
   * map: the set is tiny, the read is synchronous, and keeping one map in
   * state means every tick re-renders a component that is also holding three
   * parsed PDFs.
   */
  const [confirmed, setConfirmed] = useState<ReadonlySet<string>>(new Set());
  const [confirmKey, setConfirmKey] = useState('');
  const currentKey = shift ? `${shift.date}:${shift.shift}` : '';
  if (shift && currentKey !== confirmKey) {
    setConfirmKey(currentKey);
    setConfirmed(readConfirmed(shift.date, shift.shift));
  }
  if (shift && currentKey !== editKey) {
    setEditKey(currentKey);
    setPostEdits(readPostOverrides(shift.date, shift.shift));
    setDpjpEdits({
      [shift.date]: readDpjpEdit(shift.date),
      [nextDate(shift.date)]: readDpjpEdit(nextDate(shift.date)),
    });
  }

  /*
    A schedule read by an older parser is read again from its kept source,
    on load and whenever the account sends one (see reparse.ts), and written
    back so every device gets the corrected copy. This is how a parser fix
    reaches a schedule imported before it — no re-import needed.
  */
  useEffect(() => {
    const upgrade = <T,>(kind: JagaRosterKind, stored: T | null, write: (value: T) => void, set: (value: T) => void): void => {
      const result = upgradeParsed(kind, stored);
      if (!result.changed) return;
      write(result.value as T);
      set(result.value as T);
    };
    upgrade('roster', readRoster(), writeRoster, setRoster);
    upgrade('dpjp', readDpjp(), writeDpjp, setDpjp);
    upgrade('jarkom', readJarkom(), writeJarkom, setJarkom);
    upgrade('pediatri', readPediatri(), writePediatri, setPediatri);
  }, [sync.revision]);

  /**
   * Something arrived from another device: re-read everything from
   * localStorage, where the sync hook put it.
   *
   * Clearing the two keys makes the render-phase blocks above re-read the
   * per-date sets on the next render. That is the same path a date change
   * takes, so there is no second way for this page to load state.
   */
  useEffect(() => {
    if (sync.revision === 0) return;
    setRoster(readRoster());
    setDpjp(readDpjp());
    setJarkom(readJarkom());
    setPediatri(readPediatri());
    setSender(readSender());
    setOverrides(readNameOverrides());
    setLinks(readJarkomLinks());
    setReligionMap(readReligion());
    setConfirmKey('');
    setEditKey('');
  }, [sync.revision]);

  /*
    The dates whose DPJP block this Formasi prints. Read fresh each render
    (a synchronous localStorage read of two small maps), and after a reset
    the state setters below bring the page in line.
  */
  const formasiDates = shift ? [shift.date, nextDate(shift.date)] : [];
  const shiftEditCounts = shift
    ? countShiftEdits(shift.date, shift.shift, formasiDates)
    : { swaps: 0, dpjp: 0 };

  const resetFormasi = (): void => {
    if (!shift) return;
    resetShiftEdits(shift.date, shift.shift, formasiDates);
    // The same re-read path a date change takes.
    setConfirmKey('');
    setEditKey('');
  };

  const toggleConfirmed = (postId: string): void => {
    if (!shift) return;
    const next = new Set(confirmed);
    if (!next.delete(postId)) next.add(postId);
    setConfirmed(next);
    writeConfirmed(shift.date, shift.shift, next);
  };

  const formasi = useMemo(
    () =>
      shift
        ? buildFormasi(
            shift,
            posts,
            dpjp,
            new Date(),
            confirmed as ReadonlySet<JagaPostId>,
            dpjpEdits,
          )
        : '',
    [shift, posts, dpjp, confirmed, dpjpEdits],
  );

  const staffed = posts.filter((post) => post.initials || post.swapped);
  const outstanding = staffed.filter((post) => !confirmed.has(post.id)).length;

  const [formasiCopied, setFormasiCopied] = useState(false);

  /**
   * The Pediatri roster pasted as text (the WhatsApp message), not a PDF.
   * Same rule as a PDF: only a later schedule replaces the stored one.
   * Stamped with the current parser version so it is not mistaken for a
   * legacy import; there are no PDF items to keep, and none are needed.
   */
  const applyPediatriText = (text: string): boolean => {
    setError(null);
    const { roster: read } = parsePediatriText(text, date);
    if (read.shifts.length === 0) {
      setError('Tidak ada baris jaga pediatri terbaca dari teks itu.');
      return false;
    }
    const parsed = { ...read, source: { fileName: 'Teks WhatsApp' }, parser: PARSER_VERSION.pediatri };
    const refusal = refuseOlder('pediatri', parsed, pediatri);
    if (refusal) {
      setError(
        `Jadwal ini lebih lama dari yang tersimpan, jadi tidak dipakai. Teks: ${refusal.incoming}. Tersimpan: ${refusal.stored}.`,
      );
      return false;
    }
    writePediatri(parsed);
    setPediatri(parsed);
    return true;
  };

  async function importPdf(
    file: File,
    kind: 'roster' | 'dpjp' | 'jarkom' | 'pediatri',
  ): Promise<void> {
    setBusy(kind);
    setError(null);
    try {
      const { items, source } = await extractPdf(file);
      const stamp = {
        fileName: source.fileName,
        ...(source.documentDate ? { documentDate: source.documentDate } : {}),
      };

      /*
        Only a LATER document replaces the stored one.

        By what it covers first, then by the PDF's own date (see
        `recency.ts`). Refused rather than asked: a roster is replaced
        wholesale and synced to every device, so an older month accepted by
        one tap on one phone would be the schedule everywhere. Re-importing
        the same document is allowed, since it is not older.
      */
      const guard = (parsed: unknown, stored: unknown): boolean => {
        const refusal = refuseOlder(kind, parsed, stored);
        if (!refusal) return true;
        setError(
          `PDF ini lebih lama dari yang tersimpan, jadi tidak dipakai. ` +
            `PDF: ${refusal.incoming}. Tersimpan: ${refusal.stored}.`,
        );
        return false;
      };

      /*
        Identify the document BEFORE parsing it, and refuse on a mismatch.

        The alternative is that the wrong file parses to nothing and the user
        is told their PDF is broken — when the file was fine and the slot was
        wrong. Refusing also protects what is already stored: a good roster is
        not replaced by a parse of a different document.
      */
      const found = identifyJagaPdf(items);
      if (found !== kind) {
        setError(describeMismatch(kind, found));
        return;
      }

      if (kind === 'roster') {
        const parsed = { ...parseJagaRoster(items), source: stamp, ...provenance('roster', items) };
        if (parsed.shifts.length === 0) throw new Error('Tidak ada baris jaga terbaca.');
        if (!guard(parsed, roster)) return;
        writeRoster(parsed);
        setRoster(parsed);
      } else if (kind === 'dpjp') {
        const parsed = { ...parseDpjpRoster(items), source: stamp, ...provenance('dpjp', items) };
        if (parsed.days.length === 0) throw new Error('Tidak ada tanggal DPJP terbaca.');
        if (!guard(parsed, dpjp)) return;
        writeDpjp(parsed);
        setDpjp(parsed);
      } else if (kind === 'pediatri') {
        /*
          The year comes from the date being viewed, not from the sheet.

          The paediatrics roster spells out the month and never the year, so
          there is nothing in the document to read. Taking it from the selected
          date rather than from `new Date()` means importing December's sheet
          in January still dates it to December, as long as the user is looking
          at the month they are importing.
        */
        /*
          The sheet names its month and never its year. The year nearest the
          date being viewed is used, so a January sheet imported while looking
          at December is dated to the next year. Taking the viewed year as it
          stood would date it eleven months back, and the latest-document rule
          above would then refuse the latest document.
        */
        const firstPass = parsePediatri(items, Number(date.slice(0, 4)));
        const month = Number(firstPass.shifts[0]?.date.slice(5, 7));
        const year = month ? nearestYear(month, date) : Number(date.slice(0, 4));
        const parsed = {
          ...(year === Number(date.slice(0, 4)) ? firstPass : parsePediatri(items, year)),
          source: stamp,
          ...provenance('pediatri', items),
        };
        if (parsed.shifts.length === 0) throw new Error('Tidak ada baris jaga pediatri terbaca.');
        if (!guard(parsed, pediatri)) return;
        writePediatri(parsed);
        setPediatri(parsed);
      } else {
        const parsed = { ...parseJarkom(items), source: stamp, ...provenance('jarkom', items) };
        if (parsed.entries.length === 0) throw new Error('Tidak ada nama terbaca.');
        if (!guard(parsed, jarkom)) return;
        writeJarkom(parsed);
        setJarkom(parsed);
      }
    } catch (cause) {
      console.error('[jaga] import failed', cause);
      // Named rather than swallowed: a roster that silently imports as empty
      // looks identical to one that imported fine until the day you need it.
      setError(cause instanceof Error ? cause.message : 'Gagal membaca PDF.');
    } finally {
      setBusy(null);
    }
  }

  /* ── derived for the layout below (no hooks past this point) ─────────── */
  const tomorrowIso = nextDate(today);
  const pickDate = (next: string): void => {
    if (!next) return;
    setDate(next);
    setShiftIndex(0);
  };
  const rosterGaps = roster ? missingDates(roster.shifts.map((entry) => entry.date)) : [];
  const dpjpSheetGaps = dpjp
    ? missingDates(
        dpjp.days.map((day) => day.date),
        { wholeMonths: true },
      )
    : [];
  const formasiDpjpGaps = shift && dpjp ? dpjpGaps(shift, dpjp, dpjpEdits) : [];
  const confirmedCount = staffed.length - outstanding;
  const span = (dates: readonly string[]): string | null => {
    const sorted = [...dates].sort();
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    return first && last ? `${describeDates([first])} – ${describeDates([last])}` : null;
  };
  const syncTone =
    sync.status === 'synced' ? 'ok' : sync.status === 'error' ? 'error' : sync.status === 'waiting' ? 'wait' : 'local';

  const copyFormasi = (): void => {
    void copyText(formasi).then((ok) => {
      setFormasiCopied(ok);
      if (ok) window.setTimeout(() => setFormasiCopied(false), 1500);
    });
  };

  return (
    <div className="space-y-5">
      {/*
        THE TOOLBAR (2026-10-05). Date, shift and sync on one line, because
        they are the three things checked before anything else on this screen:
        which night, which team, and whether what is shown is the account's.
        It used to be a numbered form ("2. Pilih tanggal jaga") reached by
        scrolling past the imports.
      */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border bg-surface px-3 py-2.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => pickDate(previousDate(date))}
            aria-label="Hari sebelumnya"
            className="flex min-h-tap min-w-tap items-center justify-center rounded-lg text-lg text-fg-muted hover:bg-bg-subtle"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <DateField ariaLabel="Tanggal jaga" value={date} onChange={pickDate} className="w-40" />
          <button
            type="button"
            onClick={() => pickDate(nextDate(date))}
            aria-label="Hari berikutnya"
            className="flex min-h-tap min-w-tap items-center justify-center rounded-lg text-lg text-fg-muted hover:bg-bg-subtle"
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">{longDate(date)}</p>
          <p className="text-[11px] text-fg-muted">
            {relativeDay(date, today)}
          </p>
        </div>
        <ChipRow>
          <ChoiceChip active={date === today} onClick={() => pickDate(today)}>
            Hari ini
          </ChoiceChip>
          <ChoiceChip active={date === tomorrowIso} onClick={() => pickDate(tomorrowIso)}>
            Besok
          </ChoiceChip>
        </ChipRow>
        {/*
          Weekends carry two teams — `Minggu Pagi` and `Minggu Malam` are
          different people entirely — so the shift is chosen, never assumed.
          On a weekday there is one and the control does not appear.
        */}
        {shifts.length > 1 ? (
          <Segmented
            size="sm"
            label="Shift"
            value={String(Math.min(shiftIndex, shifts.length - 1))}
            onChange={(next) => setShiftIndex(Number(next))}
            options={shifts.map((option, index) => [String(index), option.hari] as const)}
          />
        ) : null}
        <span
          role="status"
          title="Jadwal yang diimpor dan perubahan di layar ini (konfirmasi, tukar jaga, nama, agama, DPJP) di-sync ke akun dan berlaku hanya untuk tanggalnya. Sumber utamanya tetap PDF jadwal."
          className={[
            'ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]',
            syncTone === 'error' ? 'border-danger text-danger' : 'border-border text-fg-muted',
          ].join(' ')}
        >
          <span
            aria-hidden="true"
            className={[
              'h-2 w-2 rounded-full',
              syncTone === 'ok'
                ? 'bg-accent'
                : syncTone === 'error'
                  ? 'bg-[var(--danger)]'
                  : syncTone === 'wait'
                    ? 'bg-[var(--warn-strong)]'
                    : 'bg-fg-faint',
            ].join(' ')}
          />
          {syncTone === 'ok'
            ? 'Synced'
            : syncTone === 'wait'
              ? 'Menunggu koneksi'
              : syncTone === 'error'
                ? 'Sync gagal · tersimpan di perangkat'
                : 'Hanya di perangkat ini'}
        </span>
      </div>

      <Section
        title="Jadwal"
        hint="Impor ulang kapan saja: ketuk kotaknya atau seret PDF ke atasnya. Jadwal dan perubahan di layar ini di-sync ke akun dan berlaku hanya untuk tanggalnya; sumber utamanya tetap PDF."
      >
        {staleSchedules.length > 0 ? (
          <Callout
            role="alert"
            tone={staleSchedules.some(([, state]) => state.state === 'outdated') ? 'danger' : 'warn'}
            title={
              staleSchedules.some(([, state]) => state.state === 'outdated')
                ? 'Jadwal sudah kedaluwarsa — impor jadwal terbaru'
                : 'Jadwal hampir habis — siapkan jadwal bulan berikutnya'
            }
          >
            {staleSchedules.map(([label, state]) => (
              <span key={label} className="block">
                {label}: berlaku sampai {longDate(state.state === 'ok' ? date : state.end)}
                {state.state === 'outdated' ? ' (sudah lewat)' : ''}
              </span>
            ))}
          </Callout>
        ) : null}
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <ScheduleTile
            label="Jadwal Jaga PPDS"
            cadence="tiap bulan"
            summary={roster ? `${roster.shifts.length} shift` : null}
            version={roster ? describeVersion('roster', roster) : null}
            gaps={rosterGaps}
            busy={busy === 'roster'}
            warning={freshness.roster.state}
            legacy={isLegacy('roster', roster)}
            onFile={(file) => void importPdf(file, 'roster')}
          />
          <ScheduleTile
            label="Jadwal DPJP"
            cadence="tiap bulan"
            summary={dpjp ? `${dpjp.days.length} hari` : null}
            version={dpjp ? describeVersion('dpjp', dpjp) : null}
            gaps={dpjpSheetGaps}
            busy={busy === 'dpjp'}
            warning={freshness.dpjp.state}
            legacy={isLegacy('dpjp', dpjp)}
            onFile={(file) => void importPdf(file, 'dpjp')}
          />
          <ScheduleTile
            label="Jadwal Jaga Pediatri"
            cadence="tiap bulan"
            summary={pediatri ? `${pediatri.shifts.length} shift` : null}
            version={pediatri ? describeVersion('pediatri', pediatri) : null}
            gaps={[]}
            busy={busy === 'pediatri'}
            warning={freshness.pediatri.state}
            legacy={isLegacy('pediatri', pediatri)}
            onFile={(file) => void importPdf(file, 'pediatri')}
          />
          {/*
            Per SEMESTER, not per month: new residents arrive twice a year,
            and a monthly prompt for a document that changes every six months
            is a prompt people learn to ignore.
          */}
          <ScheduleTile
            label="Daftar Jarkom"
            cadence="per semester"
            summary={jarkom ? `${jarkom.entries.length} residen` : null}
            version={jarkom ? describeVersion('jarkom', jarkom) : null}
            gaps={[]}
            busy={busy === 'jarkom'}
            legacy={isLegacy('jarkom', jarkom)}
            onFile={(file) => void importPdf(file, 'jarkom')}
          />
        </div>
        <PediatriPaste viewed={date} onUse={applyPediatriText} />
        {error ? (
          <Callout tone="danger" role="alert" title="Jadwal tidak dipakai">
            {error}
          </Callout>
        ) : null}
      </Section>

      {!roster ? (
        <Callout title="Mulai dari Jadwal Jaga PPDS">
          Impor PDF-nya di kotak pertama; Formasi dan pesan konfirmasi disusun dari situ.
        </Callout>
      ) : shifts.length === 0 ? (
        <Callout tone="danger" role="alert" title="Tanggal ini tidak ada di jadwal yang diimpor">
          {roster.title}
          {span(roster.shifts.map((entry) => entry.date))
            ? ` (${span(roster.shifts.map((entry) => entry.date))})`
            : ''}
        </Callout>
      ) : null}

      {shift ? (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <section aria-labelledby="formasi-title" className="space-y-3 rounded-2xl border border-border bg-surface p-4">
            {/* Wraps only for the reset's explanation line, which is
                `basis-full` text; the controls stay on the title row. */}
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="formasi-title" className="flex-1 text-sm font-semibold">
                Formasi Jaga
                <span className="ml-2 text-xs font-normal text-fg-muted">{shift.hari}</span>
              </h2>
              <ResetFormasi
                key={currentKey}
                counts={shiftEditCounts}
                sharedDpjp={shift.shift !== 'penuh'}
                onReset={resetFormasi}
              />
              <SaveResultButton
                kind="formasi"
                forDate={shift.date}
                subject={shift.shift}
                title={`Formasi Jaga ${shift.hari}${shift.shift === 'penuh' ? '' : ` (${shift.shift})`}`}
                text={formasi}
              />
              <Button size="sm" variant="primary" icon={<IconCopy width={14} height={14} />} onClick={copyFormasi}>
                {formasiCopied ? 'Tersalin ✓' : 'Salin Formasi'}
              </Button>
            </div>

            {/*
              Said where it is missing, not only by its absence. A date the
              DPJP sheet does not cover prints NO block — which on 6 October
              read as a complete Formasi (see coverage.ts).
            */}
            {!dpjp ? (
              <Callout tone="warn" title="Blok DPJP kosong">
                Impor Jadwal DPJP untuk mengisinya.
              </Callout>
            ) : formasiDpjpGaps.length > 0 ? (
              <Callout tone="warn" role="alert" title={`DPJP ${describeDates(formasiDpjpGaps)} tidak ada di Jadwal DPJP`}>
                Blok DPJP untuk tanggal itu tidak ikut tercetak. Impor ulang PDF DPJP-nya, atau isi
                manual di “Ubah DPJP” di bawah.
              </Callout>
            ) : null}

            <pre className="whitespace-pre-wrap rounded-xl border border-border bg-bg-subtle px-3 py-2.5 font-mono text-xs leading-relaxed">
              {formasi}
            </pre>

            {/*
              Consultants swap too, and the published roster is a month old by
              the time it is used. Edited BY DATE, not by position: an edit
              made tonight against "setelah 00.00" is the same edit read
              tomorrow as "hari ini", so keying it any other way would need it
              entered twice.
            */}
            <details className="rounded-xl border border-border px-3 text-xs" open={formasiDpjpGaps.length > 0}>
              <summary className="flex min-h-tap cursor-pointer items-center font-medium text-fg-muted">
                Ubah DPJP (tukar jaga)
              </summary>
              <div className="space-y-3 pb-3">
                {[
                  { date: shift.date, label: shiftDateLabel(shift.date, shift.shift) },
                  // A pagi team's Formasi has no post-midnight block (see
                  // `buildFormasi`), so there is nothing here to edit for it.
                  ...(shift.shift === 'pagi'
                    ? []
                    : [
                        {
                          date: nextDate(shift.date),
                          label: `setelah 00.00 — ${longDate(nextDate(shift.date))}`,
                        },
                      ]),
                ].map(({ date: day, label }) => (
                  <div key={day} className="space-y-1.5">
                    <p className="text-[11px] font-medium text-fg-faint">{label}</p>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {(['utama', 'tindakan'] as const).map((field) => (
                        <input
                          key={field}
                          aria-label={`${field === 'utama' ? 'DPJP Utama' : 'DPJP Tindakan'} — ${label}`}
                          value={dpjpEdits[day]?.[field] ?? ''}
                          onChange={(event) => {
                            const next = setDpjpEdit(day, {
                              ...dpjpEdits[day],
                              [field]: event.target.value,
                            });
                            setDpjpEdits((current) => ({ ...current, [day]: next }));
                          }}
                          placeholder={
                            field === 'utama'
                              ? (dpjp?.days.find((entry) => entry.date === day)?.utama || 'DPJP Utama')
                              : (dpjp?.days.find((entry) => entry.date === day)?.tindakan || 'DPJP Tindakan')
                          }
                          className={`${INPUT} text-xs`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                <p className="text-[11px] text-fg-faint">Kosongkan untuk memakai jadwal yang diimpor.</p>
              </div>
            </details>
          </section>

          <section aria-labelledby="konfirmasi-title" className="space-y-3 rounded-2xl border border-border bg-surface p-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="konfirmasi-title" className="flex-1 text-sm font-semibold">
                  Konfirmasi senior
                </h2>
                <span className="text-xs tabular-nums text-fg-muted">
                  {outstanding === 0
                    ? `Semua ${staffed.length} terkonfirmasi ✓`
                    : `${confirmedCount}/${staffed.length} · ${outstanding} belum`}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Terkonfirmasi"
                aria-valuemin={0}
                aria-valuemax={staffed.length}
                aria-valuenow={confirmedCount}
                className="h-1.5 overflow-hidden rounded-full bg-bg-subtle"
              >
                <div
                  className="h-full rounded-full bg-accent transition-[width]"
                  style={{ width: `${staffed.length ? (confirmedCount / staffed.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Nama saya" htmlFor="jaga-sender-name">
                <input
                  id="jaga-sender-name"
                  value={sender.name}
                  onChange={(event) => {
                    const next = { ...sender, name: event.target.value };
                    setSender(next);
                    writeSender(next);
                  }}
                  placeholder="mis. Avi"
                  className={INPUT}
                />
              </Field>
              <Field label="Pos saya" htmlFor="jaga-sender-place">
                <input
                  id="jaga-sender-place"
                  value={sender.place}
                  onChange={(event) => {
                    const next = { ...sender, place: event.target.value };
                    setSender(next);
                    writeSender(next);
                  }}
                  placeholder="mis. Bangsal PJT A"
                  className={INPUT}
                />
              </Field>
            </div>

            <ul className="space-y-2">
              {posts.map((post) => {
                const message = buildKonfirmasi(
                  post,
                  {
                    senderName: sender.name || '(nama)',
                    senderPlace: sender.place || '(pos)',
                    date: shift.date,
                    shift: shift.shift,
                  },
                  new Date(),
                );
                return (
                  <li
                    key={post.id}
                    className={[
                      'rounded-xl border px-3 py-2 transition-colors',
                      confirmed.has(post.id) ? 'border-accent bg-[var(--accent-soft)]' : 'border-border bg-bg',
                    ].join(' ')}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {/*
                        The tick is the first thing in the row, because it is
                        the thing being done. Everything else on the row is
                        reference for the message beneath it.
                      */}
                      <label className="flex min-h-tap cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={confirmed.has(post.id)}
                          onChange={() => toggleConfirmed(post.id)}
                          className="h-4 w-4"
                        />
                        {/*
                          EDITABLE, and the same string the Formasi prints.

                          Matching two documents typed by two people leaves a
                          residue that tuning will not remove — 14 of the 104
                          names have no Jarkom row at all. Rather than pretend
                          otherwise, the resolved name is correctable here, and
                          the correction is remembered against the INITIALS: AV
                          is the same person in every shift, so fixing them once
                          fixes every Formasi they appear in.
                        */}
                        {/*
                          A PERSON, picked — not a name, typed.

                          A tukar jaga names somebody: "Rheza is on for
                          Jordy". Typing that as free text loses everything
                          else about them, and the thing lost is the one that
                          matters — their agama, and therefore the greeting the
                          confirmation opens with. Picking from the rota
                          carries it.

                          Searched by NICKNAME first, because that is what a
                          resident is called and therefore what gets typed:
                          "Rheza" has to find `dr. M. Rheza Rivaldi Salam`.

                          Free text still works for the case the rota cannot
                          cover — paediatrics keeps its own roster, so that
                          name can only ever be typed.
                        */}
                        <ResidentPicker
                          value={post.display}
                          directory={directory}
                          onPick={(next) =>
                            setPostEdits(
                              setPostOverride(shift.date, shift.shift, post.id, next),
                            )
                          }
                          label={post.label}
                          onLink={(initials, row) => setLinks(setJarkomLink(initials, row))}
                        />
                      </label>
                      <span className="text-xs text-fg-muted">{post.label}</span>
                      <span className="text-[10px] text-fg-faint">{post.initials}</span>
                      {/*
                        Say when the greeting is a fallback. The Jarkom sheet
                        is a semester old and the roster is not — a resident
                        who joined since is unmatched, and the neutral greeting
                        is used. Silently sending it would be fine; silently
                        hiding that it happened is what stops the sheet ever
                        being updated.
                      */}
                      {/*
                        Three states, not a toggle. "Otomatis" is what Jarkom
                        said, which is different from an explicit answer — a
                        two-state control would commit a guess for everybody
                        the first time anyone touched it.
                      */}
                      {post.personInitials ? (
                        <select
                          aria-label={`Agama untuk ${post.label}`}
                          value={
                            religion[post.personInitials] === undefined
                              ? 'auto'
                              : religion[post.personInitials]
                                ? 'muslim'
                                : 'non'
                          }
                          onChange={(event) =>
                            setReligionMap(
                              setReligion(
                                post.personInitials,
                                event.target.value === 'auto'
                                  ? null
                                  : event.target.value === 'muslim',
                              ),
                            )
                          }
                          className="min-h-tap rounded border border-border bg-surface px-1 text-[10px]"
                        >
                          <option value="auto">
                            {post.muslim === null
                              ? 'Agama?'
                              : post.muslim
                                ? 'Muslim (otomatis)'
                                : 'Non (otomatis)'}
                          </option>
                          <option value="muslim">Muslim</option>
                          <option value="non">Non-Muslim</option>
                        </select>
                      ) : null}
                      {post.swapped ? (
                        <>

                          {post.initials ? (
                            <button
                              type="button"
                              title="Simpan sebagai koreksi tetap untuk inisial ini"
                              onClick={() => {
                                setOverrides(setNameOverride(post.initials, post.display));
                                setPostEdits(
                                  setPostOverride(shift.date, shift.shift, post.id, null),
                                );
                              }}
                              className="text-[10px] underline decoration-dotted"
                            >
                              Selalu
                            </button>
                          ) : null}
                        </>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void copyText(message)}
                        className="ml-auto min-h-tap rounded-lg border border-border px-3 text-xs font-medium"
                      >
                        Salin
                      </button>
                    </div>
                    {/*
                      The full name comes from the ROSTER legend, never from
                      Jarkom. Jarkom supplies exactly two things — the short
                      name and the agama — and its spelling of a name is not
                      used anywhere, because the roster is the document that
                      decides who is on.

                      Shown here so a wrong match is visible: if the nickname
                      above does not belong to this person, this line is where
                      you see it.
                    */}
                    {/* On a swap this is the ROSTERED person; the swap header names them instead. */}
                    {post.name && post.name !== post.display && !post.swapped ? (
                      <p className="mt-0.5 text-[10px] text-fg-faint">{post.name}</p>
                    ) : null}
                    {(() => {
                      /*
                        For a swap, the question is about whoever was swapped
                        IN — their initials, their Jarkom row — not the
                        rostered person the post was printed with.
                      */
                      if (!jarkom) return null;
                      const person = post.swapped
                        ? directory.find((entry) => entry.initials === post.personInitials)
                        : null;
                      const subject = post.swapped
                        ? person
                          ? {
                              initials: person.initials,
                              name: person.name,
                              linked: person.linked,
                              ambiguous: person.ambiguous,
                            }
                          : null
                        : post.initials
                          ? {
                              initials: post.initials,
                              name: post.name,
                              linked: post.jarkomLinked,
                              ambiguous: post.jarkomAmbiguous,
                            }
                          : null;
                      return subject ? (
                        <JarkomLinkControl
                          subject={subject}
                          jarkom={jarkom}
                          onLink={(row) => setLinks(setJarkomLink(subject.initials, row))}
                        />
                      ) : null;
                    })()}

                    {/*
                      The tag sits ON the message box, not only on the row
                      above it.

                      The box is what gets copied and sent, and a swap is the
                      one thing about it that is not in the roster anybody else
                      is reading. Marking it where the text is means the
                      person about to press Salin sees it; marking it only on
                      the row means they see it before they have decided to
                      send, which is the wrong moment.
                    */}
                    {/*
                      A swap is marked as a HEADER on the message box, in the
                      warning colour, with who was rostered — not as a small
                      grey chip in its corner, which sat on top of the text
                      and read as decoration. The box border takes the same
                      colour, so a swapped message cannot be mistaken for a
                      rostered one at a glance down the list.
                    */}
                    <div className="mt-1">
                      {post.swapped ? (
                        <p className="flex items-center gap-1.5 rounded-t-lg border border-b-0 border-[var(--warn-strong)] bg-[var(--warn-soft)] px-2 py-1 text-xs font-semibold text-[var(--warn-strong)]">
                          <span aria-hidden="true">⇄</span>
                          Tukar jaga
                          {post.initials ? (
                            <span className="font-normal">
                              · menggantikan {post.name ?? post.initials}
                            </span>
                          ) : null}
                        </p>
                      ) : null}
                      <p
                        className={[
                          'whitespace-pre-wrap border px-2 py-1.5 text-[11px] leading-relaxed text-fg-muted',
                          post.swapped
                            ? 'rounded-b-lg border-[var(--warn-strong)]'
                            : 'rounded-lg border-border',
                        ].join(' ')}
                      >
                        {message}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Which Jarkom row these initials are, when matching could not say or said
 * wrong.
 *
 * Open by itself when the legend name fits two rows equally — that is a
 * question only the user can answer, so it is asked where the name is shown.
 * Otherwise folded behind "Salah orang?", because a correct match needs
 * nothing from anyone.
 */
function JarkomLinkControl({
  subject: post,
  jarkom,
  onLink,
}: {
  subject: { initials: string; name: string | null; linked: boolean; ambiguous: JarkomEntry[] };
  jarkom: JarkomDirectory;
  onLink: (row: string | null) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const ambiguous = post.ambiguous;
  const sorted = useMemo(
    () => [...jarkom.entries].sort((a, b) => a.name.localeCompare(b.name)),
    [jarkom],
  );
  const describe = (entry: JarkomEntry): string => `${entry.name} (${entry.panggilan})`;

  if (post.linked) {
    return (
      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-fg-muted">
        Dipilih manual dari Jarkom.
        <button
          type="button"
          onClick={() => onLink(null)}
          className="min-h-tap underline decoration-dotted"
        >
          Kembalikan ke pencocokan otomatis
        </button>
      </p>
    );
  }

  if (ambiguous.length > 1) {
    return (
      <div className="mt-1 space-y-1 rounded-lg border border-[var(--warn-strong)] bg-[var(--warn-soft)] px-2 py-1.5">
        <p className="text-[11px] font-medium text-[var(--warn-strong)]">
          “{post.name}” cocok dengan {ambiguous.length} orang di Jarkom. Yang mana {post.initials}?
        </p>
        <div className="flex flex-wrap gap-1">
          {ambiguous.map((entry) => (
            <button
              key={entry.name}
              type="button"
              onClick={() => onLink(entry.name)}
              className="min-h-tap rounded-lg border border-border bg-surface px-3 text-xs"
            >
              {describe(entry)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return open ? (
    <label className="mt-1 block text-[10px] text-fg-muted">
      Orang yang benar untuk {post.initials} di Jarkom
      <select
        defaultValue=""
        onChange={(event) => {
          if (!event.target.value) return;
          onLink(event.target.value);
          setOpen(false);
        }}
        className="mt-0.5 block min-h-tap w-full rounded-lg border border-border bg-surface px-2 text-xs text-fg"
      >
        <option value="">Pilih…</option>
        {sorted.map((entry) => (
          <option key={entry.name} value={entry.name}>
            {describe(entry)}
          </option>
        ))}
      </select>
    </label>
  ) : (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="mt-0.5 min-h-tap text-[10px] text-fg-faint underline decoration-dotted"
    >
      Salah orang?
    </button>
  );
}

/**
 * One imported schedule, as a status tile (2026-10-05; was `ImportCard`).
 *
 * Says four things at a glance: whether it is there, what it covers, whether
 * it is about to run out, and whether the import had HOLES — the October DPJP
 * sheet imported with four dates missing and nothing said so (coverage.ts).
 * The whole tile is the file picker, and a PDF can be dropped on it, because
 * on a laptop the file is usually already in a Downloads window.
 */
/**
 * Jadwal Jaga Pediatri from the WhatsApp message (2026-10-09).
 *
 * The roster often arrives only as a chat message, never as a PDF, and the
 * tile above accepts PDFs. Pasted text is read by `parsePediatriText` and
 * shown before it is used: who is pagi/malam and who is the BTKV partner are
 * read from punctuation ("&", " - "), and that is exactly what to check.
 */
function PediatriPaste({
  viewed,
  onUse,
}: {
  viewed: string;
  onUse: (text: string) => boolean;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const read = useMemo(() => (text.trim() ? parsePediatriText(text, viewed) : null), [text, viewed]);

  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Tempel Jadwal Pediatri dari WhatsApp
      </Button>
    );
  }

  const shifts = read?.roster.shifts ?? [];
  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-xs font-semibold">Jadwal Jaga Pediatri dari teks</p>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Tutup
        </Button>
      </div>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={5}
        spellCheck={false}
        aria-label="Teks jadwal pediatri"
        placeholder={'Tempel pesannya, mis.\n* Jumat, 09 Oktober: dr. …\n* Minggu, 11 Oktober: dr. … & dr. …'}
        className="block w-full resize-y rounded-lg border border-border bg-bg-subtle px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-accent"
      />
      <p className="text-[11px] leading-relaxed text-fg-faint">
        “&amp;” = dua shift (pagi lalu malam). “A - B” = A PPDS BTKV yang jaga bersama B. Tahun diambil dari nama
        harinya.
      </p>
      {read && read.weekdayMismatch.length > 0 ? (
        <Callout tone="warn" title="Nama hari tidak cocok dengan tanggalnya">
          {read.weekdayMismatch.join(' · ')}
        </Callout>
      ) : null}
      {read && read.skipped.length > 0 ? (
        <Callout tone="warn" title={`${read.skipped.length} baris tidak terbaca`}>
          {read.skipped.join(' · ')}
        </Callout>
      ) : null}
      {shifts.length > 0 ? (
        <ul className="max-h-56 overflow-auto rounded-lg border border-border text-[11px]">
          {shifts.map((entry, index) => (
            <li
              key={`${entry.date}:${entry.shift}:${index}`}
              className="flex gap-2 border-b border-border px-2 py-1 last:border-b-0"
            >
              <span className="w-24 shrink-0 tabular-nums text-fg-muted">{formatDmy(entry.date)}</span>
              <span className="w-12 shrink-0 text-fg-faint">{entry.shift === 'penuh' ? '' : entry.shift}</span>
              <span className="min-w-0 flex-1 truncate">
                {entry.name}
                {entry.btkv ? <span className="text-fg-muted"> · BTKV {entry.btkv}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="primary"
          disabled={shifts.length === 0}
          onClick={() => {
            if (onUse(text)) {
              setText('');
              setOpen(false);
            }
          }}
        >
          {shifts.length > 0 ? `Pakai jadwal ini (${shifts.length} shift)` : 'Pakai jadwal ini'}
        </Button>
      </div>
    </div>
  );
}

function ScheduleTile({
  label,
  cadence,
  summary,
  version,
  gaps,
  busy,
  warning = 'ok',
  legacy = false,
  onFile,
}: {
  label: string;
  cadence: string;
  /** Read by an older Plano with no source kept, so it cannot heal itself. */
  legacy?: boolean;
  /** `1 Okt – 15 Nov · 60 shift`, or null when not imported. */
  summary: string | null;
  version: string | null;
  /** Dates the sheet should cover and does not. */
  gaps: readonly string[];
  busy: boolean;
  /** From `rosterFreshness`: red when outdated, amber when ending. */
  warning?: RosterFreshness['state'];
  onFile: (file: File) => void;
}): JSX.Element {
  const [dragging, setDragging] = useState(false);
  const state = !summary
    ? 'missing'
    : warning === 'outdated'
      ? 'outdated'
      : warning === 'ending' || gaps.length > 0 || legacy
        ? 'attention'
        : 'ok';

  return (
    <label
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) onFile(file);
      }}
      className={[
        'group flex min-h-[4.5rem] min-w-0 cursor-pointer flex-col gap-1 rounded-xl border px-3 py-2.5 transition-colors',
        dragging
          ? 'border-accent bg-[var(--accent-soft)]'
          : state === 'outdated'
            ? 'border-danger bg-[var(--danger-soft)]'
            : state === 'attention'
              ? 'border-[var(--warn-strong)] bg-[var(--warn-soft)]'
              : 'border-border bg-surface hover:bg-bg-subtle',
      ].join(' ')}
    >
      <span className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={[
            'h-2 w-2 shrink-0 rounded-full',
            state === 'ok'
              ? 'bg-accent'
              : state === 'outdated'
                ? 'bg-[var(--danger)]'
                : state === 'attention'
                  ? 'bg-[var(--warn-strong)]'
                  : 'bg-fg-faint',
          ].join(' ')}
        />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold">{label}</span>
        <span className="shrink-0 text-[11px] font-medium text-accent group-hover:underline">
          {busy ? 'Membaca…' : summary ? 'Ganti' : 'Impor'}
        </span>
      </span>
      <span className="text-[11px] text-fg-muted">
        {summary ? [version, summary].filter(Boolean).join(' · ') : `Belum diimpor · ${cadence}`}
        {warning === 'outdated' ? ' · kedaluwarsa' : warning === 'ending' ? ' · hampir habis' : ''}
      </span>
      {gaps.length > 0 ? (
        <span className="text-[11px] font-medium text-[var(--warn-strong)]">
          Tidak terbaca: {describeDates(gaps)}
        </span>
      ) : null}
      {/*
        Imported before sources were kept, by a parser that has since been
        fixed: the stored copy may carry that parser's mistakes and cannot be
        re-read. One import fixes it for good (reparse.ts).
      */}
      {legacy ? (
        <span className="text-[11px] font-medium text-[var(--warn-strong)]">
          Dibaca Plano versi lama — impor ulang PDF ini sekali.
        </span>
      ) : null}
      <input
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Reset so re-importing the same file fires a change event again —
          // otherwise a failed import cannot be retried without renaming it.
          event.target.value = '';
          if (file) onFile(file);
        }}
      />
    </label>
  );
}

/** `Hari ini`, `Besok`, `Kemarin`, `3 hari lagi`, `2 hari lalu`. */
function relativeDay(date: string, today: string): string {
  const days = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );
  if (!Number.isFinite(days)) return '';
  if (days === 0) return 'Hari ini';
  if (days === 1) return 'Besok';
  if (days === -1) return 'Kemarin';
  return days > 0 ? `${days} hari lagi` : `${-days} hari lalu`;
}

function previousDate(date: string): string {
  const at = new Date(`${date}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() - 1);
  return at.toISOString().slice(0, 10);
}

/**
 * Pick who is on a post: type a nickname, choose from the rota.
 *
 * Free text is kept as the fallback rather than removed. Paediatrics keeps its
 * own roster and never appears in the legend, so that name can only ever be
 * typed — a picker that refused anything off-list would make the one post that
 * needs hand entry the one post it cannot do.
 *
 * The list appears only while typing and closes on pick or blur. It is not a
 * permanent dropdown: nine of ten rows are already correct, and a control that
 * demands attention on all ten to fix one is a worse trade than a field that
 * looks like text until you use it.
 */
function ResidentPicker({
  value,
  directory,
  label,
  onPick,
  onLink,
}: {
  value: string;
  directory: readonly Resident[];
  label: string;
  onPick: (swap: PostSwap | null) => void;
  /** Link initials to a Jarkom row; see `store.setJarkomLink`. */
  onLink: (initials: string, jarkomName: string) => void;
}): JSX.Element {
  const [query, setQuery] = useState<string | null>(null);
  const matches = query === null ? [] : searchResidents(directory, query);

  return (
    <span className="relative">
      <input
        value={query ?? value}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={() => {
          // A typed name that matched nobody is still a name. Committed on
          // blur so paediatrics — which can never match — is not lost.
          if (query !== null && query !== value) onPick(query.trim() ? { name: query } : null);
          setQuery(null);
        }}
        placeholder={label}
        aria-label={`Nama untuk ${label}`}
        className="min-w-0 max-w-[10rem] rounded border border-transparent bg-transparent px-1 text-sm font-medium hover:border-border focus:border-border"
      />
      {matches.length > 0 ? (
        <ul className="absolute left-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          {matches.map((resident) =>
            resident.ambiguous.length > 1 ? (
              /*
                The legend name fits more than one Jarkom row, so "this
                resident" has no nickname or agama yet. Offer each row: the
                pick both links the initials to that row (fixing them
                everywhere) and swaps them in.
              */
              resident.ambiguous.map((entry) => (
                <li key={`${resident.initials}:${entry.name}`}>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onLink(resident.initials, entry.name);
                      onPick({
                        name: entry.panggilan,
                        initials: resident.initials,
                        ...(entry.muslim === null ? {} : { muslim: entry.muslim }),
                      });
                      setQuery(null);
                    }}
                    className="block w-full px-2 py-1.5 text-left text-xs hover:bg-bg-subtle"
                  >
                    <span className="font-medium">{entry.panggilan}</span>
                    <span className="ml-1 text-fg-faint">{resident.initials}</span>
                    <span className="block truncate text-[10px] text-fg-muted">{entry.name}</span>
                    <span className="block truncate text-[10px] text-[var(--warn-strong)]">
                      Jadwal: {resident.name} — pilih yang benar
                    </span>
                  </button>
                </li>
              ))
            ) : (
            <li key={resident.initials}>
              <button
                type="button"
                // `onMouseDown`, not `onClick`: blur fires first on a click and
                // would commit the half-typed query before the pick landed.
                onMouseDown={(event) => {
                  event.preventDefault();
                  onPick({
                    name: resident.panggilan ?? resident.name,
                    initials: resident.initials,
                    ...(resident.muslim === null ? {} : { muslim: resident.muslim }),
                  });
                  setQuery(null);
                }}
                className="block w-full px-2 py-1.5 text-left text-xs hover:bg-bg-subtle"
              >
                <span className="font-medium">{resident.panggilan ?? resident.name}</span>
                <span className="ml-1 text-fg-faint">{resident.initials}</span>
                <span className="block truncate text-[10px] text-fg-muted">{resident.name}</span>
              </button>
            </li>
            ),
          )}
        </ul>
      ) : null}
    </span>
  );
}

/**
 * "Kembalikan ke jadwal": a two-step button, the same pattern Settings uses
 * for discarding a template. The first tap arms and says exactly what will be
 * cleared; the second clears. Keyed by date and shift at the call site, so
 * moving to another shift disarms it.
 *
 * Hidden when there is nothing to reset. A button that does nothing is one
 * people stop trusting.
 */
function ResetFormasi({
  counts,
  sharedDpjp,
  onReset,
}: {
  counts: { swaps: number; dpjp: number };
  /** Pagi/Malam: the DPJP swaps are per date, so the other shift shares them. */
  sharedDpjp: boolean;
  onReset: () => void;
}): JSX.Element | null {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return undefined;
    const timer = window.setTimeout(() => setArmed(false), 5000);
    return () => window.clearTimeout(timer);
  }, [armed]);

  if (counts.swaps + counts.dpjp === 0) return null;

  const parts = [
    counts.swaps > 0 ? `${counts.swaps} tukar jaga` : null,
    counts.dpjp > 0
      ? `DPJP ${counts.dpjp} tanggal${sharedDpjp ? ' (juga untuk shift lain di tanggal itu)' : ''}`
      : null,
  ].filter(Boolean);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!armed) {
            setArmed(true);
            return;
          }
          setArmed(false);
          onReset();
        }}
        aria-describedby={armed ? 'reset-formasi-detail' : undefined}
        className={[
          'min-h-tap shrink-0 rounded-lg border px-3 text-xs font-medium',
          armed ? 'border-danger text-danger' : 'border-border text-fg-muted',
        ].join(' ')}
      >
        {armed ? 'Ketuk lagi untuk reset' : 'Kembalikan ke jadwal'}
      </button>
      {armed ? (
        <p id="reset-formasi-detail" role="status" className="order-last basis-full text-[11px] text-danger">
          Akan dihapus: {parts.join(' & ')}. Konfirmasi untuk pos yang ditukar ikut dihapus;
          koreksi nama dan agama tetap.
        </p>
      ) : null}
    </>
  );
}
