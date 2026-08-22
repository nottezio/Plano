import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { AppShell } from '@/components/common/AppShell';
import { Sheet } from '@/components/common/Sheet';
import { createDocument } from '@/data/repositories/documents.repo';
import { SEED_DOCUMENTS } from '@/domain/seedDocuments';
import { useDocumentList } from '@/hooks/useDocuments';
import { useSession } from '@/store/useSession';
import type { AppDocument } from '@/domain/types';

/**
 * SPEC F8 — documents.
 *
 * Jadwal poli, standing formats, phone lists: free-form text that is not tied
 * to a patient or a day. Same editor, same parser, same copy engine — a
 * document is a body without a clinical date, and nothing more.
 */
const CATEGORY_LABELS: Record<string, string> = {
  jadwal_poli: 'Jadwal poli',
  format: 'Format',
  pasien: 'Terkait pasien',
  lainnya: 'Lainnya',
};

export default function DocumentsPage(): JSX.Element {
  const { documents, loading } = useDocumentList();
  const [createOpen, setCreateOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  /**
   * Category filter, remembered per device.
   *
   * The list grew past thirty documents once the seeds were added, and a flat
   * list of thirty is a list nobody scans — you search it, which only works if
   * you already know the title.
   */
  const [category, setCategory] = useState<string>(() => {
    try {
      return localStorage.getItem('visite.docCategory') ?? 'all';
    } catch {
      return 'all';
    }
  });

  const categories = useMemo(() => {
    const present = new Set(documents.map((document) => document.category));
    return ['all', ...[...present].sort()];
  }, [documents]);

  const shown = useMemo(
    () => (category === 'all' ? documents : documents.filter((d) => d.category === category)),
    [documents, category],
  );
  const uid = useSession((state) => state.user?.uid ?? null);

  /**
   * Adds the starter documents, once, on request.
   *
   * Skips any title already present so a second tap cannot duplicate them, and
   * so a set added months ago is topped up rather than doubled.
   */
  /**
   * Export every document as the source form the seeds are written in.
   *
   * The point is that the output can be handed back to me and become built-in
   * defaults — so it is emitted as the same `{ category, title, body }` shape
   * `seedDocuments.ts` already uses, rather than as prose. Anything else means
   * transcribing it by hand on the way in, which is where errors enter.
   *
   * Downloaded as a file rather than copied: these run to thousands of lines,
   * and a clipboard that large is refused by some browsers.
   */
  const exportDocuments = (): void => {
    const payload = documents.map((document) => ({
      category: document.category,
      title: document.title,
      body: document.body,
    }));

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `plano-dokumen-${new Date().toISOString().slice(0, 10)}.json`;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const addSeeds = (): void => {
    if (!uid || seeding) return;
    setSeeding(true);

    const existing = new Set(documents.map((document) => document.title.trim().toLowerCase()));
    for (const seed of SEED_DOCUMENTS) {
      if (existing.has(seed.title.trim().toLowerCase())) continue;
      const { written } = createDocument(uid, {
        title: seed.title,
        category: seed.category,
        body: seed.body,
      });
      void written.catch((error: unknown) =>
        console.error('[documents] seed rejected', error),
      );
    }

    window.setTimeout(() => setSeeding(false), 800);
  };

  const grouped = useMemo(() => {
    const groups = new Map<string, AppDocument[]>();
    for (const document of shown) {
      const bucket = groups.get(document.category);
      if (bucket) bucket.push(document);
      else groups.set(document.category, [document]);
    }
    return [...groups.entries()];
  }, [shown]);

  return (
    <AppShell title="Dokumen">
      <div className="mx-auto w-full max-w-3xl">
      {documents.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 px-4 pb-1 pt-1">
          {categories.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={category === value}
              onClick={() => {
                setCategory(value);
                try {
                  localStorage.setItem('visite.docCategory', value);
                } catch (error) {
                  console.warn('[documents] filter not saved', error);
                }
              }}
              className={[
                'min-h-tap rounded-full border px-3 text-xs',
                category === value
                  ? 'border-accent bg-bg-subtle font-medium text-accent'
                  : 'border-border text-fg-muted',
              ].join(' ')}
            >
              {value === 'all' ? 'Semua' : (CATEGORY_LABELS[value] ?? value)}
            </button>
          ))}
        </div>
      ) : null}

      {documents.length > 0 ? (
        <div className="px-4 pb-1 pt-1">
          <button
            type="button"
            onClick={addSeeds}
            disabled={seeding}
            className="text-xs text-fg-muted underline disabled:opacity-50"
          >
            {seeding ? 'Menambahkan…' : 'Tambahkan format bawaan yang belum ada'}
          </button>
          <button
            type="button"
            onClick={exportDocuments}
            className="ml-3 text-xs text-fg-muted underline"
          >
            Ekspor semua dokumen (JSON)
          </button>
        </div>
      ) : null}

      <div className="hidden justify-end px-4 pb-2 pt-1 sm:flex">
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex min-h-tap items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-white"
        >
          <span aria-hidden="true" className="text-base leading-none">+</span>
          Dokumen baru
        </button>
      </div>

      {loading ? (
        <p className="px-4 py-10 text-center text-sm text-fg-muted">Memuat…</p>
      ) : documents.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <p className="text-sm text-fg-muted">Belum ada dokumen.</p>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="mt-3 min-h-tap rounded-lg border border-border px-4 text-sm text-accent"
          >
            Buat dokumen pertama
          </button>
          <button
            type="button"
            onClick={addSeeds}
            className="mt-2 block w-full text-xs text-fg-muted underline"
          >
            Atau tambahkan {SEED_DOCUMENTS.length} format bawaan
          </button>
        </div>
      ) : (
        <div className="px-4 pb-4">
          {grouped.map(([category, list]) => (
            <section key={category} className="mt-4 first:mt-0">
              <h2 className="text-xs font-semibold text-fg-muted">
                {CATEGORY_LABELS[category] ?? category}
              </h2>
              <ul className="mt-1 space-y-2">
                {list.map((document) => (
                  <li key={document.id}>
                    <Link
                      to={`/dokumen/${document.id}`}
                      className="block rounded-lg border border-border bg-surface px-3 py-2.5"
                    >
                      <span className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {document.title}
                        </span>
                        {document.pinned ? <span aria-label="Disematkan">★</span> : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-fg-muted">
                        {document.body.trim().split('\n')[0] || 'Kosong'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        aria-label="Dokumen baru"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+76px)] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-white shadow-lg sm:hidden"
      >
        +
      </button>

      </div>

      <CreateDocumentSheet open={createOpen} onOpenChange={setCreateOpen} />
    </AppShell>
  );
}

function CreateDocumentSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): JSX.Element {
  const uid = useSession((state) => state.user?.uid ?? null);
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('jadwal_poli');

  const submit = (): void => {
    if (!uid || !title.trim()) return;
    // Same offline contract as creating a patient: the id exists on device, so
    // the write is never awaited before navigating.
    const { id, written } = createDocument(uid, { title, category });
    void written.catch((error: unknown) => console.error('[documents] create rejected', error));
    setTitle('');
    onOpenChange(false);
    navigate(`/dokumen/${id}`);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Dokumen baru"
      footer={
        <button
          type="button"
          onClick={submit}
          disabled={!title.trim()}
          className="min-h-tap w-full rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          Buat
        </button>
      }
    >
      <label className="block">
        <span className="mb-1 block text-xs text-fg-muted">Judul</span>
        <input
          type="text"
          value={title}
          autoFocus
          onChange={(event) => setTitle(event.target.value)}
          className="min-h-tap w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none"
        />
      </label>

      <div className="mt-3">
        <span className="mb-1 block text-xs text-fg-muted">Kategori</span>
        <div className="flex flex-wrap gap-2">
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              aria-pressed={category === value}
              className={[
                'min-h-tap rounded-full border px-3 text-xs',
                category === value
                  ? 'border-accent bg-bg-subtle font-medium text-accent'
                  : 'border-border text-fg-muted',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
