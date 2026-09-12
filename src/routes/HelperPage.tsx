import { useMemo, useState } from 'react';

import { copyText } from '@/lib/clipboard';
import { extractPdfItems } from '@/lib/pdfItems';
import { buildFormasi, buildKonfirmasi, longDate, resolveShift } from '@/domain/jaga/formasi';
import type { JagaPostId } from '@/domain/jaga/types';
import { parseDpjpRoster } from '@/domain/jaga/parseDpjp';
import { parseJagaRoster } from '@/domain/jaga/parseRoster';
import { parseJarkom } from '@/domain/jaga/parseJarkom';
import {
  readConfirmed,
  readDpjp,
  readJarkom,
  readRoster,
  readNameOverrides,
  readSender,
  writeConfirmed,
  writeDpjp,
  setNameOverride,
  writeJarkom,
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
  const [sender, setSender] = useState(() => readSender());
  const [busy, setBusy] = useState<string | null>(null);
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

  const posts = useMemo(
    () => (shift && roster ? resolveShift(shift, roster, jarkom, overrides) : []),
    [shift, roster, jarkom, overrides],
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
        ? buildFormasi(shift, posts, dpjp, new Date(), confirmed as ReadonlySet<JagaPostId>)
        : '',
    [shift, posts, dpjp, confirmed],
  );

  const staffed = posts.filter((post) => post.initials);
  const outstanding = staffed.filter((post) => !confirmed.has(post.id)).length;

  async function importPdf(
    file: File,
    kind: 'roster' | 'dpjp' | 'jarkom',
  ): Promise<void> {
    setBusy(kind);
    setError(null);
    try {
      const items = await extractPdfItems(file);
      if (kind === 'roster') {
        const parsed = parseJagaRoster(items);
        if (parsed.shifts.length === 0) throw new Error('Tidak ada baris jaga terbaca.');
        writeRoster(parsed);
        setRoster(parsed);
      } else if (kind === 'dpjp') {
        const parsed = parseDpjpRoster(items);
        if (parsed.days.length === 0) throw new Error('Tidak ada tanggal DPJP terbaca.');
        writeDpjp(parsed);
        setDpjp(parsed);
      } else {
        const parsed = parseJarkom(items);
        if (parsed.entries.length === 0) throw new Error('Tidak ada nama terbaca.');
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
          Impor tiga PDF sekali sebulan, lalu pilih tanggal. Formasi dan pesan konfirmasi
          disusun dari situ.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">1. Impor jadwal</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <ImportCard
            label="Jadwal Jaga PPDS"
            detail={roster ? `${roster.shifts.length} shift · ${roster.title}` : 'Belum diimpor'}
            busy={busy === 'roster'}
            onFile={(file) => void importPdf(file, 'roster')}
          />
          <ImportCard
            label="Jadwal DPJP"
            detail={dpjp ? `${dpjp.days.length} hari` : 'Belum diimpor'}
            busy={busy === 'dpjp'}
            onFile={(file) => void importPdf(file, 'dpjp')}
          />
          <ImportCard
            label="Daftar Jarkom"
            detail={jarkom ? `${jarkom.entries.length} residen` : 'Belum diimpor'}
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
            <div className="flex items-center gap-2">
              <h2 className="flex-1 text-sm font-medium">3. Formasi Jaga</h2>
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
                if (!post.initials) return null;
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
                        <input
                          value={post.display}
                          onChange={(event) =>
                            setOverrides(setNameOverride(post.initials, event.target.value))
                          }
                          aria-label={`Nama untuk ${post.label}`}
                          className="min-w-0 max-w-[10rem] rounded border border-transparent bg-transparent px-1 text-sm font-medium hover:border-border focus:border-border"
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
                      {post.muslim === null ? (
                        <span className="text-[10px] text-danger">agama tidak diketahui</span>
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

                    <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-fg-muted">
                      {message}
                    </p>
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
