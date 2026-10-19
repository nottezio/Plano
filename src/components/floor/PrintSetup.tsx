import { useEffect, useRef, useState } from 'react';

import { Sheet } from '@/components/common/Sheet';
import { Button, CheckRow, Segmented } from '@/components/common/ui';
import { buildDenahDocx, buildListDocx, DOCX_MIME, floorFileName } from '@/domain/floorList/docx';
import { denahListHtml, previewHtml, type PrintInput } from '@/domain/floorList/printHtml';
import { DEFAULT_PRINT, FONT_MAX, FONT_MIN, type PrintSettings } from '@/domain/floorList/printSettings';
import { setPrintSettings, usePrintSettings } from '@/hooks/usePrintSettings';
import { deliverFile } from '@/lib/download';
import { MM, paginate } from '@/lib/printPreview';
import { printDocument } from '@/lib/printPage';

/** Word: List / Word: Denah / PDF with this device's print setup — the export buttons and the setup share them. */
export function exportList(input: PrintInput, settings: PrintSettings, stamp: string): void {
  void deliverFile(new Blob([buildListDocx(input.listText, settings.list)], { type: DOCX_MIME }), floorFileName('List Pasien', input.ward, stamp));
}
export function exportDenah(input: PrintInput, settings: PrintSettings, stamp: string): void {
  void deliverFile(
    new Blob([buildDenahDocx({ ward: input.ward, date: input.date, plan: input.plan, patients: input.patients }, settings.denah)], { type: DOCX_MIME }),
    floorFileName('Denah', input.ward, stamp),
  );
}
export function exportPdf(input: PrintInput, settings: PrintSettings): void {
  printDocument(denahListHtml(input, settings));
}

/**
 * Print setup (2026-10-16, Avi: "view and change the printed PDF and Word for
 * the list and denah — orientation, font size"). The pages as they will
 * print, beside the settings; every change redraws them. The PDF is exactly
 * this layout (the same HTML); Word lays its own text out, so its line
 * breaks can differ slightly, its page size, columns and type do not.
 */
export function PrintSetup({
  open,
  onOpenChange,
  input,
  stamp,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  input: PrintInput;
  /** Date (and time) in the Word file names. */
  stamp: string;
}): JSX.Element {
  const settings = usePrintSettings();
  const [kind, setKind] = useState<'list' | 'denah'>('list');
  const set = (next: Partial<PrintSettings['list']> | Partial<PrintSettings['denah']>): void =>
    setPrintSettings(kind === 'list' ? { ...settings, list: { ...settings.list, ...next } } : { ...settings, denah: { ...settings.denah, ...next } });
  const current = kind === 'list' ? settings.list : settings.denah;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Atur cetak"
      description="Orientasi, kolom dan ukuran huruf untuk PDF dan Word. Disimpan di perangkat ini."
      size="2xl"
      fill
      footer={
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => exportPdf(input, settings)}>
            Cetak PDF (denah + list)
          </Button>
          <Button onClick={() => exportList(input, settings, stamp)}>Word: List</Button>
          <Button onClick={() => exportDenah(input, settings, stamp)}>Word: Denah</Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:h-full sm:grid-cols-[15rem_minmax(0,1fr)]">
        <div className="space-y-4 sm:overflow-y-auto">
          <Segmented
            label="Pratinjau"
            value={kind}
            onChange={setKind}
            options={[
              ['list', 'List'],
              ['denah', 'Denah'],
            ]}
          />
          <Setting title="Orientasi">
            <Segmented
              label="Orientasi"
              value={current.landscape ? 'l' : 'p'}
              onChange={(v) => set({ landscape: v === 'l' })}
              options={[
                ['p', 'Potret'],
                ['l', 'Lanskap'],
              ]}
            />
          </Setting>
          {kind === 'list' ? (
            <Setting title="Kolom">
              <Segmented
                label="Kolom"
                value={String(settings.list.columns)}
                onChange={(v) => set({ columns: Number(v) })}
                options={[
                  ['1', '1'],
                  ['2', '2'],
                  ['3', '3'],
                  ['4', '4'],
                ]}
              />
            </Setting>
          ) : null}
          <Setting title="Ukuran huruf">
            <div className="flex items-center gap-2">
              <Button size="sm" aria-label="Huruf lebih kecil" onClick={() => set({ fontPt: current.fontPt - 0.5 })} disabled={current.fontPt <= FONT_MIN}>
                −
              </Button>
              <span className="min-w-[4rem] text-center text-sm font-semibold tabular-nums">{current.fontPt} pt</span>
              <Button size="sm" aria-label="Huruf lebih besar" onClick={() => set({ fontPt: current.fontPt + 0.5 })} disabled={current.fontPt >= FONT_MAX}>
                +
              </Button>
            </div>
          </Setting>
          {kind === 'denah' ? (
            <CheckRow
              checked={settings.denah.residentsNewPage}
              onChange={(v) => set({ residentsNewPage: v })}
              title="Residen di halaman baru"
              detail="Mati: tabel residen langsung di bawah kotak DPJP, hemat kertas."
            />
          ) : null}
          {kind === 'denah' ? (
            <CheckRow
              checked={settings.denah.residentsList}
              onChange={(v) => set({ residentsList: v })}
              title="Residen sebagai daftar"
              detail="Satu kolom ke bawah, sama dengan tampilan Daftar di layar."
            />
          ) : null}
          <button
            type="button"
            onClick={() => setPrintSettings(kind === 'list' ? { ...settings, list: DEFAULT_PRINT.list } : { ...settings, denah: DEFAULT_PRINT.denah })}
            className="text-xs text-fg-muted underline hover:text-fg"
          >
            Kembalikan bawaan {kind === 'list' ? 'list' : 'denah'}
          </button>
        </div>
        <Preview kind={kind} input={input} settings={settings} />
      </div>
    </Sheet>
  );
}

function Setting({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-fg-muted">{title}</p>
      {children}
    </div>
  );
}

/**
 * The pages, drawn in an iframe so the printout's own styles apply untouched,
 * scaled to the panel's width.
 */
function Preview({ kind, input, settings }: { kind: 'list' | 'denah'; input: PrintInput; settings: PrintSettings }): JSX.Element {
  const wrap = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [pages, setPages] = useState(0);
  const [natural, setNatural] = useState(0);
  const [width, setWidth] = useState(0);
  const html = previewHtml(kind, input, settings);
  const landscape = kind === 'list' ? settings.list.landscape : settings.denah.landscape;
  const pageWidth = (landscape ? 297 : 210) * MM;
  const scale = width > 0 ? Math.min(1, (width - 24) / pageWidth) : 0.5;

  useEffect(() => {
    const node = wrap.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(() => setWidth(node.clientWidth));
    observer.observe(node);
    setWidth(node.clientWidth);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const doc = frameRef.current?.contentDocument;
    if (doc?.body) doc.body.style.zoom = String(scale);
  }, [scale, natural]);

  return (
    <div ref={wrap} className="h-[60dvh] min-h-0 overflow-y-auto rounded-xl border border-border bg-[color-mix(in_srgb,var(--fg)_30%,var(--bg))] sm:h-auto">
      <p className="sticky top-0 z-10 bg-surface px-3 py-1 text-[11px] text-fg-muted">
        {pages > 0 ? `${pages} halaman ${kind === 'list' ? 'list' : 'denah'}` : 'Menyiapkan pratinjau…'} · A4 {landscape ? 'lanskap' : 'potret'}
      </p>
      <iframe
        ref={frameRef}
        title={`Pratinjau ${kind}`}
        srcDoc={html}
        onLoad={(event) => {
          const doc = event.currentTarget.contentDocument;
          if (!doc) return;
          const result = paginate(doc, kind, settings);
          doc.body.style.zoom = String(scale);
          setPages(result.pages);
          setNatural(result.height);
        }}
        style={{ width: '100%', height: Math.max(200, natural * scale), border: 0, display: 'block' }}
      />
    </div>
  );
}
