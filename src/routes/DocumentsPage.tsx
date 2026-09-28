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
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Highlight } from '@/components/common/Highlight';
import { IconMore, IconPin, IconSearch } from '@/components/common/Icons';
import { findSnippet, searchTokens } from '@/domain/archiveSearch';
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [managingCategory, setManagingCategory] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 120);
  const tokens = useMemo(() => searchTokens(debounced), [debounced]);

  /** Category filter, remembered per device. */
  const [category, setCategory] = useState<string>(() => {
    try {
      return localStorage.getItem('visite.docCategory') ?? 'all';
    } catch {
      return 'all';
    }
  });
  const chooseCategory = (value: string): void => {
    setCategory(value);
    try {
      localStorage.setItem('visite.docCategory', value);
    } catch (error) {
      console.warn('[documents] filter not saved', error);
    }
  };

  /** Same definition of "what categories exist" as the create sheet and DocumentPage. */
  const categories = useMemo(() => documentCategories(documents), [documents]);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const document of documents) map.set(document.category, (map.get(document.category) ?? 0) + 1);
    return map;
  }, [documents]);
  // A remembered category that no longer exists falls back to all.
  const activeCategory = category === 'all' || counts.has(category) ? category : 'all';

  const uid = useSession((state) => state.user?.uid ?? null);

  /**
   * Export every document in the seed source form (`{ category, title, body }`),
   * so the output can be handed back and become built-in defaults. Downloaded,
   * not copied: these run to thousands of lines.
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

  /** Adds the starter documents that are missing, by title. Never duplicates. */
  const addSeeds = (): void => {
    if (!uid || seeding) return;
    setSeeding(true);
    const existing = new Set(documents.map((document) => document.title.trim().toLowerCase()));
    for (const seed of SEED_DOCUMENTS) {
      if (existing.has(seed.title.trim().toLowerCase())) continue;
      const { written } = createDocument(uid, { title: seed.title, category: seed.category, body: seed.body });
      void written.catch((error: unknown) => console.error('[documents] seed rejected', error));
    }
    window.setTimeout(() => setSeeding(false), 800);
  };

  /*
    SEARCH covers the title, the category AND the body. The page had no search
    at all once the list passed thirty documents, which meant scrolling to find
    a jadwal poli you knew was there.
  */
  const matches = useMemo(
    () =>
      documents
        .filter((document) => activeCategory === 'all' || document.category === activeCategory)
        .map((document) => {
          if (tokens.length === 0) return { document, snippet: null as string | null };
          const head = `${document.title} ${document.category}`.toLowerCase();
          const body = document.body.toLowerCase();
          if (!tokens.every((token) => head.includes(token) || body.includes(token))) return null;
          const inBody = tokens.filter((token) => !head.includes(token));
          return { document, snippet: inBody.length > 0 ? findSnippet(document.body, inBody) : null };
        })
        .filter((match): match is { document: AppDocument; snippet: string | null } => match !== null),
    [documents, activeCategory, tokens],
  );

  /** Pinned first, across categories; the rest grouped by category. */
  const pinned = matches.filter(({ document }) => document.pinned);
  const grouped = useMemo(() => {
    const groups = new Map<string, typeof matches>();
    for (const match of matches) {
      if (match.document.pinned) continue;
      const bucket = groups.get(match.document.category);
      if (bucket) bucket.push(match);
      else groups.set(match.document.category, [match]);
    }
    return [...groups.entries()];
  }, [matches]);

  return (
    <AppShell title="Dokumen">
      <div className="sticky top-0 z-20 border-b border-border bg-bg">
        <div className="mx-auto w-full max-w-5xl px-4 pb-2 pt-2">
          <div className="flex items-center gap-2">
            <label className="flex min-h-tap min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-3 focus-within:border-accent">
              <IconSearch width={16} height={16} className="shrink-0 text-fg-faint" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Cari dokumen"
                placeholder="Cari judul atau isi dokumen…"
                className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="hidden min-h-tap shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-white sm:flex"
            >
              <span aria-hidden="true" className="text-base leading-none">+</span>
              Dokumen baru
            </button>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-label="Aksi lain"
              className="flex min-h-tap min-w-tap shrink-0 items-center justify-center rounded-lg text-fg-muted hover:bg-bg-subtle"
            >
              <IconMore />
            </button>
          </div>

          {documents.length > 0 ? (
            <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {['all', ...categories].map((value) => {
                const selected = activeCategory === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => chooseCategory(value)}
                    className={[
                      'min-h-tap shrink-0 whitespace-nowrap rounded-full border px-3 text-xs',
                      selected
                        ? 'border-accent bg-accent font-semibold text-white'
                        : 'border-border text-fg-muted hover:bg-bg-subtle',
                    ].join(' ')}
                  >
                    {value === 'all' ? 'Semua' : value}{' '}
                    <span className={selected ? 'opacity-80' : 'text-fg-faint'}>
                      {value === 'all' ? documents.length : (counts.get(value) ?? 0)}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-3 sm:pb-6">
        {loading ? (
          <p className="py-10 text-center text-sm text-fg-muted">Memuat…</p>
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
            <button type="button" onClick={addSeeds} className="mt-2 block w-full min-h-tap text-xs text-fg-muted underline">
              Atau tambahkan {SEED_DOCUMENTS.length} format bawaan
            </button>
          </div>
        ) : matches.length === 0 ? (
          <p className="py-10 text-center text-sm text-fg-muted">Tidak ada dokumen yang cocok.</p>
        ) : (
          <>
            {tokens.length > 0 ? (
              <p className="pb-1 text-xs text-fg-muted" aria-live="polite">{matches.length} dokumen</p>
            ) : null}
            {pinned.length > 0 ? (
              <DocumentGroup title="Disematkan" matches={pinned} tokens={tokens} showCategory />
            ) : null}
            {grouped.map(([name, list]) => (
              <DocumentGroup key={name} title={name} matches={list} tokens={tokens} showCategory={false} />
            ))}
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        aria-label="Dokumen baru"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+76px)] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-white shadow-lg sm:hidden"
      >
        +
      </button>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen} title="Aksi dokumen">
        <div className="space-y-2 p-4">
          {activeCategory !== 'all' ? (
            <MenuRow
              onClick={() => {
                setMoreOpen(false);
                setManagingCategory(activeCategory);
              }}
            >
              Kelola kategori “{activeCategory}” (ganti nama / hapus)
            </MenuRow>
          ) : null}
          <MenuRow
            onClick={() => {
              addSeeds();
              setMoreOpen(false);
            }}
          >
            {seeding ? 'Menambahkan…' : 'Tambahkan format bawaan yang belum ada'}
          </MenuRow>
          <MenuRow
            onClick={() => {
              exportDocuments();
              setMoreOpen(false);
            }}
          >
            Ekspor semua dokumen (JSON)
          </MenuRow>
        </div>
      </Sheet>

      <CreateDocumentSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        existingCategories={categories}
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

function MenuRow({ onClick, children }: { onClick: () => void; children: React.ReactNode }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-tap w-full rounded-lg border border-border px-3 py-2 text-left text-sm font-medium"
    >
      {children}
    </button>
  );
}

/**
 * Two lines of what the document actually says: markup stripped, and the
 * first line skipped when it only repeats the title (it usually does).
 */
export function documentPreview(document: Pick<AppDocument, 'title' | 'body'>): string {
  const title = document.title.trim().toLowerCase();
  const lines = document.body
    .split('\n')
    .map((line) => line.replace(/[*_~`]/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (lines[0] && lines[0].toLowerCase() === title) lines.shift();
  return lines.slice(0, 2).join('\n');
}

function DocumentGroup({
  title,
  matches,
  tokens,
  showCategory,
}: {
  title: string;
  matches: ReadonlyArray<{ document: AppDocument; snippet: string | null }>;
  tokens: readonly string[];
  showCategory: boolean;
}): JSX.Element {
  return (
    <section className="mt-4 first:mt-1">
      <h2 className="flex items-center gap-3 pb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{title}</span>
        <span className="text-[11px] text-fg-faint">{matches.length}</span>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {matches.map(({ document, snippet }) => {
          const preview = documentPreview(document);
          return (
            <li key={document.id}>
              <Link
                to={`/dokumen/${document.id}`}
                className="flex h-full flex-col rounded-xl border border-border bg-surface px-3 py-2.5 transition-colors hover:border-border-strong hover:bg-bg-subtle"
              >
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 text-sm font-semibold leading-snug">
                    <Highlight text={document.title} tokens={tokens} />
                  </span>
                  {document.pinned ? (
                    <IconPin filled width="14" height="14" className="shrink-0 text-accent" aria-label="Disematkan" />
                  ) : null}
                </span>
                {showCategory ? (
                  <span className="mt-0.5 text-[11px] text-fg-faint">{document.category}</span>
                ) : null}
                {snippet ? (
                  <span className="mt-1 text-xs italic leading-snug text-fg-muted">
                    <Highlight text={snippet} tokens={tokens} />
                  </span>
                ) : preview ? (
                  // No `block` beside `line-clamp-*` (pattern 13).
                  <span className="mt-1 line-clamp-2 whitespace-pre-line text-xs leading-snug text-fg-muted">
                    {preview}
                  </span>
                ) : (
                  <span className="mt-1 text-xs italic text-fg-faint">Kosong</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
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
