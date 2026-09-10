import { useMemo, useState } from 'react';

import {
  auditText,
  comparePaste,
  findQuestionMarks,
} from '@/domain/format/inspectPaste';

/**
 * "Periksa hasil salin" — the instrument for the `?` in SIMGOS.
 *
 * Everything it reports is computed here and now, from what is in the boxes.
 * It stores nothing, sends nothing and knows nothing about the patient whose
 * note is pasted into it, which is why it can sit in Settings and be used with
 * real text without thinking about it.
 *
 * The second box is optional and is the one that answers the question. One box
 * tells you what a text contains; two tell you what the round trip DID to it,
 * which is the only way to say whether the fault is on this side or the other.
 */
export function PasteInspector(): JSX.Element {
  const [sent, setSent] = useState('');
  const [received, setReceived] = useState('');

  const audit = useMemo(() => auditText(sent), [sent]);
  const marks = useMemo(() => findQuestionMarks(sent), [sent]);
  const receivedAudit = useMemo(() => auditText(received), [received]);
  const receivedMarks = useMemo(() => findQuestionMarks(received), [received]);
  const diff = useMemo(
    () => (sent.trim() && received.trim() ? comparePaste(sent, received) : null),
    [sent, received],
  );

  return (
    <div className="space-y-4 text-sm">
      <div>
        <label htmlFor="paste-sent" className="block text-xs font-medium text-fg-muted">
          1. Teks yang disalin dari Plano
        </label>
        <textarea
          id="paste-sent"
          value={sent}
          onChange={(event) => setSent(event.target.value)}
          rows={5}
          placeholder="Tempel di sini…"
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs"
        />
        <Verdict
          label="Hasil salin Plano"
          empty={sent.trim().length === 0}
          offenders={audit}
          marks={marks}
        />
      </div>

      <div>
        <label htmlFor="paste-received" className="block text-xs font-medium text-fg-muted">
          2. Teks yang sudah ditempel di SIMGOS, lalu disalin balik (opsional)
        </label>
        <textarea
          id="paste-received"
          value={received}
          onChange={(event) => setReceived(event.target.value)}
          rows={5}
          placeholder="Tempel di sini untuk membandingkan…"
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs"
        />
        {received.trim().length > 0 ? (
          <Verdict
            label="Hasil dari SIMGOS"
            empty={false}
            offenders={receivedAudit}
            marks={receivedMarks}
          />
        ) : null}
      </div>

      {diff ? (
        <div className="rounded-lg border border-border px-3 py-2 text-xs">
          {diff.identical ? (
            <p className="font-medium text-accent">
              Kedua teks sama persis. Tidak ada yang berubah dalam perjalanan.
            </p>
          ) : (
            <>
              <p className="font-medium">
                Berbeda mulai baris {diff.firstDiffLine} ({diff.changedLines.length} baris
                berbeda
                {diff.changedLines.length === 20 ? ', ditampilkan 20 pertama' : ''}).
              </p>
              <ul className="mt-2 space-y-2">
                {diff.changedLines.map((entry) => (
                  <li key={entry.line}>
                    <p className="text-fg-faint">Baris {entry.line}</p>
                    <p className="break-words font-mono text-[11px] text-fg-muted">
                      Plano: {entry.before || '(kosong)'}
                    </p>
                    <p className="break-words font-mono text-[11px] text-danger">
                      SIMGOS: {entry.after || '(kosong)'}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The reading for one box.
 *
 * A literal `?` is reported SEPARATELY from non-ASCII characters, and the
 * distinction is the whole diagnostic. A non-ASCII character is something
 * Plano put on the clipboard and could fix. A `?` is already an ASCII
 * character — nothing downstream will ever turn it back — so finding one here
 * means the substitution happened before this text arrived, which points at
 * whatever produced it rather than at the formatter.
 */
function Verdict({
  label,
  empty,
  offenders,
  marks,
}: {
  label: string;
  empty: boolean;
  offenders: ReturnType<typeof auditText>;
  marks: ReturnType<typeof findQuestionMarks>;
}): JSX.Element | null {
  if (empty) return null;

  if (offenders.length === 0 && marks.length === 0) {
    return (
      <p className="mt-1 text-xs text-accent">
        {label}: bersih. Semua karakter ASCII, tidak ada tanda tanya.
      </p>
    );
  }

  return (
    <div className="mt-1 space-y-1 text-xs">
      {marks.length > 0 ? (
        <div>
          <p className="font-medium text-danger">
            {label}: {marks.length} tanda tanya (?) ditemukan.
          </p>
          <ul className="mt-0.5 space-y-0.5 text-fg-muted">
            {marks.slice(0, 10).map((hit) => (
              <li key={`${hit.line}-${hit.column}`} className="break-words font-mono text-[11px]">
                baris {hit.line}:{hit.column} — …{hit.context}…
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {offenders.length > 0 ? (
        <div>
          <p className="font-medium text-danger">
            {label}: {offenders.length} karakter non-ASCII — SIMGOS menampilkannya sebagai ?
          </p>
          <ul className="mt-0.5 space-y-0.5 text-fg-muted">
            {offenders.slice(0, 12).map((hit, index) => (
              <li key={`${hit.code}-${hit.line}-${hit.column}-${index}`} className="text-[11px]">
                baris {hit.line}:{hit.column} — <span className="font-mono">{hit.code}</span>
                {hit.note ? ` · ${hit.note}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
