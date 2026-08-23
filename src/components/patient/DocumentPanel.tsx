import { useMemo, useState } from 'react';

import { useDocumentList } from '@/hooks/useDocuments';
import { formatBody } from '@/domain/format/formatters';
import { copyText } from '@/lib/clipboard';

/**
 * A document read beside the note, in the same screen.
 *
 * The workflow this serves is copying a phrase out of a reference document
 * while writing a SOAP — a browser tab makes that two context switches per
 * phrase, and the second window I added last release only helps on a desktop
 * with room for two windows.
 *
 * Read-only on purpose. Editing here would mean a second live editor on the
 * page with its own draft and merge state, and the first time the two
 * disagreed there would be no way to tell which one you were looking at. The
 * Documents tab remains where documents are edited.
 */
export function DocumentPanel(): JSX.Element {
  const { documents, loading } = useDocumentList();
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const open = documents.find((document) => document.id === openId);

  const listed = useMemo(() => {
    // Patient-related documents only. The rest — JARKOM notices, shift
    // confirmations, iuran — have nothing to do with writing a SOAP, and a
    // list you have to filter by eye every time is one you stop opening.
    const relevant = documents.filter((document) => document.category === 'pasien');

    const needle = query.trim().toLowerCase();
    if (!needle) return relevant;
    return relevant.filter(
      (document) =>
        document.title.toLowerCase().includes(needle) ||
        document.body.toLowerCase().includes(needle),
    );
  }, [documents, query]);

  if (loading) return <p className="text-xs text-fg-muted">Memuat…</p>;

  if (open) {
    return (
      <div className="flex min-h-0 flex-col">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpenId(null)}
            className="min-h-tap shrink-0 text-xs text-accent"
          >
            ← Daftar
          </button>
          <span className="min-w-0 flex-1 truncate text-xs font-semibold">{open.title}</span>
          <button
            type="button"
            onClick={() => {
              void copyText(formatBody(open.body, 'whatsapp')).then((ok) => {
                setCopied(ok);
                window.setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="min-h-tap shrink-0 text-xs text-accent underline"
          >
            {copied ? 'Tersalin ✓' : 'Salin'}
          </button>
        </div>

        {/* Selectable, so a single phrase can be taken without copying the
            whole document. */}
        <pre className="mt-2 min-h-0 flex-1 select-text overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-bg-subtle p-2 text-[11px] leading-relaxed">
          {open.body}
        </pre>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col">
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Cari dokumen…"
        className="min-h-tap w-full rounded-lg border border-border bg-surface px-2 text-xs outline-none"
      />

      {listed.length === 0 ? (
        <p className="mt-2 text-xs text-fg-faint">Tidak ada dokumen yang cocok.</p>
      ) : (
        <ul className="mt-2 min-h-0 flex-1 space-y-1 overflow-auto">
          {listed.map((document) => (
            <li key={document.id}>
              <button
                type="button"
                onClick={() => setOpenId(document.id)}
                className="min-h-tap w-full truncate rounded-lg border border-border px-2 py-1.5 text-left text-[11px]"
              >
                {document.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
