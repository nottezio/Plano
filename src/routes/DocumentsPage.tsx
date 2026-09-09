import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { AppShell } from '@/components/common/AppShell';
import { Sheet } from '@/components/common/Sheet';
import {
  createDocument,
  DEFAULT_DOCUMENT_CATEGORIES,
  deleteDocumentCategory,
  renameDocumentCategory,
} from '@/data/repositories/documents.repo';
import { SEED_DOCUMENTS } from '@/domain/seedDocuments';
import { documentCategories } from '@/domain/documentCategories';
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


export default function DocumentsPage(): JSX.Element {
  const { documents, loading } = useDocumentList();
  const [createOpen, setCreateOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [managingCategory, setManagingCategory] = useState<string | null>(null);

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

  /**
   * Derived from `documentCategories`, the same function the create-sheet and
   * `DocumentPage`'s picker use — one definition of "what categories exist",
   * rather than three places computing it separately and risking disagreement.
   */
  const categories = useMemo(
    () => ['all', ...documentCategories(documents)],
    [documents],
  );

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
              {value === 'all' ? 'Semua' : value}
            </button>
          ))}
        </div>
      ) : null}

      {documents.length > 0 ? (
        <div className="px-4 pb-1 pt-1">
          {/*
            Renaming or deleting a category is an edit to text scattered across
            documents, not a settings screen — so it lives beside the tabs
            that display that text, opened from whichever tab is currently
            selected. "Semua" has nothing to rename, so the control is absent
            there rather than disabled: a category-management action that
            cannot act on anything is not a smaller version of the feature,
            it is a different screen state.
          */}
          {category !== 'all' ? (
            <button
              type="button"
              onClick={() => setManagingCategory(category)}
              className="text-xs text-fg-muted underline"
            >
              Kelola kategori "{category}"
            </button>
          ) : null}
          <button
            type="button"
            onClick={addSeeds}
            disabled={seeding}
            className={[
              'text-xs text-fg-muted underline disabled:opacity-50',
              category !== 'all' ? 'ml-3' : '',
            ].join(' ')}
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
                {category}
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

      <CreateDocumentSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        existingCategories={documentCategories(documents)}
      />
      {managingCategory ? (
        <ManageCategorySheet
          category={managingCategory}
          documents={documents}
          onOpenChange={(open) => {
            if (!open) setManagingCategory(null);
          }}
        />
      ) : null}
    </AppShell>
  );
}

function CreateDocumentSheet({
  open,
  onOpenChange,
  existingCategories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCategories: readonly string[];
}): JSX.Element {
  const uid = useSession((state) => state.user?.uid ?? null);
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  /**
   * Existing categories first, falling back to the starter set only when the
   * user has none yet — there is no fixed list of categories any more, so on
   * an empty account the three suggested by "Tambahkan format bawaan" are the
   * only sensible default.
   */
  const chipOptions =
    existingCategories.length > 0 ? existingCategories : DEFAULT_DOCUMENT_CATEGORIES;
  const [category, setCategory] = useState(chipOptions[0] ?? 'lainnya');
  const [creatingNew, setCreatingNew] = useState(false);
  const [newCategory, setNewCategory] = useState('');

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
          {chipOptions.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setCategory(value);
                setCreatingNew(false);
              }}
              aria-pressed={!creatingNew && category === value}
              className={[
                'min-h-tap rounded-full border px-3 text-xs',
                !creatingNew && category === value
                  ? 'border-accent bg-bg-subtle font-medium text-accent'
                  : 'border-border text-fg-muted',
              ].join(' ')}
            >
              {value}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCreatingNew(true)}
            aria-pressed={creatingNew}
            className={[
              'min-h-tap rounded-full border px-3 text-xs',
              creatingNew
                ? 'border-accent bg-bg-subtle font-medium text-accent'
                : 'border-border text-fg-muted',
            ].join(' ')}
          >
            Kategori baru…
          </button>
        </div>
        {creatingNew ? (
          <input
            type="text"
            autoFocus
            value={newCategory}
            onChange={(event) => {
              setNewCategory(event.target.value);
              setCategory(event.target.value);
            }}
            placeholder="Nama kategori"
            className="mt-2 min-h-tap w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none"
          />
        ) : null}
      </div>
    </Sheet>
  );
}

/**
 * Rename or delete a category, from the tab that shows it.
 *
 * Rename rewrites every document currently in the category in one batch (see
 * `renameDocumentCategory` for why it must be one write, not one per
 * document). Delete asks where those documents should go rather than
 * offering an unconditional delete, because removing a category is not the
 * same action as removing the documents in it — the label goes away, the
 * documents do not.
 */
function ManageCategorySheet({
  category,
  documents,
  onOpenChange,
}: {
  category: string;
  documents: readonly AppDocument[];
  onOpenChange: (open: boolean) => void;
}): JSX.Element {
  const uid = useSession((state) => state.user?.uid ?? null);
  const [name, setName] = useState(category);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [moveTo, setMoveTo] = useState('lainnya');
  const count = documents.filter((doc) => doc.category === category).length;
  const otherCategories = documentCategories(documents).filter((c) => c !== category);

  const rename = (): void => {
    if (!uid) return;
    void renameDocumentCategory(uid, documents, category, name).catch((error: unknown) =>
      console.error('[documents] category rename rejected', error),
    );
    onOpenChange(false);
  };

  const remove = (): void => {
    if (!uid) return;
    void deleteDocumentCategory(uid, documents, category, moveTo).catch((error: unknown) =>
      console.error('[documents] category delete rejected', error),
    );
    onOpenChange(false);
  };

  return (
    <Sheet open onOpenChange={onOpenChange} title={`Kelola kategori "${category}"`}>
      <p className="mb-3 text-xs text-fg-muted">
        {count} dokumen memakai kategori ini.
      </p>

      <label className="block">
        <span className="mb-1 block text-xs text-fg-muted">Ganti nama menjadi</span>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="min-h-tap min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm outline-none"
          />
          <button
            type="button"
            onClick={rename}
            disabled={!name.trim() || name.trim() === category}
            className="min-h-tap shrink-0 rounded-lg border border-accent px-3 text-sm font-medium text-accent disabled:opacity-40"
          >
            Simpan
          </button>
        </div>
      </label>

      <div className="mt-4 border-t border-border pt-3">
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="min-h-tap text-xs text-[var(--danger)] underline"
          >
            Hapus kategori ini
          </button>
        ) : (
          <div>
            <p className="mb-2 text-xs text-fg-muted">
              {/*
                Deleting a category means moving its documents somewhere, not
                deleting the documents — those two are different actions and
                this asks which one before doing either.
              */}
              Pindahkan {count} dokumen ke kategori:
            </p>
            <div className="flex flex-wrap gap-2">
              {[...otherCategories, 'lainnya'].filter((value, index, arr) => arr.indexOf(value) === index).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMoveTo(value)}
                  aria-pressed={moveTo === value}
                  className={[
                    'min-h-tap rounded-full border px-3 text-xs',
                    moveTo === value
                      ? 'border-accent bg-bg-subtle font-medium text-accent'
                      : 'border-border text-fg-muted',
                  ].join(' ')}
                >
                  {value}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={remove}
              className="mt-3 min-h-tap w-full rounded-lg bg-[var(--danger)] px-4 text-sm font-medium text-white"
            >
              Hapus dan pindahkan
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
