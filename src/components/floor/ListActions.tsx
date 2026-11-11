import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { IconCheck, IconCopy, IconDocuments, IconLayers, IconPrinter } from '@/components/common/Icons';
import { Button, INPUT } from '@/components/common/ui';
import { saveEdition, saveRestorePoint } from '@/data/repositories/floors.repo';
import { formatDmy } from '@/domain/dateDmy';
import { wardPlan } from '@/domain/denahPlan';
import { buildFloorList } from '@/domain/floorList/build';
import type { Edition, FloorDoc, RosterPatient, RosterView } from '@/domain/floorList/floor';
import { editionPoint } from '@/domain/floorList/restore';
import { usePrintSettings } from '@/hooks/usePrintSettings';
import { copyText } from '@/lib/clipboard';
import { exportDenah, exportList, exportPdf, PrintSetup } from './PrintSetup';

/** A prefill only (free text): the usual send times of the floor. */
export function defaultListTime(now: Date): string {
  const h = now.getHours();
  return h < 10 ? '04.00' : h < 18 ? '16.00' : '19.00';
}

/**
 * Send, print and save, on every tab (10 Nov 2026, Avi: the export box lived
 * only in the List tab). Three separate buttons pinned with the tabs:
 * Salin teks, Cetak (a menu: Word List, Word Denah, PDF, Atur cetak) and
 * Simpan edisi (a small panel with the Jam list, since the time also heads
 * the copied text and the exports).
 */
export function ListActions({
  floor,
  roster,
  view,
  date,
  editable,
  myName,
  editions,
  time,
  onTime,
}: {
  floor: FloorDoc;
  roster: readonly RosterPatient[];
  view: RosterView;
  date: string;
  editable: boolean;
  myName: string;
  editions: readonly Edition[];
  time: string;
  onTime: (time: string) => void;
}): JSX.Element {
  const text = useMemo(() => buildFloorList(view.active, { ward: floor.ward, date, time }), [view.active, floor.ward, date, time]);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState<'print' | 'save' | null>(null);
  const [saved, setSaved] = useState('');
  const [savingEdition, setSavingEdition] = useState(false);
  const printSettings = usePrintSettings();
  const [setupOpen, setSetupOpen] = useState(false);
  const printInput = { ward: floor.ward, date, plan: wardPlan(floor.ward), patients: view.active, listText: text };

  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const saveThisEdition = (): void => {
    /*
      Saved once (13.14: Riwayat showed the 19.00 list twice — a double tap).
      The same list as the last edition is not saved again (the local copy of
      a new edition arrives at once, offline too), and the button rests for a
      moment so a double tap never reaches it. Not awaited: offline, the write
      resolves only when the server confirms.
    */
    const last = editions[0];
    if (savingEdition) return;
    if (last && last.date === date && last.time === (time.trim() || '—') && last.text === text) {
      setSaved(`Edisi ${formatDmy(date)} ${time} sudah tersimpan.`);
      return;
    }
    setSavingEdition(true);
    window.setTimeout(() => setSavingEdition(false), 2500);
    const createdAt = new Date().toISOString();
    const editionId = saveEdition(floor.id, {
      date,
      time: time.trim() || '—',
      text,
      patients: view.active,
      createdAt,
      createdBy: myName,
    });
    // The roster as it stands with this list (2026-10-16): restorable from Riwayat.
    saveRestorePoint(floor.id, editionPoint(roster, { label: `Edisi ${formatDmy(date)} ${time.trim() || '—'}`, createdAt, createdBy: myName, editionId }));
    setSaved(`Edisi ${formatDmy(date)} ${time} tersimpan.`);
  };

  const toggle = (which: 'print' | 'save'): void => setOpen((current) => (current === which ? null : which));
  const close = (): void => setOpen(null);

  return (
    <>
      <Button
        size="sm"
        icon={<IconCopy width={16} height={16} />}
        onClick={() => void copyText(text).then((ok) => setCopied(ok))}
        aria-label="Salin teks untuk WhatsApp"
        title="Salin teks untuk WhatsApp"
      >
        <span className="max-sm:sr-only">{copied ? 'Tersalin ✓' : 'Salin teks'}</span>
      </Button>

      <Popover
        open={open === 'print'}
        onClose={close}
        label="Cetak dan ekspor"
        trigger={
          <Button
            size="sm"
            icon={<IconPrinter width={16} height={16} />}
            aria-expanded={open === 'print'}
            aria-haspopup="true"
            aria-label="Cetak"
            title="Cetak / ekspor"
            onClick={() => toggle('print')}
          >
            {/* Icon only below 1280 px, so the six tabs keep their room beside the buttons. */}
            <span className="max-xl:sr-only">Cetak ▾</span>
          </Button>
        }
      >
        <div className="grid gap-1.5">
          <MenuItem
            icon={<IconDocuments width={18} height={18} />}
            title="Word: List"
            note={`${printSettings.list.columns} kolom, ${printSettings.list.fontPt} pt`}
            onClick={() => {
              close();
              exportList(printInput, printSettings, date);
            }}
          />
          <MenuItem
            icon={<IconLayers width={18} height={18} />}
            title="Word: Denah"
            note="denah, DPJP, residen"
            onClick={() => {
              close();
              exportDenah(printInput, printSettings, date);
            }}
          />
          <MenuItem
            icon={<IconPrinter width={18} height={18} />}
            title="PDF"
            note="denah + list, 1 file"
            onClick={() => {
              close();
              exportPdf(printInput, printSettings);
            }}
          />
          <button
            type="button"
            onClick={() => {
              close();
              setSetupOpen(true);
            }}
            className="flex min-h-tap w-full items-center justify-center rounded-xl border border-dashed border-border text-xs font-semibold text-fg-muted hover:border-accent hover:text-fg [@media(pointer:fine)]:min-h-9"
          >
            Atur cetak — orientasi, huruf, pratinjau
          </button>
        </div>
      </Popover>
      <PrintSetup open={setupOpen} onOpenChange={setSetupOpen} input={printInput} stamp={date} />

      {editable ? (
        <Popover
          open={open === 'save'}
          onClose={close}
          label="Simpan edisi"
          trigger={
            <Button
              size="sm"
              variant="primary"
              icon={<IconCheck width={16} height={16} />}
              aria-expanded={open === 'save'}
              aria-haspopup="true"
              aria-label={`Simpan edisi, jam ${time.trim() || '—'}`}
              onClick={() => toggle('save')}
            >
              <span className="max-xl:hidden">Simpan edisi</span>
              <span className="rounded bg-black/15 px-1 tabular-nums">{time.trim() || '—'}</span>
            </Button>
          }
        >
          <div className="space-y-2">
            <div className="flex items-end gap-2">
              <label className="block">
                <span className="mb-1 block text-xs text-fg-muted">Jam list</span>
                <input value={time} onChange={(e) => onTime(e.target.value)} aria-label="Jam list" className={`${INPUT} !w-24`} />
              </label>
              <Button variant="primary" onClick={saveThisEdition} disabled={view.active.length === 0 || savingEdition}>
                {savingEdition ? 'Tersimpan ✓' : 'Simpan edisi'}
              </Button>
            </div>
            <p className="text-xs text-fg-muted">
              {saved ? `${saved} Lihat di tab Riwayat.` : `${view.active.length} pasien, list ${formatDmy(date)}. Jam list juga dipakai di Salin teks dan cetak.`}
            </p>
          </div>
        </Popover>
      ) : null}
    </>
  );
}

/** A small panel under its button; a tap outside or Escape closes it. */
export function Popover({
  open,
  onClose,
  label,
  trigger,
  children,
  align = 'right',
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  trigger: ReactNode;
  children: ReactNode;
  /** Which edge of the trigger the panel lines up with. */
  align?: 'left' | 'right';
}): JSX.Element {
  const box = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    const outside = (e: PointerEvent): void => {
      if (box.current && !box.current.contains(e.target as Node)) closeRef.current();
    };
    const escape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div ref={box} className="relative">
      {trigger}
      {open ? (
        <div
          role="dialog"
          aria-label={label}
          className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-surface p-3 shadow-pop`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({ icon, title, note, onClick }: { icon: ReactNode; title: string; note: string; onClick: () => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-tap w-full items-center gap-2 rounded-xl border border-border bg-bg-subtle px-2.5 py-2 text-left hover:border-accent"
    >
      <span className="shrink-0 text-accent">{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold">{title}</span>
        <span className="block text-[11px] text-fg-muted">{note}</span>
      </span>
    </button>
  );
}
