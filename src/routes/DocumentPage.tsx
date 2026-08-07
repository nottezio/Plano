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

      <Sheet open={menuOpen} onOpenChange={setMenuOpen} title={document.title}>
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
          <button
            type="button"
            onClick={() => {
              if (uid) void softDeleteDocument(uid, document.id);
              setMenuOpen(false);
              navigate('/dokumen');
            }}
            className="w-full rounded-lg border border-border px-3 py-3 text-left text-sm text-danger"
          >
            Arsipkan dokumen
          </button>
        </div>
      </Sheet>
    </AppShell>
  );
}
