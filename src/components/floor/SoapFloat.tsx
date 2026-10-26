import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { writeRosterReport } from '@/data/repositories/floors.repo';
import { dpjpById } from '@/domain/dpjp';
import { formatDmy } from '@/domain/dateDmy';
import { readReports, type FloorPatient } from '@/domain/floorList/report';
import { copyText } from '@/lib/clipboard';
import { useBackToClose } from '@/lib/useBackToClose';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { clampGeometry, currentViewport, dragGeometry, readStoredGeometry, type Geometry } from '@/lib/floatGeometry';
import { localStamp, type FloorDoc, type RosterPatient } from '@/domain/floorList/floor';
import { DeletePatient } from './DeletePatient';
import { PatientControls } from './PatientControls';
import { SoapParts } from './SoapParts';

/**
 * A patient's full SOAP in a floating box (12.8), for the DPJP visit.
 *
 * Floating, not a modal: the denah stays visible and clickable beside it.
 * From 640 px (12.11): dragged by its header and resized from the corner;
 * where it was left is remembered on this device. On a phone it stays a
 * bottom panel (dragging a box with a thumb over a list is worse than none).
 *
 * Several at once on a wide screen (2026-10-16, Avi): each patient opened
 * from the denah or list gets its own box, cascaded from the last; a click
 * brings a box to the front; Esc closes the front one. A phone keeps one.
 *
 * "Atur pasien" opens BESIDE the SOAP on a wide screen (2026-10-16: stacked
 * under the header it took the height the SOAP needs): the box grows to the
 * left by the panel's width. On a phone it takes the SOAP's place, with a
 * button back.
 *
 * "Update SOAP" (edit members; "Ubah SOAP" before 26 Oct 2026): the stored WhatsApp text is edited and read
 * again — the A/P, DPJP, red/green all follow the edit. Saved as an edited
 * report with the same stamp, so re-pasting the same message does not undo
 * it; a NEWER message from the group still replaces it.
 */

const GEOMETRY_KEY = 'plano.listmaker.float';

const MIN_W = 320;
const MIN_H = 220;
/** The Atur pasien panel beside the SOAP. */
const PANEL_W = 340;
/** Each further box sits this far down and left of the one before. */
const CASCADE = 32;

function defaultGeometry(): Geometry {
  const w = Math.min(480, window.innerWidth - 32);
  return { x: window.innerWidth - w - 16, y: 80, w, h: Math.max(MIN_H, window.innerHeight - 100) };
}

/** Kept wholly inside the window (see `lib/floatGeometry`). */
function clamp(g: Geometry): Geometry {
  return clampGeometry(g, currentViewport(), { w: MIN_W, h: MIN_H });
}

function readGeometry(slot = 0): Geometry {
  const base = readStored();
  return slot === 0 ? base : clamp({ ...base, x: base.x - slot * CASCADE, y: base.y + slot * CASCADE });
}

function readStored(): Geometry {
  try {
    const stored = readStoredGeometry(localStorage.getItem(GEOMETRY_KEY));
    if (stored) return clamp(stored);
  } catch {
    // Unreadable: the default.
  }
  return defaultGeometry();
}

export function SoapFloat({
  patient,
  onClose,
  floorId,
  editable,
  control,
  onEditManual,
  stack,
}: {
  patient: FloorPatient | null;
  onClose: () => void;
  floorId?: string | undefined;
  editable?: boolean | undefined;
  /** The roster entry and what the controls need (13.9): "Atur" opens the patient's control panel. */
  control?: { floor: FloorDoc; entry: RosterPatient; date: string; myName: string } | undefined;
  /** A hand-entered patient is changed in its own form (13.11: there was no way from here). */
  onEditManual?: ((patient: FloorPatient) => void) | undefined;
  /**
   * Its place among several open boxes (2026-10-16): `slot` cascades a new box
   * from the last; `front` is the one Esc closes; `onFocus` brings it forward.
   */
  stack?: { slot: number; layer: number; front: boolean; onFocus: () => void } | undefined;
}): JSX.Element | null {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [atur, setAtur] = useState(false);
  const floating = useMediaQuery('(min-width: 640px)');
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const drag = useRef<{ kind: 'move' | 'resize'; startX: number; startY: number; from: Geometry } | null>(null);
  useBackToClose(patient !== null, onClose);

  useEffect(() => {
    setCopied(false);
    setEditing(false);
    setError('');
    if (!patient) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      // With several boxes open, Esc closes the front one only.
      if (event.key === 'Escape' && (stack?.front ?? true)) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [patient, onClose, stack?.front]);

  useEffect(() => {
    if (patient && floating && !geometry) setGeometry(readGeometry(stack?.slot ?? 0));
  }, [patient, floating, geometry, stack?.slot]);

  if (!patient) return null;

  const begin = (kind: 'move' | 'resize') => (event: ReactPointerEvent<HTMLElement>): void => {
    if (!floating || !geometry) return;
    if (kind === 'move' && (event.target as HTMLElement).closest('button, textarea, input')) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { kind, startX: event.clientX, startY: event.clientY, from: geometry };
  };
  const move = (event: ReactPointerEvent<HTMLElement>): void => {
    const d = drag.current;
    if (!d) return;
    const dx = event.clientX - d.startX;
    const dy = event.clientY - d.startY;
    setGeometry(clamp(dragGeometry(d.from, d.kind, dx, dy)));
  };
  const end = (): void => {
    if (!drag.current) return;
    drag.current = null;
    try {
      // Remembered without the side panel: the next box opens at the SOAP's own size.
      if (geometry) localStorage.setItem(GEOMETRY_KEY, JSON.stringify(sideOpen ? { ...geometry, x: geometry.x + PANEL_W, w: geometry.w - PANEL_W } : geometry));
    } catch {
      // Not remembered: fine.
    }
  };

  const save = async (): Promise<void> => {
    if (!floorId) return;
    const parts = readReports({ sentAt: patient.sentAt, sender: patient.sender, text: draft, index: 0 });
    const read = parts.find((p) => p.key === patient.key) ?? parts.at(-1);
    if (!read) {
      setError('Identitas pasien tidak terbaca (baris "… atas nama:" dan identitas di bawahnya harus ada).');
      return;
    }
    setSaving(true);
    setError('');
    try {
      // Same key and stamp: it replaces this report, nothing else.
      await writeRosterReport(floorId, patient.key, {
        ...read,
        key: patient.key,
        sentAt: patient.sentAt,
        edited: true,
        editedAt: localStamp(new Date()),
      });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  const canAtur = Boolean(editable && control);
  /** Beside the SOAP (wide screen) or in its place (phone). */
  const sideOpen = atur && canAtur && !editing && floating;
  const toggleAtur = (): void => {
    const next = !atur;
    setAtur(next);
    // The box grows to the left by the panel (and back), so the SOAP keeps its place and size.
    if (floating && geometry) setGeometry(clamp(next ? { ...geometry, x: geometry.x - PANEL_W, w: geometry.w + PANEL_W } : { ...geometry, x: geometry.x + PANEL_W, w: geometry.w - PANEL_W }));
  };

  const dpjp = patient.dpjpId ? dpjpById(patient.dpjpId) : undefined;
  const sent = patient.sentAt ? `${formatDmy(patient.sentAt.slice(0, 10))} ${patient.sentAt.slice(11, 16)}` : '';
  const layer = 40 + (stack?.layer ?? 0);
  const style =
    floating && geometry ? { left: geometry.x, top: geometry.y, width: geometry.w, height: geometry.h, zIndex: layer } : { zIndex: layer };

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-label={`SOAP ${patient.name}`}
      style={style}
      onPointerDownCapture={() => stack?.onFocus()}
      className={
        floating
          ? `fixed flex flex-col rounded-2xl border bg-surface shadow-sheet ${stack && !stack.front ? 'border-border' : 'border-border-strong'}`
          : 'fixed inset-x-0 bottom-0 flex max-h-[80dvh] flex-col rounded-t-2xl border border-border bg-surface shadow-sheet'
      }
    >
      <header
        onPointerDown={begin('move')}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className={`flex flex-wrap items-start gap-2 border-b border-border px-4 py-3 ${floating ? 'cursor-move select-none touch-none' : ''}`}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">
            {patient.room}
            {patient.bed ? ` Bed ${patient.bed}` : ''} · {patient.name}
          </p>
          <p className="mt-0.5 text-xs text-fg-muted">
            {[dpjp?.initials, patient.rm ? `RM ${patient.rm}` : '', [patient.junior, patient.chief].filter(Boolean).join(' / ')]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {sent ? (
            <p className="mt-0.5 text-xs text-fg-faint">
              {patient.manual ? 'Diinput manual' : 'Laporan'} {sent}
              {patient.sender ? ` · ${patient.sender}` : ''}
              {patient.edited ? ` · diubah${patient.editedAt ? ` ${formatDmy(patient.editedAt.slice(0, 10))} ${patient.editedAt.slice(11, 16)}` : ''}` : ''}
              {patient.soap === 'baru' ? ' · SOAP baru (setelah list terakhir)' : patient.soap === 'lama' ? ' · belum ada SOAP hari ini' : ''}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="min-h-tap min-w-tap rounded-lg text-lg leading-none text-fg-muted hover:bg-bg-subtle"
        >
          ×
        </button>
        {/* The actions on their own row (13.7): on a phone the title keeps the width. */}
        {!editing ? (
          <div className="flex basis-full flex-wrap items-center gap-2">
            {editable && patient.manual && onEditManual ? (
              <button type="button" onClick={() => onEditManual(patient)} className="min-h-tap rounded-lg border border-border px-3 text-xs font-medium">
                Ubah isi
              </button>
            ) : null}
            {editable && floorId && !patient.manual ? (
              <button
                type="button"
                onClick={() => {
                  setDraft(patient.full);
                  setEditing(true);
                }}
                className="min-h-tap rounded-lg border border-border px-3 text-xs font-medium"
              >
                Update SOAP
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                void copyText(patient.full).then((ok) => setCopied(ok));
              }}
              className="min-h-tap rounded-lg border border-border px-3 text-xs font-medium"
            >
              {copied ? 'Tersalin' : 'Salin'}
            </button>
            {canAtur ? (
              <button
                type="button"
                onClick={toggleAtur}
                aria-expanded={atur}
                className={`min-h-tap rounded-lg border px-3 text-xs font-medium ${atur ? 'border-accent bg-accent text-on-accent' : 'border-border'}`}
              >
                {atur && !floating ? 'Kembali ke SOAP' : 'Atur pasien'}
              </button>
            ) : null}
            <span className="flex-1" />
            {editable && floorId ? (
              <DeletePatient floorId={floorId} patientKey={patient.key} name={patient.name} onDeleted={onClose} compact />
            ) : null}
          </div>
        ) : null}
      </header>
      {editing ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label="SOAP"
            className="min-h-0 flex-1 resize-none rounded-lg border border-border bg-bg p-2 font-sans text-[13px] leading-relaxed"
          />
          {error ? <p className="text-xs text-danger">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="min-h-tap rounded-lg border border-border px-3 text-sm">
              Batal
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="min-h-tap rounded-lg bg-accent px-3 text-sm font-medium text-on-accent disabled:opacity-40"
            >
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </div>
      ) : atur && canAtur && control ? (
        /*
          The control panel (13.9): the same controls as the List card. Wide
          screen: a column beside the SOAP. Phone: in the SOAP's place (the
          bottom sheet has no width to spare and stacking took its height).
        */
        <div className="flex min-h-0 flex-1">
          <aside
            aria-label="Atur pasien"
            className={`min-h-0 overflow-y-auto px-4 pb-3 ${sideOpen ? 'shrink-0 border-r border-border' : 'flex-1'}`}
            style={sideOpen ? { width: PANEL_W } : undefined}
          >
            <PatientControls floor={control.floor} entry={control.entry} patient={patient} date={control.date} myName={control.myName} onGone={onClose} narrow />
          </aside>
          {sideOpen ? (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <SoapParts text={patient.full} />
            </div>
          ) : null}
        </div>
      ) : (
        <SoapParts text={patient.full} />
      )}

      {floating ? (
        <div
          role="separator"
          aria-label="Ubah ukuran"
          onPointerDown={begin('resize')}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          className="absolute bottom-0 right-0 h-5 w-5 cursor-se-resize touch-none rounded-br-2xl"
          style={{ background: 'linear-gradient(135deg, transparent 50%, var(--border-strong) 50%)' }}
        />
      ) : null}
    </section>
  );
}
