import { useState, type ReactNode } from 'react';

import { DateField } from '@/components/common/DateField';
import { Button, INPUT } from '@/components/common/ui';
import { writeRosterFields, writeRosterPlace } from '@/data/repositories/floors.repo';
import { planRooms, wardPlan } from '@/domain/denahPlan';
import { formatDmy } from '@/domain/dateDmy';
import {
  chiefsOf,
  colourFields,
  colourMark,
  DIVISIONS,
  divisionOf,
  localStamp,
  suggestionFor,
  type ColourMark,
  type FloorDoc,
  type RosterPatient,
  type StatusChange,
} from '@/domain/floorList/floor';
import { markCss } from '@/domain/floorList/marks';
import type { FloorPatient } from '@/domain/floorList/report';
import { DeletePatient } from './DeletePatient';

const COLOUR_OPTIONS: ReadonlyArray<readonly [ColourMark, string]> = [
  ['none', 'Tanpa warna'],
  ['h1', 'H-1 (merah)'],
  ['today', 'Pulang hari ini (hijau)'],
];
const PINDAH_CHIPS = ['ICU', 'CVCU', 'HCU', 'ICCU', 'Lantai lain'];

/** The datalists the junior/chief inputs offer; rendered once per page. */
export function RosterDatalists({ floor }: { floor: FloorDoc }): JSX.Element {
  return (
    <>
      <datalist id="floor-juniors">
        {chiefsOf(floor.juniors).map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <datalist id="floor-chiefs">
        {chiefsOf(floor.chiefs).map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </>
  );
}

/**
 * Every hand decision on one patient (13.9): residents, holder, colour,
 * planned discharge, Pulang / Pindah / Kamar-bed, the Plan suggestion. One
 * component for the List card and the SOAP window opened from the denah
 * (Avi: "a control panel for a clicked patient on the denah"), so the two
 * never drift apart. Every change is a logged leaf write.
 */
export function PatientControls({
  floor,
  entry,
  patient,
  date,
  myName,
  onEditManual,
  onGone,
  narrow = false,
  allowDelete = false,
}: {
  floor: FloorDoc;
  entry: RosterPatient;
  /** As shown on this list date (residents and colour applied). */
  patient: FloorPatient;
  date: string;
  myName: string;
  onEditManual?: ((patient: FloorPatient) => void) | undefined;
  /** After Pulang / Pindah (the SOAP window closes). */
  onGone?: (() => void) | undefined;
  /** In the SOAP window (a 480 px box even on a wide screen): two columns. */
  narrow?: boolean;
  /** The small two-tap "Hapus" at the end of the status row (the List row; the SOAP window has its own). */
  allowDelete?: boolean;
}): JSX.Element {
  const [open, setOpen] = useState<'pindah' | 'place' | null>(null);
  const [pindahTo, setPindahTo] = useState('');
  const [placeRoom, setPlaceRoom] = useState('');
  const [placeBed, setPlaceBed] = useState('');
  const plan = wardPlan(floor.ward);
  const rooms = plan ? planRooms(plan).map((slot) => slot.room).sort() : [];
  const chiefs = chiefsOf(floor.chiefs);
  const suggestion = suggestionFor(entry, date);
  const colourOptions = COLOUR_OPTIONS;
  const detected = divisionOf({ ...entry, division: '' });
  const shown = new Set((patient.tags ?? []).map((t) => t.label));
  /** On → off: off for this patient even if a rule puts it on; off → on: set by hand. */
  const toggleTag = (id: string, label: string): void => {
    if (shown.has(label)) {
      set({ tags: entry.tags.filter((t) => t !== id), tagsOff: [...new Set([...entry.tagsOff, id])] }, `Tag ${label} dilepas`);
    } else {
      set({ tags: [...new Set([...entry.tags, id])], tagsOff: entry.tagsOff.filter((t) => t !== id) }, `Tag ${label}`);
    }
  };

  const stamp = (what: string): StatusChange => ({ at: new Date().toISOString(), by: myName, what });
  const set = (fields: Parameters<typeof writeRosterFields>[2], what?: string): void => {
    void writeRosterFields(floor.id, entry.key, fields, what ? stamp(what) : undefined);
  };

  const roomsSelect =
    rooms.length > 0 ? (
      <select aria-label="Kamar baru" value={placeRoom} onChange={(e) => setPlaceRoom(e.target.value)} className={`${INPUT} !w-24 text-xs`}>
        {rooms.includes(placeRoom) ? null : <option value={placeRoom}>{placeRoom || '—'}</option>}
        {rooms.map((room) => (
          <option key={room} value={room}>
            {room}
          </option>
        ))}
      </select>
    ) : (
      <input aria-label="Kamar baru" value={placeRoom} onChange={(e) => setPlaceRoom(e.target.value)} className={`${INPUT} !w-24 text-xs`} />
    );
  const cols = narrow ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3';

  return (
    <div className="space-y-3 text-xs">
      {suggestion ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg px-2 py-1" style={{ backgroundColor: 'var(--warn-soft)' }}>
          <span className="flex-1">
            Plan menyebut <strong>{suggestion === 'h1' ? 'H-1' : 'pulang hari ini'}</strong>. Tandai?
          </span>
          <Button size="sm" onClick={() => set(colourFields(suggestion, date), suggestion === 'h1' ? 'H-1 (dari saran Plan)' : 'Pulang hari ini (dari saran Plan)')}>
            Tandai
          </Button>
          <Button size="sm" variant="ghost" onClick={() => set({ dismissed: entry.report.sentAt })}>
            Abaikan
          </Button>
        </div>
      ) : null}

      {/*
        Grouped by purpose (13.15, Avi: "each button different, so the purpose
        is read at a glance"): who holds the patient · discharge plan · tags ·
        what happens to the patient. Fields carry their own label; the three
        status actions each have their own colour.
      */}
      <Group title="Residen">
        <div className={`grid gap-1.5 ${cols}`}>
          <Labelled label="Junior">
            <input
              key={`j-${entry.junior}`}
              aria-label={`Junior ${patient.name}`}
              defaultValue={entry.junior}
              list="floor-juniors"
              placeholder={patient.junior || '—'}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next !== entry.junior) set({ junior: next });
              }}
              className={`${INPUT} text-xs`}
            />
          </Labelled>
          <Labelled label="Chief">
            <input
              key={`c-${entry.chief}`}
              aria-label={`Chief ${patient.name}`}
              defaultValue={entry.chief}
              list="floor-chiefs"
              placeholder={patient.chief || (chiefs.length > 1 && !patient.division ? 'pilih' : '—')}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next !== entry.chief) set({ chief: next });
              }}
              className={`${INPUT} text-xs`}
            />
          </Labelled>
          {/*
            Who holds the patient (13.9): a consult from another department to
            a cardiology division (Aritmia…) is held by that division's
            resident — listed, not followed up by the ward, counted for nobody.
          */}
          <Labelled label="Pemegang">
            <select
              aria-label={`Pemegang ${patient.name}`}
              value={entry.division}
              onChange={(e) => {
                const next = e.target.value;
                set({ division: next }, next === '-' ? 'Dipegang residen bangsal' : next ? `Dipegang divisi ${next}` : 'Pemegang otomatis');
              }}
              className={`${INPUT} text-xs`}
            >
              <option value="">{detected ? `${detected === 'KJS' ? 'KJS' : `Div. ${detected}`} (otomatis)` : 'Residen bangsal'}</option>
              <option value="-">Residen bangsal</option>
              {DIVISIONS.map((d) => (
                <option key={d} value={d}>
                  Div. {d} (tidak di-FU)
                </option>
              ))}
            </select>
          </Labelled>
          {/* Handover notes (13.14): printed in the Word/PDF "Operkan" and "Ganti Chief" boxes. */}
          <Labelled label="Operkan ke">
            <input
              key={`o-${entry.operkan}`}
              aria-label={`Operkan ${patient.name} ke`}
              defaultValue={entry.operkan}
              list="floor-juniors"
              placeholder="—"
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next !== entry.operkan) set({ operkan: next }, next ? `Operkan ke ${next}` : 'Operkan dihapus');
              }}
              className={`${INPUT} text-xs`}
            />
          </Labelled>
          <Labelled label="Ganti chief">
            <input
              key={`g-${entry.gantiChief}`}
              aria-label={`Ganti chief ${patient.name}`}
              defaultValue={entry.gantiChief}
              list="floor-chiefs"
              placeholder="—"
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next !== entry.gantiChief) set({ gantiChief: next }, next ? `Ganti chief ke ${next}` : 'Ganti chief dihapus');
              }}
              className={`${INPUT} text-xs`}
            />
          </Labelled>
        </div>
      </Group>

      <Group title="Rencana pulang">
        <div className={`grid gap-1.5 ${cols}`}>
          <Labelled label="Warna">
            <select
              aria-label={`Warna ${patient.name}`}
              value={colourMark(entry, date)}
              onChange={(e) => {
                const next = e.target.value as ColourMark;
                set(colourFields(next, date), colourOptions.find(([v]) => v === next)?.[1] ?? next);
              }}
              className={`${INPUT} text-xs`}
            >
              {colourOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Labelled>
          <Labelled label="Tanggal pulang">
            <DateField
              value={entry.dischargeDate}
              allowEmpty
              ariaLabel={`Rencana pulang ${patient.name}`}
              onChange={(next) => set({ dischargeDate: next }, next ? `Rencana pulang ${formatDmy(next)}` : 'Rencana pulang dihapus')}
              className="w-full"
            />
          </Labelled>
        </div>
      </Group>

      {floor.marks.length > 0 ? (
        // The floor's tags (13.10): tap to set or remove on this patient; a
        // rule-set tag removed here stays off for this patient.
        <Group title="Tag">
          <div className="flex flex-wrap items-center gap-1.5">
            {floor.marks.map((mark) => {
              const on = shown.has(mark.label);
              return (
                <button
                  key={mark.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleTag(mark.id, mark.label)}
                  className="min-h-8 rounded-full border px-2.5 text-xs font-semibold"
                  style={
                    on
                      ? { borderColor: markCss(mark.color), color: markCss(mark.color), backgroundColor: `color-mix(in srgb, ${markCss(mark.color)} 12%, var(--surface))` }
                      : { borderColor: 'var(--border)', color: 'var(--fg-muted)' }
                  }
                >
                  {on ? '✓ ' : '+ '}
                  {mark.label}
                  {mark.auto ? <span className="font-normal"> · otomatis</span> : null}
                </button>
              );
            })}
          </div>
        </Group>
      ) : null}

      <Group title="Status pasien">
        <div className="flex flex-wrap items-center gap-1.5">
          <Action
            tone="var(--note-green)"
            onClick={() => {
              set({ status: 'pulang', leftAt: new Date().toISOString() }, 'Pulang');
              onGone?.();
            }}
          >
            ✓ Pulang
          </Action>
          <Action
            tone="var(--warn-strong)"
            pressed={open === 'pindah'}
            onClick={() => {
              setOpen(open === 'pindah' ? null : 'pindah');
              setPindahTo('');
            }}
          >
            ↗ Pindah ruangan…
          </Action>
          <Action
            tone="var(--accent)"
            pressed={open === 'place'}
            onClick={() => {
              setOpen(open === 'place' ? null : 'place');
              setPlaceRoom(patient.room);
              setPlaceBed(patient.bed);
            }}
          >
            ⇄ Kamar/bed…
          </Action>
          {patient.manual && onEditManual ? (
            <Action tone="var(--fg-muted)" onClick={() => onEditManual(patient)}>
              ✎ Ubah isi
            </Action>
          ) : null}
          <span className="flex-1" />
          {allowDelete ? <DeletePatient floorId={floor.id} patientKey={entry.key} name={patient.name} compact /> : null}
        </div>

        {open === 'place' ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-fg-muted">Pindah di lantai ini:</span>
            {roomsSelect}
            <input
              aria-label="Bed baru"
              value={placeBed}
              onChange={(e) => setPlaceBed(e.target.value.trim())}
              inputMode="numeric"
              placeholder="Bed"
              className={`${INPUT} !w-20 text-xs`}
            />
            <Button
              size="sm"
              variant="primary"
              disabled={!placeRoom.trim() || (placeRoom === patient.room && placeBed === patient.bed)}
              onClick={() => {
                const from = `${patient.room}${patient.bed ? `/${patient.bed}` : ''}`;
                const to = `${placeRoom.trim()}${placeBed ? `/${placeBed}` : ''}`;
                void writeRosterPlace(floor.id, entry.key, placeRoom.trim(), placeBed, localStamp(new Date()), stamp(`Pindah kamar ${from} → ${to}`));
                setOpen(null);
              }}
            >
              Simpan kamar
            </Button>
          </div>
        ) : null}

        {open === 'pindah' ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {PINDAH_CHIPS.map((chip) => (
              <Button key={chip} size="sm" variant={pindahTo === chip ? 'primary' : 'secondary'} onClick={() => setPindahTo(chip)}>
                {chip}
              </Button>
            ))}
            <input value={pindahTo} onChange={(e) => setPindahTo(e.target.value)} placeholder="Tujuan" aria-label="Tujuan pindah" className={`${INPUT} !w-32 text-xs`} />
            <Button
              size="sm"
              variant="primary"
              disabled={!pindahTo.trim()}
              onClick={() => {
                set({ status: 'pindah', pindahKe: pindahTo.trim(), leftAt: new Date().toISOString() }, `Pindah ke ${pindahTo.trim()}`);
                setOpen(null);
                onGone?.();
              }}
            >
              Simpan pindah
            </Button>
          </div>
        ) : null}
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section>
      <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-fg-faint">{title}</h4>
      {children}
    </section>
  );
}

function Labelled({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div className="min-w-0">
      <span className="mb-0.5 block text-[11px] text-fg-muted">{label}</span>
      {children}
    </div>
  );
}

/** A status action in its own colour: green Pulang, amber Pindah, accent Kamar/bed. */
function Action({ tone, pressed, onClick, children }: { tone: string; pressed?: boolean; onClick: () => void; children: ReactNode }): JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="min-h-tap rounded-lg border px-3 text-xs font-semibold [@media(pointer:fine)]:min-h-9"
      style={{
        borderColor: tone,
        color: tone,
        backgroundColor: pressed ? `color-mix(in srgb, ${tone} 16%, var(--surface))` : `color-mix(in srgb, ${tone} 6%, var(--surface))`,
      }}
    >
      {children}
    </button>
  );
}
