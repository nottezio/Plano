import { useEffect, useState } from 'react';

import { Button } from '@/components/common/ui';
import { writeRosterBatch, writeRosterFields, type RosterChange } from '@/data/repositories/floors.repo';
import { formatDmy } from '@/domain/dateDmy';
import { chiefSuggestions, isJamDinas, nextJamDinas, type ChiefSuggestion } from '@/domain/floorList/chiefHandover';
import { localStamp, type FloorDoc, type RosterPatient } from '@/domain/floorList/floor';
import type { FloorPatient } from '@/domain/floorList/report';

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const dr = (name: string): string => `dr. ${name.replace(/^dr(\.\s*|\s+)/i, '')}`;

/**
 * Patients still with the previous chief, at jam dinas (24 Oct 2026; rule in
 * `domain/floorList/chiefHandover`). A suggestion only: the chief changes on
 * Terima. Outside jam dinas, one quiet line says how many change next time.
 */
export function ChiefSuggestions({
  floor,
  roster,
  active,
  date,
  myName,
  onOpen,
}: {
  floor: FloorDoc;
  roster: readonly RosterPatient[];
  active: readonly FloorPatient[];
  date: string;
  myName: string;
  onOpen: (patient: FloorPatient) => void;
}): JSX.Element | null {
  // The clock moves the strip in and out at 07.00 / 16.00 without a reload.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!isJamDinas(now)) {
    const later = chiefSuggestions(roster, floor, date, now, { ignoreClock: true });
    if (later.length === 0) return null;
    const next = nextJamDinas(now);
    return (
      <p className="text-xs text-fg-muted">
        {later.length} pasien ganti chief · {DAYS[next.getDay()]} {formatDmy(localStamp(next).slice(0, 10)).slice(0, 5)} 07.00
      </p>
    );
  }

  const pending = chiefSuggestions(roster, floor, date, now);
  if (pending.length === 0) return null;

  const stamp = (to: string) => ({ at: new Date().toISOString(), by: myName, what: `Chief → ${to} (saran jam dinas)` });
  const accept = ({ entry, to }: ChiefSuggestion): RosterChange => ({
    kind: 'fields',
    key: entry.key,
    fields: { chief: to, ...(entry.gantiChief ? { gantiChief: '' } : {}) },
    log: stamp(to),
  });
  const dismiss = ({ entry }: ChiefSuggestion): RosterChange => ({
    kind: 'fields',
    key: entry.key,
    fields: { chiefDismissed: new Date().toISOString() },
  });

  return (
    <section
      aria-label="Saran chief jam dinas"
      className="space-y-1 rounded-lg border border-[var(--warn-strong)] p-2"
      style={{ backgroundColor: 'var(--warn-soft)' }}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="min-w-0 flex-1 text-xs font-semibold">
          Chief sebelumnya · {pending.length} pasien → Chief Bangsal
        </p>
        {pending.length > 1 ? (
          <>
            <Button size="sm" onClick={() => void writeRosterBatch(floor.id, pending.map(accept))}>
              Terima semua
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void writeRosterBatch(floor.id, pending.map(dismiss))}>
              Abaikan semua
            </Button>
          </>
        ) : null}
      </div>
      {pending.map((suggestion) => {
        const { entry, from, to } = suggestion;
        const shown = active.find((p) => p.key === entry.key);
        const place = `${entry.report.room}${entry.report.bed ? ` Bed ${entry.report.bed}` : ''}`;
        return (
          <div key={entry.key} className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              disabled={!shown}
              onClick={() => shown && onOpen(shown)}
              className="min-h-tap min-w-0 flex-1 truncate text-left hover:underline"
            >
              {place ? `${place} · ` : ''}
              {entry.report.name} — {from || 'Belum ada chief'} → <strong>{dr(to)}</strong>
            </button>
            <Button size="sm" onClick={() => void writeRosterBatch(floor.id, [accept(suggestion)])}>
              Terima
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void writeRosterFields(floor.id, entry.key, { chiefDismissed: new Date().toISOString() })}>
              Abaikan
            </Button>
          </div>
        );
      })}
    </section>
  );
}
