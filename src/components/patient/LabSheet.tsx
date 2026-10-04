import { useMemo, useRef, useState } from 'react';

import { Sheet } from '@/components/common/Sheet';
import { IconCopy, IconSparkle, IconUpload } from '@/components/common/Icons';
import { Button, Callout, CheckRow, Field, INPUT, Section, TextPane } from '@/components/common/ui';
import { AiError, aiEnabled, askClaude } from '@/lib/ai';
import { labHeading, labReportKind, parseLab } from '@/domain/lab/parseLab';
import { copyText } from '@/lib/clipboard';
import { preprocessForOcr } from '@/lib/ocrPreprocess';
import { extractPdfText, isPdf } from '@/lib/pdfText';
import { isClinicalDate } from '@/domain/clinicalDate';
import { headingDate, labTitleFor, readLabMeta } from '@/domain/lab/labMeta';
import type { ClinicalDate } from '@/domain/types';

/**
 * Lab reformatter.
 *
 * Paste the lab text, get the compact handover lines, insert them into the note
 * under a dated heading.
 *
 * The flow is deliberately paste-then-check rather than image-straight-to-note.
 * OCR of a lab table is not reliable enough to trust unseen — a misread digit
 * in a potassium value is not recoverable by reading the note back, because the
 * wrong number looks exactly as plausible as the right one. So whatever the
 * source, the extracted text lands in an editable box first, and the formatted
 * preview updates as you correct it. Nothing enters the note until you press
 * insert.
 */
export function LabSheet({
  open,
  onOpenChange,
  date,
  onInsert,
  placement,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: ClinicalDate;
  onInsert: (text: string) => void;
  /** Where Sisipkan will put the block, in words (see domain/lab/insertLab). */
  placement?: string | undefined;
}): JSX.Element {
  const [raw, setRaw] = useState('');
  /** The title and date as typed by the user; null follows the report. */
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const [dateOverride, setDateOverride] = useState<ClinicalDate | null>(null);
  const [ocrState, setOcrState] = useState<'idle' | 'running' | 'failed'>('idle');
  const [readMode, setReadMode] = useState<'pdf' | 'image' | null>(null);
  /** The name of a PDF that was not a lab report, so it was not read. */
  const [notLab, setNotLab] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /**
   * Off by default.
   *
   * Bolding is a claim about a value, and it is only made where the sheet
   * printed a range — so an unbolded value means "not flagged", never
   * "checked and normal". Defaulting it on would invite the second reading.
   */
  const [boldAbnormal, setBoldAbnormal] = useState(false);

  /**
   * AI assist on the RAW text, before the deterministic parser sees it.
   *
   * Placed here rather than after `parseLab` on purpose. `parseLab` is the
   * thing that produces the line that goes into the record, and it stays the
   * only thing that does — the model's job is to make messy input legible to
   * it, not to write the output. So the suggestion lands back in the RAW box,
   * the parser runs over it as it always does, and the preview underneath is
   * still the parser's work.
   *
   * That also means the assist can be wrong without being dangerous: a bad
   * rewrite is visible in the raw box, editable, and one undo away.
   */
  const [aiState, setAiState] = useState<'idle' | 'running'>('idle');
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiUndo, setAiUndo] = useState<string | null>(null);

  const runAssist = async (): Promise<void> => {
    setAiState('running');
    setAiError(null);
    try {
      const text = await askClaude(raw, {
        system: [
          'Kamu merapikan teks hasil laboratorium rumah sakit Indonesia yang berantakan',
          '(hasil OCR atau salinan PDF) menjadi daftar baris "Nama: nilai".',
          '',
          'ATURAN KERAS:',
          '- JANGAN mengubah angka apa pun. Salin persis seperti aslinya.',
          '- JANGAN menambah pemeriksaan yang tidak ada di teks.',
          '- JANGAN menghitung, menyimpulkan, atau memberi interpretasi klinis.',
          '- Jika sebuah nilai tidak terbaca jelas, tulis apa adanya, jangan menebak.',
          '- Keluarkan HANYA daftar barisnya, tanpa pengantar dan tanpa penutup.',
        ].join('\n'),
        maxTokens: 1200,
      });
      setAiUndo(raw);
      setRaw(text);
    } catch (error) {
      setAiError(error instanceof AiError ? error.message : 'Gagal memanggil AI.');
    } finally {
      setAiState('idle');
    }
  };

  const result = useMemo(() => parseLab(raw, { boldAbnormal }), [raw, boldAbnormal]);
  /*
    The heading follows the REPORT (2026-10-02): its sample date and sending
    unit, `*Laboratorium PJT (02-10-2026)*`. It used to be the note's day in
    the rail's form, `*Laboratorium (30 Agu)*`, which was neither how the
    corpus writes it nor, for a draw before midnight or a culture, the right
    day. The note's day is only the fallback for text with no report header.
    See `domain/lab/labMeta`.
  */
  const meta = useMemo(() => readLabMeta(raw), [raw]);
  const title = titleOverride ?? labTitleFor(meta);
  const labDate = dateOverride ?? meta.date ?? date;
  const dateSource = dateOverride ? 'manual' : meta.date ? 'report' : 'note';
  const heading = labHeading(headingDate(labDate), title.trim() || labTitleFor(meta));
  const block = result.formatted ? `${heading}\n${result.formatted}` : '';

  /**
   * OCR is loaded on demand from a CDN, never bundled.
   *
   * The language data is several megabytes — precaching it would multiply the
   * size of an app whose main promise is working on hospital wifi, in exchange
   * for a feature used occasionally and only when online. If it cannot load,
   * the paste box is still there and still works.
   */
  /**
   * PDF first, always.
   *
   * A lab PDF has a text layer, so its numbers are read exactly rather than
   * recognised — no upscaling, no thresholding, no confidence score. OCR
   * remains only as the fallback for a photo or screenshot, where there is no
   * text layer to read.
   */
  const readFile = async (file: File): Promise<void> => {
    if (isPdf(file)) {
      setReadMode('pdf');
      setOcrState('running');
      try {
        const text = await extractPdfText(file);
        /*
          A radiology, echo or procedure report is said to be one, not read.
          Read as a lab it filled "Lain-lain" with `Radiografi Thorax 1` and
          `MR. 24`: plausible-looking lines that are not results.
        */
        if (labReportKind(text) === 'other') {
          setNotLab(file.name);
          setOcrState('idle');
          return;
        }
        setNotLab(null);
        // A BLANK line between sources: it is what tells the parser a PDF's
        // report has ended, so pasted text after it is read (see parseLab).
        setRaw((current) => (current ? `${current}\n\n${text}` : text));
        setOcrState('idle');
      } catch (error) {
        console.error('[lab] PDF read failed', error);
        setOcrState('failed');
      }
      return;
    }

    setReadMode('image');
    await runOcr(file);
  };

  const runOcr = async (file: File): Promise<void> => {
    setOcrState('running');
    try {
      // Typed loosely and loaded by URL: this module is intentionally not a
      // dependency of the build, so there are no types to import.
      const url = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/+esm';
      const tesseract = (await import(/* @vite-ignore */ url)) as {
        recognize: (
          image: Blob,
          lang: string,
          options?: Record<string, string>,
        ) => Promise<{ data: { text: string } }>;
      };
      const prepared = await preprocessForOcr(file);
      const { data } = await tesseract.recognize(prepared, 'eng', {
        // A lab report is one uniform block of text in reading order. The
        // default mode hunts for page layout and, on a ruled table, decides the
        // rules are columns — which is how forty rows of results came back as
        // one line of nonsense.
        tessedit_pageseg_mode: '6',
        preserve_interword_spaces: '1',
        // Values, ranges and units only. Restricting the alphabet stops the
        // recogniser inventing letters out of table rules.
        tessedit_char_whitelist:
          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,/()<>=+-% ',
      });
      setRaw((current) => (current ? `${current}\n\n${data.text}` : data.text));
      setOcrState('idle');
    } catch (error) {
      console.error('[lab] OCR failed', error);
      setOcrState('failed');
    }
  };

  const [dragging, setDragging] = useState(false);

  const insert = (): void => {
    onInsert(block);
    setRaw('');
    setTitleOverride(null);
    setDateOverride(null);
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title="Format hasil lab"
      description="Ambil dari PDF lab, atau tempel teksnya. Berkas dibaca di perangkat ini dan tidak diunggah ke mana pun."
      footer={
        <div className="flex items-center gap-2">
          {block ? (
            <Button
              variant="ghost"
              icon={<IconCopy width={16} height={16} />}
              onClick={() => void copyText(block)}
            >
              Salin saja
            </Button>
          ) : null}
          <Button variant="primary" className="flex-1" disabled={!block} onClick={insert}>
            Sisipkan ke catatan
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 sm:grid-cols-2">
        {/* SOURCE: where the text comes from, and the text itself. */}
        <Section title="Sumber">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={ocrState === 'running'}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files[0];
              if (file) void readFile(file);
            }}
            className={[
              'flex w-full items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-left transition-colors disabled:opacity-60',
              dragging
                ? 'border-accent bg-[var(--accent-soft)]'
                : 'border-border-strong bg-bg-subtle hover:border-accent',
            ].join(' ')}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-accent">
              <IconUpload width={18} height={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-fg">
                {ocrState === 'running' ? 'Membaca berkas…' : 'Ambil dari PDF / gambar'}
              </span>
              <span className="block text-[11px] leading-snug text-fg-muted">
                Ketuk atau seret berkas ke sini. PDF lab dibaca persis; gambar dikenali dan wajib
                diperiksa.
              </span>
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void readFile(file);
              event.target.value = '';
            }}
          />

          {/*
            Only with a key AND the switch on. Absent otherwise — a disabled
            button for a feature somebody has not enabled advertises sending a
            lab result off the device.
          */}
          {aiEnabled('lab') || aiUndo !== null ? (
            <div className="flex flex-wrap gap-2">
              {aiEnabled('lab') ? (
                <Button
                  size="sm"
                  icon={<IconSparkle width={14} height={14} />}
                  onClick={() => void runAssist()}
                  disabled={aiState === 'running' || raw.trim().length === 0}
                >
                  {aiState === 'running' ? 'Merapikan…' : 'Rapikan teks dengan AI'}
                </Button>
              ) : null}
              {aiUndo !== null ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setRaw(aiUndo);
                    setAiUndo(null);
                  }}
                >
                  Undo AI
                </Button>
              ) : null}
            </div>
          ) : null}

          {aiError ? (
            <Callout tone="danger" role="alert">
              {aiError}
            </Callout>
          ) : null}
          {notLab ? (
            <Callout tone="danger" role="alert" title={`“${notLab}” bukan hasil laboratorium`}>
              Radiologi, ekokardiografi, atau laporan tindakan tidak dibaca di sini.
            </Callout>
          ) : null}
          {ocrState === 'failed' ? (
            <Callout tone="danger" role="alert" title="Gagal membaca berkas">
              Tempel teksnya secara manual di bawah.
            </Callout>
          ) : null}
          {/*
            The failure that matters is not an exception — it is OCR returning
            confident nonsense. Comparing what was read against what parsed is
            the only signal available.
          */}
          {readMode === 'image' && raw.trim().length > 40 && result.known.length < 3 ? (
            <Callout tone="warn" role="alert" title={`Hanya ${result.known.length} nilai terbaca`}>
              Hasil pembacaan gambar kemungkinan tidak terpakai. Blok teks langsung dari PDF lab,
              atau gunakan Live Text (iOS) / Google Lens lalu tempel di sini.
            </Callout>
          ) : null}

          <Field label="Teks hasil lab" htmlFor="lab-raw">
            <textarea
              id="lab-raw"
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
              rows={12}
              spellCheck={false}
              placeholder={'WBC 6.01 4.00 - 10.0\nHGB 12.4 12.0 - 16.0\nNatrium 132 136 - 145'}
              className="w-full resize-y rounded-xl border border-border bg-surface p-3 font-mono text-xs leading-relaxed text-fg outline-none placeholder:text-fg-faint focus:border-accent"
            />
          </Field>
        </Section>

        {/* RESULT: what goes into the note, and the two things to check. */}
        <Section title="Hasil">
          <div className="flex gap-2">
            <Field label="Judul blok" htmlFor="lab-title" className="flex-1">
              <input
                id="lab-title"
                type="text"
                value={title}
                onChange={(event) => setTitleOverride(event.target.value)}
                placeholder="Laboratorium PJT"
                className={INPUT}
              />
            </Field>
            <Field label="Tanggal lab" htmlFor="lab-date" className="w-40 shrink-0">
              <input
                id="lab-date"
                type="date"
                value={labDate}
                onChange={(event) => {
                  const next = event.target.value;
                  setDateOverride(isClinicalDate(next) ? next : null);
                }}
                className={`${INPUT} px-2`}
              />
            </Field>
          </div>
          <p className="text-[11px] text-fg-faint">
            {dateSource === 'report'
              ? 'Tanggal dari PDF (Tgl. Registrasi — saat sampel diambil).'
              : dateSource === 'manual'
                ? 'Tanggal diisi manual.'
                : 'Belum ada tanggal di teks — memakai tanggal catatan.'}
          </p>
          {!dateOverride && meta.dates.length > 1 ? (
            <Callout tone="warn" role="alert" title={`Lab dari ${meta.dates.length} tanggal`}>
              {meta.dates.map(headingDate).join(', ')}. Judul memakai yang terbaru; sisipkan per
              tanggal bila ingin dipisah.
            </Callout>
          ) : null}

          {/*
            Only offered when the pasted sheet actually carries ranges: a
            checkbox that can do nothing implies values were checked and found
            normal.
          */}
          {result.known.some((value) => value.abnormal !== undefined) ? (
            <CheckRow
              checked={boldAbnormal}
              onChange={setBoldAbnormal}
              title="Tebalkan nilai di luar rujukan"
              detail="Hanya untuk nilai yang rujukannya tercetak di lembar lab."
            />
          ) : null}

          <TextPane label="Akan disisipkan" maxHeight="max-h-[40vh]">
            {block || <span className="text-fg-faint">Belum ada nilai yang terbaca.</span>}
          </TextPane>
          {placement ? <p className="text-[11px] text-fg-muted">{placement}</p> : null}

          {result.unknown.length > 0 ? (
            <Callout tone="warn" title={`${result.unknown.length} nilai tidak dikenali`}>
              Dimasukkan ke “Lain-lain”. Periksa kembali sebelum menyisipkan.
            </Callout>
          ) : null}
        </Section>
      </div>
    </Sheet>
  );
}
