import { useState } from 'react';

import type { CensusComparison, CompareBlock } from '@/domain/census/compare';
import { PLACE_LABEL } from '@/domain/census/maker';
import { Segmented } from '@/components/common/ui';

/**
 * Bandingkan (2026-10-11): each pasted list, patient by patient, beside the
 * census row it became. One row per patient block, so checking the census is
 * reading down one column of pairs instead of hunting between a 200-line
 * paste and the message.
 *
 *   green  this DPJP, in the census       red    this DPJP, NOT in the census
 *   amber  no DPJP code on the line       grey   another DPJP (collapsed)
 *
 * And at the end, the census rows no list block accounts for.
 */

// Inline, not a border class: the list's `divide-y` sets every side's
// border colour on its children and would win over a class.
const TONE: Record<'in' | 'out' | 'unassigned' | 'other', string> = {
  in: 'var(--accent)',
  out: 'var(--danger)',
  unassigned: 'var(--warn-strong)',
  other: 'var(--border)',
};

function tone(block: CompareBlock): keyof typeof TONE {
  if (block.row !== null) return 'in';
  if (block.owner === 'mine') return 'out';
  if (block.owner === 'unassigned') return 'unassigned';
  return 'other';
}

export function SensusCompare({
  comparison,
  texts,
  labels,
  code,
  message,
  checked,
  onCheck,
}: {
  comparison: CensusComparison;
  texts: readonly string[];
  labels: readonly string[];
  code: string;
  /** The census message as it will be copied, for the full-text view. */
  message: string | null;
  /** Patient keys ticked by hand (kept with the day, per DPJP). */
  checked: ReadonlySet<string>;
  onCheck: (key: string, on: boolean) => void;
}): JSX.Element {
  const [showOthers, setShowOthers] = useState(false);
  const [view, setView] = useState<'pasien' | 'teks'>('pasien');
  const { rows, missing, unmatched } = comparison;
  const matched = rows.length - unmatched.length;
  // What has to be checked by hand: every census row, and every patient of
  // this DPJP the census left out.
  const toCheck = new Set([...rows.map((row) => row.key), ...missing.map((block) => block.entry.key)]);
  const done = [...toCheck].filter((key) => checked.has(key)).length;

  return (
    <div className="space-y-3">
      <Segmented
        label="Cara membandingkan"
        size="sm"
        value={view}
        onChange={setView}
        options={[
          ['pasien', 'Per pasien'],
          ['teks', 'Teks lengkap'],
        ]}
      />
      {view === 'teks' ? (
        <FullText texts={texts} labels={labels} message={message} />
      ) : (
      <>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs">
        <span className="font-semibold">Sensus {code}: {rows.length} pasien</span>
        <span className="text-accent">✓ {matched} cocok dengan list</span>
        <span className={missing.length > 0 ? 'font-semibold text-[var(--danger)]' : 'text-fg-muted'}>
          ✗ {missing.length} di list, tidak di sensus
        </span>
        <span className={unmatched.length > 0 ? 'font-semibold text-[var(--danger)]' : 'text-fg-muted'}>
          ? {unmatched.length} di sensus, tidak ditemukan di list
        </span>
        <span className={done === toCheck.size && toCheck.size > 0 ? 'font-semibold text-accent' : 'font-semibold'}>
          Dicek manual {done}/{toCheck.size}
        </span>
        <label className="ml-auto flex min-h-tap items-center gap-1.5 text-fg-muted [@media(pointer:fine)]:min-h-8">
          <input type="checkbox" checked={showOthers} onChange={(event) => setShowOthers(event.target.checked)} />
          Tampilkan pasien DPJP lain
        </label>
      </div>

      {comparison.lists.map((blocks, list) => {
        const lines = (texts[list] ?? '').split(/\r?\n/);
        // Consecutive other-DPJP blocks fold into one line unless shown.
        const items: Array<{ kind: 'block'; block: CompareBlock } | { kind: 'fold'; count: number; codes: string[] }> = [];
        for (const block of blocks) {
          if (block.owner === 'other' && !showOthers) {
            const last = items[items.length - 1];
            if (last?.kind === 'fold') {
              last.count += 1;
              for (const dpjp of block.entry.dpjps) if (!last.codes.includes(dpjp)) last.codes.push(dpjp);
            } else items.push({ kind: 'fold', count: 1, codes: [...block.entry.dpjps] });
          } else items.push({ kind: 'block', block });
        }
        return (
          <section key={list} aria-label={`Bandingkan list ${list + 1}`} className="overflow-hidden rounded-xl border border-border bg-surface">
            <p className="border-b border-border px-3 py-1.5 text-xs font-semibold">
              List {list + 1} <span className="font-normal text-fg-muted">· {labels[list]}</span>
            </p>
            {blocks.length === 0 ? (
              <p className="px-3 py-2 text-[11px] text-fg-faint">Tidak ada pasien yang terbaca dari list ini.</p>
            ) : null}
            <ol className="divide-y divide-border">
              {items.map((item, index) =>
                item.kind === 'fold' ? (
                  <li key={`fold-${index}`} className="px-3 py-1 text-[11px] text-fg-faint">
                    · {item.count} pasien DPJP lain{item.codes.length > 0 ? ` (${item.codes.join(', ')})` : ''}
                  </li>
                ) : (
                  <li
                    key={`${item.block.start}`}
                    style={{ borderLeft: `4px solid ${TONE[tone(item.block)]}` }}
                    className="grid gap-x-3 gap-y-1 px-3 py-2 lg:grid-cols-2"
                  >
                    <pre className="min-w-0 whitespace-pre-wrap break-words font-mono text-[11px] leading-snug text-fg-muted">
                      {lines
                        .slice(item.block.start, item.block.end)
                        .join('\n')
                        .replace(/\s+$/, '')}
                    </pre>
                    <div className="min-w-0 space-y-1">
                      <RowSide comparison={comparison} block={item.block} />
                      {item.block.row !== null || item.block.owner === 'mine' ? (
                        <label className="flex min-h-tap w-fit items-center gap-2 text-[11px] font-medium [@media(pointer:fine)]:min-h-7">
                          <input
                            type="checkbox"
                            checked={checked.has(item.block.entry.key)}
                            onChange={(event) => onCheck(item.block.entry.key, event.target.checked)}
                            className="h-4 w-4"
                          />
                          Sudah saya cek
                        </label>
                      ) : null}
                    </div>
                  </li>
                ),
              )}
            </ol>
          </section>
        );
      })}

      {unmatched.length > 0 ? (
        <section aria-label="Di sensus, tidak ditemukan di list" className="rounded-xl border border-[var(--danger)] bg-surface">
          <p className="border-b border-border px-3 py-1.5 text-xs font-semibold text-[var(--danger)]">
            Di sensus, tidak ditemukan di list mana pun
          </p>
          <ul className="divide-y divide-border">
            {unmatched.map((row) => (
              <li key={row.index} className="px-3 py-2 text-xs">
                <p className="font-medium">
                  {PLACE_LABEL[row.place]} #{row.number} · {row.identity}
                </p>
                <p className="text-[11px] text-fg-muted">{row.diagnoses.length > 0 ? row.diagnoses.join(' · ') : 'Diagnosis: -'}</p>
                <label className="mt-1 flex min-h-tap w-fit items-center gap-2 text-[11px] font-medium [@media(pointer:fine)]:min-h-7">
                  <input
                    type="checkbox"
                    checked={checked.has(row.key)}
                    onChange={(event) => onCheck(row.key, event.target.checked)}
                    className="h-4 w-4"
                  />
                  Sudah saya cek
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      </>
      )}
    </div>
  );
}

/**
 * The pasted lists and the census message as plain text, side by side on a
 * laptop and one under the other on a phone, each scrolling on its own: for
 * reading the two by eye, exactly as they are.
 */
function FullText({
  texts,
  labels,
  message,
}: {
  texts: readonly string[];
  labels: readonly string[];
  message: string | null;
}): JSX.Element {
  const [list, setList] = useState(0);
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <section aria-label="List yang ditempel" className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex flex-wrap gap-1 border-b border-border px-2 py-1.5">
          {texts.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-pressed={list === index}
              onClick={() => setList(index)}
              className={`min-h-tap rounded-lg px-2 text-xs [@media(pointer:fine)]:min-h-7 ${list === index ? 'bg-bg-subtle font-semibold text-accent' : 'text-fg-muted'}`}
            >
              List {index + 1} · {labels[index]}
            </button>
          ))}
        </div>
        <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words px-3 py-2 font-mono text-[11px] leading-relaxed">
          {texts[list] ?? ''}
        </pre>
      </section>
      <section aria-label="Hasil sensus" className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface">
        <p className="border-b border-border px-3 py-2 text-xs font-semibold">Hasil sensus</p>
        <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words px-3 py-2 font-mono text-[11px] leading-relaxed">
          {message ?? 'Belum ada hasil sensus.'}
        </pre>
      </section>
    </div>
  );
}

function RowSide({ comparison, block }: { comparison: CensusComparison; block: CompareBlock }): JSX.Element {
  if (block.row === null) {
    return (
      <p
        className={`text-xs font-medium ${
          block.owner === 'mine' ? 'text-[var(--danger)]' : block.owner === 'unassigned' ? 'text-[var(--warn-strong)]' : 'text-fg-faint'
        }`}
      >
        {block.owner === 'mine'
          ? '✗ Tidak masuk sensus'
          : block.owner === 'unassigned'
            ? '? Tanpa kode DPJP — tidak masuk (lihat Perlu dicek)'
            : `DPJP ${block.entry.dpjps.join(', ')}`}
      </p>
    );
  }
  const row = comparison.rows[block.row]!;
  return (
    <div className="min-w-0 text-xs">
      <p className="font-medium">
        <span className="text-accent">✓ {PLACE_LABEL[row.place]} #{row.number}</span> · {row.identity}
      </p>
      {/* One line each, like the list beside it, so the two read across. */}
      <p className="text-[11px] text-fg-muted">Diagnosis:</p>
      <ul className="text-[11px] leading-snug text-fg-muted">
        {row.diagnoses.length > 0 ? row.diagnoses.map((line, index) => <li key={index}>{line}</li>) : <li>-</li>}
      </ul>
    </div>
  );
}
