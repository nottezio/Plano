import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { writeRosterReport } from '@/data/repositories/floors.repo';
import { dpjpById } from '@/domain/dpjp';
import { formatDmy } from '@/domain/dateDmy';
import { readReports, type FloorPatient } from '@/domain/floorList/report';
import { copyText } from '@/lib/clipboard';
import { useBackToClose } from '@/lib/useBackToClose';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { SoapParts } from './SoapParts';

/**
 * A patient's full SOAP in a floating box (12.8), for the DPJP visit.
 *
 * Floating, not a modal: the denah stays visible and clickable beside it.
 * From 640 px (12.11): dragged by its header and resized from the corner;
 * where it was left is remembered on this device. On a phone it stays a
 * bottom panel (dragging a box with a thumb over a list is worse than none).
 *
 * "Ubah SOAP" (edit members): the stored WhatsApp text is edited and read
 * again — the A/P, DPJP, red/green all follow the edit. Saved as an edited
 * report with the same stamp, so re-pasting the same message does not undo
 * it; a NEWER message from the group still replaces it.
 */

const GEOMETRY_KEY = 'plano.listmaker.float';

interface Geometry {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MIN_W = 320;
const MIN_H = 220;

function defaultGeometry(): Geometry {
  const w = Math.min(480, window.innerWidth - 32);
  return { x: window.innerWidth - w - 16, y: 80, w, h: Math.max(MIN_H, window.innerHeight - 100) };
}

/**
 * Kept wholly inside the window: a box whose bottom (and resize corner) went
 * below the screen could no longer be resized, and the drag selected page
 * text instead (found in the render check).
 */
function clamp(g: Geometry): Geometry {
  const w = Math.min(Math.max(g.w, MIN_W), window.innerWidth - 16);
  const x = Math.min(Math.max(g.x, 8), window.innerWidth - w - 8);
  const y = Math.min(Math.max(g.y, 8), window.innerHeight - MIN_H - 8);
  const h = Math.min(Math.max(g.h, MIN_H), window.innerHeight - y - 8);
  return { x, y, w, h };
}

function readGeometry(): Geometry {
  try {
    const raw = JSON.parse(localStorage.getItem(GEOMETRY_KEY) ?? 'null') as Partial<Geometry> | null;
    if (raw && [raw.x, raw.y, raw.w, raw.h].every((v) => typeof v === 'number')) return clamp(raw as Geometry);
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
}: {
  patient: FloorPatient | null;
  onClose: () => void;
  floorId?: string | undefined;
  editable?: boolean | undefined;
}): JSX.Element | null {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
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
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [patient, onClose]);

  useEffect(() => {
    if (patient && floating && !geometry) setGeometry(readGeometry());
  }, [patient, floating, geometry]);

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
    setGeometry(
      clamp(d.kind === 'move' ? { ...d.from, x: d.from.x + dx, y: d.from.y + dy } : { ...d.from, w: d.from.w + dx, h: d.from.h + dy }),
    );
  };
  const end = (): void => {
    if (!drag.current) return;
    drag.current = null;
    try {
      if (geometry) localStorage.setItem(GEOMETRY_KEY, JSON.stringify(geometry));
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
      });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  const dpjp = patient.dpjpId ? dpjpById(patient.dpjpId) : undefined;
  const sent = patient.sentAt ? `${formatDmy(patient.sentAt.slice(0, 10))} ${patient.sentAt.slice(11, 16)}` : '';
  const style =
    floating && geometry ? { left: geometry.x, top: geometry.y, width: geometry.w, height: geometry.h } : undefined;

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-label={`SOAP ${patient.name}`}
      style={style}
      className={
        floating
          ? 'fixed z-40 flex flex-col rounded-2xl border border-border bg-surface shadow-2xl'
          : 'fixed inset-x-0 bottom-0 z-40 flex max-h-[80dvh] flex-col rounded-t-2xl border border-border bg-surface shadow-2xl'
      }
    >
      <header
        onPointerDown={begin('move')}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className={`flex items-start gap-2 border-b border-border px-4 py-3 ${floating ? 'cursor-move select-none touch-none' : ''}`}
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
            <p className="mt-0.5 text-[11px] text-fg-faint">
              {patient.manual ? 'Diinput manual' : 'Laporan'} {sent}
              {patient.sender ? ` · ${patient.sender}` : ''}
              {patient.edited ? ' · diubah' : ''}
            </p>
          ) : null}
        </div>
        {editable && floorId && !patient.manual && !editing ? (
          <button
            type="button"
            onClick={() => {
              setDraft(patient.full);
              setEditing(true);
            }}
            className="min-h-tap rounded-lg border border-border px-3 text-xs font-medium"
          >
            Ubah SOAP
          </button>
        ) : null}
        {!editing ? (
          <button
            type="button"
            onClick={() => {
              void copyText(patient.full).then((ok) => setCopied(ok));
            }}
            className="min-h-tap rounded-lg border border-border px-3 text-xs font-medium"
          >
            {copied ? 'Tersalin' : 'Salin'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="min-h-tap min-w-tap rounded-lg text-lg leading-none text-fg-muted hover:bg-bg-subtle"
        >
          ×
        </button>
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
              className="min-h-tap rounded-lg bg-accent px-3 text-sm font-medium text-white disabled:opacity-40"
            >
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
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
