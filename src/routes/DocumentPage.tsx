import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { AppShell } from '@/components/common/AppShell';
import { Sheet } from '@/components/common/Sheet';
import { BodyEditor } from '@/components/patient/BodyEditor';
import { ConflictDialog } from '@/components/patient/ConflictDialog';
import { softDeleteDocument, updateDocument } from '@/data/repositories/documents.repo';
import { composeDocument } from '@/domain/format/composeCopy';
import { FORMAT_LABELS } from '@/domain/format/formatters';
import { copyText } from '@/lib/clipboard';
import { useDocument, useDocumentEditor } from '@/hooks/useDocuments';
import { useSession } from '@/store/useSession';
import type { OutputFormat } from '@/domain/types';

/**
 * SPEC F8 — one document, edited with the same components as a SOAP day.
 *
 * `BodyEditor`, `SectionCopyBar` and `ConflictDialog` are reused verbatim.
 * That reuse is the requirement, not a convenience: a second editor would
 * drift from the first, and the drift would show up as a document that saves
 * differently from a note.
 */
export default function DocumentPage(): JSX.Element {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const uid = useSession((state) => state.user?.uid ?? null);
  const settings = useSession((state) => state.settings());

  const { document, loading } = useDocument(documentId);
  const editor = useDocumentEditor(documentId, document);

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shared, setShared] = useState(false);
  const [format, setFormat] = useState<OutputFormat>('whatsapp');
  const [copied, setCopied] = useState(false);

  if (loading) {
    return (
      <AppShell title="Dokumen">
        <p className="px-4 py-10 text-center text-sm text-fg-muted">Memuat…</p>
      </AppShell>
    );
  }

  if (!document) {
    return (
      <AppShell title="Dokumen">
        <div className="px-6 py-12 text-center">
          <p className="text-sm text-fg-muted">Dokumen tidak ditemukan.</p>
          <Link to="/dokumen" className="mt-3 inline-block text-sm text-accent underline">
            Kembali ke daftar
          </Link>
        </div>
      </AppShell>
    );
  }

  const onCopyAll = (): void => {
    const text = composeDocument(editor.value, 'all', format, settings.sectionAliases);
    void copyText(text).then((ok) => {
      setCopied(ok);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <AppShell title={document.title}>
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{document.title}</h2>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Tindakan dokumen"
            className="min-h-tap min-w-tap shrink-0 text-fg-faint"
          >
            ⋯
          </button>
        </header>

        <BodyEditor
          value={editor.value}
          onChange={editor.setValue}
          onBlur={editor.flush}
          aliases={settings.sectionAliases}
          readOnly={false}
          placeholder="Tulis isi dokumen…"
        />

        <div className="flex flex-wrap items-center gap-2 px-4 py-2 text-[11px] text-fg-faint">
          <span className="flex-1">{editor.dirty ? 'Menyimpan…' : 'Tersimpan'}</span>
          {(Object.keys(FORMAT_LABELS) as OutputFormat[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFormat(value)}
              aria-pressed={format === value}
              className={[
                'min-h-tap px-1',
                format === value ? 'font-medium text-accent' : '',
              ].join(' ')}
            >
              {FORMAT_LABELS[value]}
            </button>
          ))}
          <button type="button" onClick={onCopyAll} className="min-h-tap px-1 underline">
            {copied ? 'Tersalin ✓' : 'Salin semua'}
          </button>
        </div>
      </div>

      {editor.conflict ? (
        <ConflictDialog
          conflict={editor.conflict}
          otherDeviceLabel="perangkat lain"
          onResolve={editor.resolveConflict}
        />
      ) : null}

      <Sheet
        open={menuOpen}
        onOpenChange={(next) => {
          if (!next) setConfirmDelete(false);
          setMenuOpen(next);
        }}
        title={document.title}
      >
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              if (uid) void updateDocument(uid, document.id, { pinned: !document.pinned });
              setMenuOpen(false);
            }}
            className="w-full rounded-lg border border-border px-3 py-3 text-left text-sm font-medium"
          >
            {document.pinned ? 'Lepas sematan' : 'Sematkan'}
          </button>
          {/*
            Export as text, for sending to someone else.

            The title is included because a jadwal poli pasted into a group chat
            with no heading is a wall of names nobody can place. Format follows
            the toggle at the bottom of the page, so what is shared matches what
            was being read.
          */}
          <button
            type="button"
            onClick={() => {
              const text = `*${document.title}*\n\n${composeDocument(
                editor.value,
                'all',
                format,
                settings.sectionAliases,
              )}`;
              void copyText(text).then((ok) => {
                setShared(ok);
                window.setTimeout(() => setShared(false), 1500);
              });
            }}
            className="w-full rounded-lg border border-border px-3 py-3 text-left text-sm font-medium"
          >
            {shared ? 'Tersalin ✓' : 'Bagikan (salin judul + isi)'}
          </button>

          {/*
            Delete, not archive.

            A document has no clinical history to preserve and no archive view to
            live in, so "Arsipkan" meant "disappears, and there is nowhere to
            look for it" — a delete wearing a gentler word. This says what it
            does. The write is still a soft delete at the data layer, so a
            mis-tap is recoverable by an admin rather than final.
          */}
          {confirmDelete ? (
            <div className="rounded-lg border border-danger p-3">
              <p className="text-xs text-fg-muted">
                Hapus “{document.title}”? Dokumen tidak akan muncul lagi di daftar.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="min-h-tap flex-1 rounded-lg border border-border text-sm"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (uid) void softDeleteDocument(uid, document.id);
                    setMenuOpen(false);
                    navigate('/dokumen');
                  }}
                  className="min-h-tap flex-1 rounded-lg border border-danger text-sm font-medium text-danger"
                >
                  Hapus
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="w-full rounded-lg border border-border px-3 py-3 text-left text-sm text-danger"
            >
              Hapus dokumen
            </button>
          )}
        </div>
      </Sheet>
    </AppShell>
  );
}
