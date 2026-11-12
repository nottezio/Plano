import { useId, useMemo, useRef, useState } from 'react';
import { DateField } from '@/components/common/DateField';
import { Sheet } from '@/components/common/Sheet';
import { Button, Callout, CheckRow, Field, INPUT } from '@/components/common/ui';
import { headingDate, namesCouldMatch } from '@/domain/lab/labMeta';
import { defaultCaption, IMAGE_KINDS, IMAGE_KIND_LABEL, type ImageKind } from '@/domain/slides/deckState';
import { readPptx, type ImportResult, type ImportedSlide } from '@/domain/slides/importPptx';
import type { ClinicalDate } from '@/domain/types';

export function AddImageSheet({
  open,
  onOpenChange,
  today,
  defaultPlace,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  today: ClinicalDate;
  defaultPlace: string;
  onAdd: (files: File[], meta: { kind: ImageKind; date: ClinicalDate; title: string; place: string }) => Promise<void>;
}): JSX.Element {
  const id = useId();
  const [files, setFiles] = useState<File[]>([]);
  const [kind, setKind] = useState<ImageKind>('ekg');
  const [date, setDate] = useState<ClinicalDate>(today);
  const [place, setPlace] = useState(defaultPlace);
  const [title, setTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const caption = title ?? defaultCaption(kind, place, date);

  const submit = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      await onAdd(files, { kind, date, title: caption, place });
      setFiles([]);
      setTitle(null);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gambar tidak bisa ditambahkan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Tambah gambar"
      description="Satu slide memuat sampai 4 foto; lebih dari itu dibuat slide baru."
      footer={
        <Button variant="primary" full disabled={files.length === 0 || saving} onClick={() => void submit()}>
          {saving ? 'Menyimpan…' : files.length ? `Tambah ${files.length} gambar` : 'Tambah gambar'}
        </Button>
      }
    >
      <div className="space-y-3">
        <Field label="Foto" htmlFor={`${id}-f`} hint={files.length ? `${files.length} dipilih` : 'Kamera atau galeri'}>
          <input
            id={`${id}-f`}
            type="file"
            accept="image/*"
            multiple
            className={`${INPUT} py-2`}
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Jenis" htmlFor={`${id}-k`}>
            <select id={`${id}-k`} className={INPUT} value={kind} onChange={(e) => setKind(e.target.value as ImageKind)}>
              {IMAGE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {IMAGE_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tanggal" htmlFor={`${id}-d`}>
            <DateField id={`${id}-d`} value={date} onChange={setDate} />
          </Field>
        </div>
        <Field label="Tempat" htmlFor={`${id}-p`}>
          <input id={`${id}-p`} className={INPUT} value={place} onChange={(e) => setPlace(e.target.value)} placeholder="PJT Lt. 4" />
        </Field>
        <Field label="Judul slide" htmlFor={`${id}-t`}>
          <input id={`${id}-t`} className={INPUT} value={caption} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        {error ? <Callout tone="danger" role="alert" title={error} /> : null}
      </div>
    </Sheet>
  );
}

const KIND_LABEL: Record<ImportedSlide['kind'], string> = {
  title: 'Judul',
  soap: 'SOAP',
  images: 'Gambar',
  lab: 'Tabel lab',
  text: 'Teks',
  closing: 'Penutup',
  unknown: 'Tidak dikenali',
};

function describeSlide(slide: ImportedSlide): string {
  switch (slide.kind) {
    case 'soap':
      return `SOAP ${slide.date ? headingDate(slide.date) : '(tanggal tidak terbaca)'}`;
    case 'images':
      return `${slide.title || 'Gambar'} · ${slide.photos.length} foto`;
    case 'lab':
      return `Tabel lab · ${slide.grid.dates.length} tanggal`;
    case 'text':
      return slide.title;
    default:
      return KIND_LABEL[slide.kind];
  }
}

/** Title and closing are rebuilt by Plano; everything else is offered, ticked. */
const offered = (slide: ImportedSlide): boolean => slide.kind !== 'title' && slide.kind !== 'closing';

export function ImportReviewSheet({
  result,
  patientName,
  replacing,
  onCancel,
  onImport,
}: {
  result: ImportResult;
  patientName: string;
  /** A deck was imported before; this one replaces what that import brought in. */
  replacing: boolean;
  onCancel: () => void;
  onImport: (picked: number[]) => Promise<void>;
}): JSX.Element {
  const [picked, setPicked] = useState(() => new Set(result.slides.filter(offered).map((s) => s.index)));
  const [saving, setSaving] = useState(false);

  const summary = useMemo(() => {
    const soap = result.slides.filter((s) => s.kind === 'soap');
    const dates = soap.flatMap((s) => (s.kind === 'soap' && s.date ? [s.date] : [])).sort();
    const photos = result.slides.reduce((n, s) => n + (s.kind === 'images' ? s.photos.length : 0), 0);
    const unknown = result.slides.filter((s) => s.kind === 'unknown').length;
    return [
      soap.length ? `${soap.length} slide SOAP${dates.length ? ` (${headingDate(dates[0]!)} s/d ${headingDate(dates.at(-1)!)})` : ''}` : '',
      photos ? `${photos} gambar` : '',
      result.slides.some((s) => s.kind === 'lab') ? 'tabel lab' : '',
      unknown ? `${unknown} tidak dikenali` : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }, [result]);

  const titleSlide = result.slides.find((s) => s.kind === 'title');
  const deckName = titleSlide?.kind === 'title' ? (titleSlide.text.split(/[/\n]/)[0] ?? '').trim() : '';
  const nameMismatch = Boolean(deckName && patientName && !namesCouldMatch(deckName, patientName));

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      title="Impor slide lama"
      description={summary || 'Tidak ada slide yang dikenali.'}
      size="lg"
      footer={
        <div className="flex gap-2">
          <Button full onClick={onCancel}>
            Batal
          </Button>
          <Button
            variant="primary"
            full
            disabled={picked.size === 0 || saving}
            onClick={() => {
              setSaving(true);
              void onImport([...picked]).finally(() => setSaving(false));
            }}
          >
            {saving ? 'Mengimpor…' : `Impor ${picked.size} slide`}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {nameMismatch ? (
          <Callout tone="warn" role="alert" title="Nama di slide berbeda dengan pasien ini">
            Slide: {deckName}. Pastikan file ini milik pasien yang benar.
          </Callout>
        ) : null}
        {replacing ? <Callout tone="warn" title="Impor ini menggantikan slide dari impor sebelumnya." /> : null}
        {result.aspect !== '16:9' ? <Callout title="File lama berukuran 4:3; slide baru dibuat 16:9." /> : null}
        {result.skippedPictures ? <Callout title={`${result.skippedPictures} gambar dilewati (format tidak didukung).`} /> : null}
        <ul className="space-y-1.5">
          {result.slides.filter(offered).map((slide) => (
            <li key={slide.index}>
              <CheckRow
                checked={picked.has(slide.index)}
                title={describeSlide(slide)}
                detail={`Slide ${slide.index + 1} · ${KIND_LABEL[slide.kind]}`}
                onChange={(on) =>
                  setPicked((current) => {
                    const next = new Set(current);
                    if (on) next.add(slide.index);
                    else next.delete(slide.index);
                    return next;
                  })
                }
              />
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}

/** A hidden .pptx file input and the function that opens it; read errors come back as text. */
export function usePptxPicker(onRead: (result: ImportResult) => void): { input: JSX.Element; pick: () => void; error: string | null } {
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const input = (
    <input
      ref={ref}
      type="file"
      accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
      className="hidden"
      aria-hidden="true"
      tabIndex={-1}
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setError(null);
        void file
          .arrayBuffer()
          .then(readPptx)
          .then(onRead)
          .catch((err: unknown) => setError(err instanceof Error ? err.message : 'File tidak bisa dibaca.'));
      }}
    />
  );
  return { input, pick: () => ref.current?.click(), error };
}

export function StartChooser({ onNew, onImportClick, error }: { onNew: () => void; onImportClick: () => void; error: string | null }): JSX.Element {
  return (
    <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-card">
      <div>
        <h2 className="text-base font-semibold text-fg">Pasien ini belum punya slide di perangkat ini</h2>
        <p className="mt-1 text-sm text-fg-muted">Buat slide baru dari SOAP di Plano, atau lanjutkan file .pptx yang sudah dibuat sebelumnya.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="primary" onClick={onNew}>
          Buat slide baru
        </Button>
        <Button onClick={onImportClick}>Lanjutkan dari .pptx</Button>
      </div>
      {error ? <Callout tone="danger" role="alert" title={error} /> : null}
    </div>
  );
}
