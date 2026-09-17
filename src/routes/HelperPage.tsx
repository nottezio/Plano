import { useEffect, useMemo, useState } from 'react';

import { useJagaSync } from '@/hooks/useJagaSync';

import { copyText } from '@/lib/clipboard';
import { extractPdf } from '@/lib/pdfItems';
import { describeVersion, nearestYear, refuseOlder } from '@/domain/jaga/recency';
import {
  buildFormasi,
  buildKonfirmasi,
  longDate,
  nextDate,
  resolveShift,
} from '@/domain/jaga/formasi';
import type { JagaPostId } from '@/domain/jaga/types';
import type { PostSwap } from '@/domain/jaga/store';
import { buildDirectory, searchResidents, type Resident } from '@/domain/jaga/directory';
import { describeMismatch, identifyJagaPdf } from '@/domain/jaga/identify';
import { parseDpjpRoster } from '@/domain/jaga/parseDpjp';
import { parseJagaRoster } from '@/domain/jaga/parseRoster';
import { parseJarkom } from '@/domain/jaga/parseJarkom';
import { parsePediatri, pediatriFor } from '@/domain/jaga/parsePediatri';
import {
  readConfirmed,
  readDpjp,
  readJarkom,
  readRoster,
  readDpjpEdit,
  readNameOverrides,
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
export function HelperPage(): JSX.Element {
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
  const [shiftIndex, setShiftIndex] = useState(0);
  const shift = shifts[Math.min(shiftIndex, shifts.length - 1)] ?? null;

  const [overrides, setOverrides] = useState(() => readNameOverrides());

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
  const directory = useMemo(() => buildDirectory(roster, jarkom), [roster, jarkom]);
  const [dpjpEdits, setDpjpEdits] = useState<
    Record<string, { utama?: string; tindakan?: string }>
  >({});
  const [editKey, setEditKey] = useState('');

  const posts = useMemo(
    () =>
      shift && roster
        ? resolveShift(
            shift,
            roster,
            jarkom,
            overrides,
            postEdits,
            religion,
            pediatriFor(pediatri, shift.date, shift.shift),
          )
        : [],
    [shift, roster, jarkom, overrides, postEdits, religion, pediatri],
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
        const parsed = { ...parseJagaRoster(items), source: stamp };
        if (parsed.shifts.length === 0) throw new Error('Tidak ada baris jaga terbaca.');
        if (!guard(parsed, roster)) return;
        writeRoster(parsed);
        setRoster(parsed);
      } else if (kind === 'dpjp') {
        const parsed = { ...parseDpjpRoster(items), source: stamp };
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
        };
        if (parsed.shifts.length === 0) throw new Error('Tidak ada baris jaga pediatri terbaca.');
        if (!guard(parsed, pediatri)) return;
        writePediatri(parsed);
        setPediatri(parsed);
      } else {
        const parsed = { ...parseJarkom(items), source: stamp };
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

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-4">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold">Konfirmasi Jaga</h1>
          <span className="rounded-full border border-current/40 px-2 py-0.5 text-[10px] font-semibold text-danger">
            Work in progress
          </span>
        </div>
        <p className="text-xs text-fg-muted">
          Impor jadwalnya, lalu pilih tanggal. Formasi dan pesan konfirmasi
          disusun dari situ.
        </p>
        {/*
          Said where the edits are made, not in a help page.

          Every change on this screen is synced to the account (see
          `useJagaSync`) and applies only to the date it was made for. The PDFs remain the source of truth: re-importing a
          new month replaces the schedule wholesale, and a swap entered against
          a date in the old one simply stops applying. That is the intended
          behaviour rather than a limitation — a tukar jaga is a fact about one
          night, and carrying it into a schedule nobody has checked it against
          would be worse than losing it.
        */}
        <p className="text-[11px] text-fg-faint">
          Jadwal yang diimpor dan perubahan di layar ini (konfirmasi, tukar jaga, nama, agama,
          DPJP) disinkronkan ke akun Anda dan berlaku hanya untuk tanggalnya. Sumber utamanya
          tetap PDF jadwal.
        </p>
        <p
          role="status"
          className={[
            'text-[11px]',
            sync.status === 'error' ? 'text-danger' : 'text-fg-muted',
          ].join(' ')}
        >
          {sync.status === 'synced'
            ? 'Sinkron dengan akun.'
            : sync.status === 'waiting'
              ? 'Menunggu koneksi untuk sinkron. Perubahan tetap tersimpan di perangkat ini.'
              : sync.status === 'error'
                ? 'Sinkron gagal. Perubahan tetap tersimpan di perangkat ini.'
                : 'Belum masuk akun: tersimpan di perangkat ini saja.'}
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">1. Impor jadwal</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <ImportCard
            label="Jadwal Jaga PPDS"
            detail={
              roster
                ? `${roster.shifts.length} shift · ${describeVersion('roster', roster)}`
                : 'Belum diimpor · tiap bulan'
            }
            busy={busy === 'roster'}
            onFile={(file) => void importPdf(file, 'roster')}
          />
          <ImportCard
            label="Jadwal DPJP"
            detail={
              dpjp
                ? `${dpjp.days.length} hari · ${describeVersion('dpjp', dpjp)}`
                : 'Belum diimpor · tiap bulan'
            }
            busy={busy === 'dpjp'}
            onFile={(file) => void importPdf(file, 'dpjp')}
          />
          <ImportCard
            label="Jadwal Jaga Pediatri"
            detail={
              pediatri
                ? `${pediatri.shifts.length} shift · ${describeVersion('pediatri', pediatri)}`
                : 'Belum diimpor · tiap bulan'
            }
            busy={busy === 'pediatri'}
            onFile={(file) => void importPdf(file, 'pediatri')}
          />
          <ImportCard
            label="Daftar Jarkom"
            // Per SEMESTER, not per month: new residents arrive twice a year,
            // and a monthly prompt for a document that changes every six
            // months is a prompt people learn to ignore.
            detail={
              jarkom
                ? `${jarkom.entries.length} residen · ${describeVersion('jarkom', jarkom)}`
                : 'Belum diimpor · per semester'
            }
            busy={busy === 'jarkom'}
            onFile={(file) => void importPdf(file, 'jarkom')}
          />
        </div>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">2. Pilih tanggal jaga</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setShiftIndex(0);
            }}
            className="min-h-tap rounded-lg border border-border bg-surface px-3 text-sm"
          />
          <span className="text-xs text-fg-muted">{longDate(date)}</span>
          {date === today ? <span className="text-xs text-fg-faint">(hari ini)</span> : null}
        </div>

        {/*
          Weekends carry two teams — `Minggu Pagi` and `Minggu Malam` are
          different people entirely — so the shift is chosen, never assumed.
          On a weekday there is one and the control does not appear.
        */}
        {shifts.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {shifts.map((option, index) => (
              <button
                key={option.hari}
                type="button"
                aria-pressed={index === shiftIndex}
                onClick={() => setShiftIndex(index)}
                className={[
                  'min-h-tap rounded-full border px-3 text-xs font-medium',
                  index === shiftIndex ? 'border-accent text-accent' : 'border-border text-fg-muted',
                ].join(' ')}
              >
                {option.hari}
              </button>
            ))}
          </div>
        ) : null}

        {!roster ? (
          <p className="text-xs text-fg-muted">Impor Jadwal Jaga PPDS dulu.</p>
        ) : shifts.length === 0 ? (
          <p className="text-xs text-danger">
            Tanggal ini tidak ada di jadwal yang diimpor ({roster.title}).
          </p>
        ) : null}
      </section>

      {shift ? (
        <>
          <section className="space-y-2">
            {/* Wraps only for the reset's explanation line, which is
                `basis-full` text; the controls stay on the title row. */}
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="flex-1 text-sm font-medium">3. Formasi Jaga</h2>
              <ResetFormasi
                key={currentKey}
                counts={shiftEditCounts}
                sharedDpjp={shift.shift !== 'penuh'}
                onReset={resetFormasi}
              />
              <button
                type="button"
                onClick={() => void copyText(formasi)}
                className="min-h-tap rounded-lg border border-border px-3 text-xs font-medium"
              >
                Salin
              </button>
            </div>
            <pre className="whitespace-pre-wrap rounded-lg border border-border bg-surface px-3 py-2 text-xs leading-relaxed">
              {formasi}
            </pre>
            {!dpjp ? (
              <p className="text-xs text-fg-muted">
                Blok DPJP kosong — impor Jadwal DPJP untuk mengisinya.
              </p>
            ) : null}

            {/*
              Consultants swap too, and the published roster is a month old by
              the time it is used. Edited BY DATE, not by position: an edit
              made tonight against "setelah 00.00" is the same edit read
              tomorrow as "hari ini", so keying it any other way would need it
              entered twice.
            */}
            <details className="text-xs">
              <summary className="min-h-tap cursor-pointer text-fg-muted">
                Ubah DPJP (tukar jaga)
              </summary>
              <div className="mt-2 space-y-2">
                {[
                  { date: shift.date, label: longDate(shift.date) },
                  { date: nextDate(shift.date), label: `setelah 00.00 — ${longDate(nextDate(shift.date))}` },
                ].map(({ date, label }) => (
                  <div key={date} className="space-y-1">
                    <p className="text-fg-faint">{label}</p>
                    {(['utama', 'tindakan'] as const).map((field) => (
                      <input
                        key={field}
                        value={dpjpEdits[date]?.[field] ?? ''}
                        onChange={(event) => {
                          const next = setDpjpEdit(date, {
                            ...dpjpEdits[date],
                            [field]: event.target.value,
                          });
                          setDpjpEdits((current) => ({ ...current, [date]: next }));
                        }}
                        placeholder={
                          field === 'utama'
                            ? (dpjp?.days.find((day) => day.date === date)?.utama ??
                              'DPJP Utama')
                            : (dpjp?.days.find((day) => day.date === date)?.tindakan ??
                              'DPJP Tindakan')
                        }
                        className="min-h-tap w-full rounded-lg border border-border bg-surface px-3 text-xs"
                      />
                    ))}
                  </div>
                ))}
                <p className="text-fg-faint">
                  Kosongkan untuk memakai jadwal yang diimpor.
                </p>
              </div>
            </details>
          </section>

          <section className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="flex-1 text-sm font-medium">4. Konfirmasi tiap senior</h2>
              <span className="text-xs text-fg-muted">
                {outstanding === 0
                  ? `${staffed.length} dari ${staffed.length} terkonfirmasi`
                  : `${outstanding} belum konfirmasi`}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                value={sender.name}
                onChange={(event) => {
                  const next = { ...sender, name: event.target.value };
                  setSender(next);
                  writeSender(next);
                }}
                placeholder="Nama saya (mis. Avi)"
                className="min-h-tap min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm"
              />
              <input
                value={sender.place}
                onChange={(event) => {
                  const next = { ...sender, place: event.target.value };
                  setSender(next);
                  writeSender(next);
                }}
                placeholder="Pos saya (mis. Bangsal PJT A)"
                className="min-h-tap min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm"
              />
            </div>

            <ul className="space-y-2">
              {posts.map((post) => {
                const message = buildKonfirmasi(
                  post,
                  {
                    senderName: sender.name || '(nama)',
                    senderPlace: sender.place || '(pos)',
                    date: shift.date,
                  },
                  new Date(),
                );
                return (
                  <li key={post.id} className="rounded-lg border border-border px-3 py-2">
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
                      {!confirmed.has(post.id) ? (
                        <span className="text-[10px] text-fg-faint">belum konfirmasi</span>
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
                    {post.name && post.name !== post.display ? (
                      <p className="mt-0.5 text-[10px] text-fg-faint">{post.name}</p>
                    ) : null}

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
                    <div className="relative mt-1">
                      {post.swapped ? (
                        <span className="absolute right-1 top-1 rounded bg-bg-subtle px-1 text-[10px] font-medium text-fg-muted">
                          tukar jaga
                        </span>
                      ) : null}
                      <p className="whitespace-pre-wrap rounded-lg border border-border px-2 py-1.5 text-[11px] leading-relaxed text-fg-muted">
                        {message}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}

function ImportCard({
  label,
  detail,
  busy,
  onFile,
}: {
  label: string;
  detail: string;
  busy: boolean;
  onFile: (file: File) => void;
}): JSX.Element {
  return (
    <label className="flex min-h-tap cursor-pointer flex-col justify-center rounded-lg border border-border px-3 py-2">
      <span className="text-xs font-medium">{label}</span>
      <span className="text-[11px] text-fg-muted">{busy ? 'Membaca…' : detail}</span>
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
}: {
  value: string;
  directory: readonly Resident[];
  label: string;
  onPick: (swap: PostSwap | null) => void;
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
          {matches.map((resident) => (
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
          ))}
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
