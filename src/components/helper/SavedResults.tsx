import { useState } from 'react';

import { Button, Callout, ChoiceChip, INPUT } from '@/components/common/ui';
import { IconCheck, IconCopy, IconTrash } from '@/components/common/Icons';
import { deleteHelperResult, editHelperResult, restoreHelperResult } from '@/data/repositories/helperResults.repo';
import { formatLongDate } from '@/domain/clinicalDate';
import { formatDmy } from '@/domain/dateDmy';
import {
  GROUP_LABEL,
  KIND_LABEL,
  MAX_RESULT_CHARS,
  filterResults,
  groupByForDate,
  liveResults,
  type HelperResult,
  type HelperResultGroup,
} from '@/domain/helperResults';
import type { ClinicalDate } from '@/domain/types';
import { copyText } from '@/lib/clipboard';
import { useSavedResults } from './SaveResult';

/**
 * Tersimpan — every Helper result saved on this account, on every device.
 *
 * Grouped by the date each result is FOR (the census date, the shift), not
 * the moment it was saved: "the census for Thursday" is how one is looked
 * for. Search covers the text too, so a patient's name or RM finds the
 * census they were in.
 */

function dayHeader(date: string): string {
  const weekday = formatLongDate(date as ClinicalDate).split(',')[0] ?? '';
  return `${weekday}, ${formatDmy(date)}`;
}

function clock(ms: number): string {
  if (!ms) return '';
  const at = new Date(ms);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(at.getDate())}/${pad(at.getMonth() + 1)} ${pad(at.getHours())}.${pad(at.getMinutes())}`;
}

export function SavedResults(): JSX.Element {
  const { uid, results, ready, error } = useSavedResults();
  const [group, setGroup] = useState<HelperResultGroup | null>(null);
  const [query, setQuery] = useState('');
  // Deleted in this visit: kept on screen as an Undo row instead of vanishing.
  const [justDeleted, setJustDeleted] = useState<string[]>([]);

  const live = liveResults(results);
  const shown = filterResults(live, group, query);
  const undoable = results.filter((result) => result.deletedAt !== null && justDeleted.includes(result.id));

  if (error) {
    return (
      <Callout tone="danger" title="Daftar Tersimpan belum bisa dibuka" role="alert">
        Akun belum mengizinkan data ini dibaca. Biasanya selesai sendiri beberapa menit setelah
        pembaruan; coba Hard refresh nanti.
      </Callout>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="space-y-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari judul, nama pasien, RM…"
          aria-label="Cari hasil tersimpan"
          className={INPUT}
        />
        {/* One scrolling row on a phone: five chips wrapped onto three rows
            and pushed the list below the fold. */}
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 [&>*]:whitespace-nowrap">
          <ChoiceChip active={group === null} onClick={() => setGroup(null)}>
            Semua · {live.length}
          </ChoiceChip>
          {GROUP_LABEL.map(([id, label]) => {
            const count = filterResults(live, id, '').length;
            return (
              <ChoiceChip key={id} active={group === id} onClick={() => setGroup(group === id ? null : id)}>
                {label} · {count}
              </ChoiceChip>
            );
          })}
        </div>
      </div>

      {undoable.map((result) => (
        <Callout
          key={result.id}
          tone="info"
          role="status"
          title={`"${result.title}" dihapus`}
          action={
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                if (uid) void restoreHelperResult(uid, result.id).catch(() => undefined);
                setJustDeleted((ids) => ids.filter((id) => id !== result.id));
              }}
            >
              Undo
            </Button>
          }
        />
      ))}

      {!ready ? (
        <p className="text-sm text-fg-muted">Memuat…</p>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-fg-muted">
          {live.length === 0 ? (
            <>
              Belum ada yang disimpan. Tekan <b>Simpan</b> di samping <b>Salin</b> pada sensus, Formasi
              Jaga, pesan Morning Report, atau laporan Verifikasi List — hasilnya tersimpan di akun dan
              muncul di sini, di perangkat mana pun.
            </>
          ) : (
            'Tidak ada yang cocok.'
          )}
        </div>
      ) : (
        groupByForDate(shown).map(([date, items]) => (
          <section key={date} className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint">{dayHeader(date)}</h3>
            <ul className="space-y-2">
              {items.map((result) => (
                <li key={result.id}>
                  <ResultCard
                    result={result}
                    uid={uid}
                    onDeleted={() => setJustDeleted((ids) => [...ids, result.id])}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <p className="text-[11px] leading-relaxed text-fg-faint">
        Yang disimpan hanya hasil akhirnya, bukan list yang ditempel. Tersimpan di akun dan ikut
        tersinkron ke semua perangkat; menyimpan ulang hasil yang sama (jenis, tanggal, DPJP/shift)
        memperbarui simpanan yang ada, bukan membuat salinan baru.
      </p>
    </div>
  );
}

function ResultCard({
  result,
  uid,
  onDeleted,
}: {
  result: HelperResult;
  uid: string | null;
  onDeleted: () => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ title: string; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const long = result.text.split('\n').length > 8 || result.text.length > 600;

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-surface">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-1.5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold">{result.title}</span>
          <span className="block truncate text-[10px] text-fg-faint">
            {/* Time first: on a phone the end of this line is what gets cut. */}
            {clock(result.savedAt)}
            {result.editedAt ? ` · diubah ${clock(result.editedAt)}` : ''} · {KIND_LABEL[result.kind]}
          </span>
        </span>
        {editing ? null : (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing({ title: result.title, text: result.text })}
            >
              Ubah
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Hapus ${result.title}`}
              icon={<IconTrash className="h-4 w-4" />}
              onClick={() => {
                if (!uid) return;
                void deleteHelperResult(uid, result.id).catch(() => undefined);
                onDeleted();
              }}
            />
            <Button
              size="sm"
              variant={copied ? 'secondary' : 'primary'}
              icon={copied ? <IconCheck className="h-4 w-4" /> : <IconCopy className="h-4 w-4" />}
              onClick={() =>
                void copyText(result.text).then((ok) => {
                  setCopied(ok);
                  if (ok) window.setTimeout(() => setCopied(false), 1500);
                })
              }
            >
              {copied ? 'Tersalin' : 'Salin'}
            </Button>
          </>
        )}
      </header>

      {editing ? (
        <div className="space-y-2 p-3">
          <input
            value={editing.title}
            onChange={(event) => setEditing({ ...editing, title: event.target.value })}
            aria-label="Judul"
            className={INPUT}
          />
          <textarea
            value={editing.text}
            onChange={(event) => setEditing({ ...editing, text: event.target.value })}
            aria-label="Isi"
            maxLength={MAX_RESULT_CHARS}
            rows={Math.min(24, Math.max(6, editing.text.split('\n').length + 1))}
            className="w-full rounded-xl border border-border bg-surface p-3 font-mono text-xs leading-relaxed text-fg outline-none focus:border-accent"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
              Batal
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={!editing.text.trim()}
              onClick={() => {
                if (uid) {
                  void editHelperResult(uid, result.id, {
                    title: editing.title.trim() || result.title,
                    text: editing.text,
                  }).catch(() => undefined);
                }
                setEditing(null);
              }}
            >
              Simpan perubahan
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p
            className={`${open ? 'max-h-[70vh]' : 'max-h-40'} overflow-auto whitespace-pre-wrap px-3 py-2 text-[11px] leading-relaxed text-fg-muted`}
          >
            {result.text}
          </p>
          {long ? (
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="min-h-tap w-full border-t border-border text-[11px] font-medium text-accent [@media(pointer:fine)]:min-h-9"
            >
              {open ? 'Ringkas' : 'Tampilkan semua'}
            </button>
          ) : null}
        </>
      )}
    </article>
  );
}
