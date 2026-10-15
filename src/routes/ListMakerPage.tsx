import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AppShell } from '@/components/common/AppShell';
import { Button, Callout, Field, INPUT } from '@/components/common/ui';
import { FloorDenah } from '@/components/floor/FloorDenah';
import { ListPanel } from '@/components/floor/ListPanel';
import { MembersPanel } from '@/components/floor/MembersPanel';
import { ManualPatientSheet } from '@/components/floor/ManualPatientSheet';
import { PastePanel } from '@/components/floor/PastePanel';
import { RosterDatalists } from '@/components/floor/PatientControls';
import { SoapFloat } from '@/components/floor/SoapFloat';
import { acceptInvite, createFloor, readLegacy, writeChiefs, writeRosterBatch } from '@/data/repositories/floors.repo';
import { wardPlan } from '@/domain/denahPlan';
import { canEdit, chiefsOf, isOwner, localStamp, newRosterPatient, rosterView, type FloorDoc } from '@/domain/floorList/floor';
import { searchWords } from '@/domain/floorList/search';
import { AnalysisPanel } from '@/components/floor/AnalysisPanel';
import { ListMakerHeader } from '@/components/floor/ListMakerHeader';
import { EditionsPanel } from '@/components/floor/EditionsPanel';
import { latestOf, type FloorPatient } from '@/domain/floorList/report';
import { useClinicalToday } from '@/hooks/useClinicalToday';
import { useMediaQuery } from '@/hooks/useMediaQuery';

/** Patient boxes open at once on a wide screen; the oldest closes first. */
const MAX_OPEN = 4;
import { useEditions, useMyFloors, useRoster } from '@/hooks/useFloor';
import { useSession } from '@/store/useSession';

type Tab = 'denah' | 'list' | 'tempel' | 'analisis' | 'riwayat' | 'anggota';

const WIP = (
  <span className="rounded-full border border-danger px-2 py-0.5 text-[10px] font-semibold text-danger">WIP</span>
);

/**
 * List Maker (12.8): the floor's patient list and denah, made from the SOAP
 * messages colleagues post in the floor's WhatsApp group, shared with the
 * floor team (members with "Lihat saja" or "Lihat dan edit").
 *
 * A full page of its own (Avi: "open a new page for this, so the view is a
 * full app"), not a Helper tab: the denah is used standing at the bed during
 * the DPJP visit and needs the whole screen.
 */
export default function ListMakerPage(): JSX.Element {
  const uid = useSession((s) => s.user?.uid ?? null);
  const user = useSession((s) => s.user);
  const myName = user?.displayName?.split(' ').slice(0, 2).join(' ') || user?.email || 'Saya';
  const today = useClinicalToday();
  const [params, setParams] = useSearchParams();
  const { floors, invites, state, error } = useMyFloors();
  const floorId = params.get('f') ?? floors[0]?.id ?? null;
  const floor: FloorDoc | null = floors.find((f) => f.id === floorId) ?? floors[0] ?? null;
  const [date, setDate] = useState(today);
  const tab = (params.get('tab') as Tab | null) ?? 'denah';
  const setTab = (next: Tab): void => {
    const p = new URLSearchParams(params);
    p.set('tab', next);
    setParams(p, { replace: true });
  };
  const { roster, state: rosterState } = useRoster(floor?.id ?? null);
  const editions = useEditions(floor?.id ?? null);
  // "Pasien baru" (13.10): not on the last list sent before this date.
  const previous = useMemo(() => {
    const last = editions.find((e) => e.date < date);
    return last ? new Set(last.patients.map((p) => p.key)) : null;
  }, [editions, date]);
  // SOAPs that came after the last sent list are marked "SOAP baru" (13.11).
  const lastSent = editions[0] ? localStamp(new Date(editions[0].createdAt)) : '';
  const view = useMemo(
    () => (floor ? rosterView(floor, roster, date, previous, lastSent) : { active: [], left: [] }),
    [floor, roster, date, previous, lastSent],
  );
  // One search for the list and the denah (13.7): switching tabs keeps it.
  const [search, setSearch] = useState('');
  // A hand-entered patient opened from the denah is edited here (13.11).
  const [manualFor, setManualFor] = useState<FloorPatient | null>(null);
  const words = useMemo(() => searchWords(search), [search]);
  // The OPEN patient is kept by key and read from the live view, so an edit
  // (Ubah SOAP, another member's paste) shows in the open box at once.
  /*
    Several boxes on a wide screen (2026-10-16, Avi): the keys of the open
    patients, front-most last. Opening a patient already open brings it to
    the front; at most MAX_OPEN, the oldest closing first. A phone keeps one
    (a bottom sheet).
  */
  const wide = useMediaQuery('(min-width: 640px)');
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const setOpen = (patient: FloorPatient | null): void => {
    if (!patient) return setOpenKeys([]);
    setOpenKeys((keys) => (wide ? [...keys.filter((k) => k !== patient.key), patient.key].slice(-MAX_OPEN) : [patient.key]));
  };
  const closeOpen = (key: string): void => setOpenKeys((keys) => keys.filter((k) => k !== key));
  const toFront = (key: string): void => setOpenKeys((keys) => (keys.at(-1) === key ? keys : [...keys.filter((k) => k !== key), key]));
  // A box keeps its cascade slot while it is open, whatever the front order does.
  const slots = useRef(new Map<string, number>());
  for (const key of [...slots.current.keys()]) if (!openKeys.includes(key)) slots.current.delete(key);
  for (const key of openKeys) {
    if (slots.current.has(key)) continue;
    const used = new Set(slots.current.values());
    let slot = 0;
    while (used.has(slot)) slot += 1;
    slots.current.set(key, slot);
  }
  const patientOf = (key: string): FloorPatient | null =>
    view.active.find((p) => p.key === key) ?? view.left.find((p) => p.key === key)?.report ?? null;
  const editable = floor ? canEdit(floor, uid) : false;

  // New floor form.
  const [name, setName] = useState('PJT Lantai 4');
  const [ward, setWard] = useState('PJT Lantai 4');
  // A user can keep several lists (12.11): "+ List baru" opens the form again.
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const create = async (): Promise<void> => {
    if (!uid) return;
    setCreating(true);
    setCreateError('');
    try {
      const id = await createFloor(uid, myName, name.trim() || ward, ward);
      const p = new URLSearchParams(params);
      p.set('f', id);
      setParams(p, { replace: true });
      setShowCreate(false);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Gagal membuat list.');
    } finally {
      setCreating(false);
    }
  };

  const tabs: ReadonlyArray<readonly [Tab, string]> = [
    ['denah', 'Denah'],
    ['list', 'List'],
    ...(editable ? ([['tempel', 'Tempel']] as const) : []),
    ['analisis', 'Analisis'],
    ['riwayat', 'Riwayat'],
    // Members, the junior roster, the floor's colours, nicknames, delete:
    // the list's settings, not only its members (13.15).
    ['anggota', 'Setelan'],
  ];

  /*
    One-time move from the pre-12.12 storage (reports per day, hand-entered
    patients on the floor document) onto the roster: the latest report of
    each patient becomes a roster patient, status Dirawat. Offered, never
    automatic, and only while the roster is empty.
  */
  const [migrating, setMigrating] = useState(false);
  /*
    Only offered when there IS old data (12.12): the callout showed on every
    new, empty list, where the button did nothing. Read once per empty list.
  */
  const [legacyFor, setLegacyFor] = useState<{ floorId: string; count: number } | null>(null);
  const rosterEmpty = editable && rosterState === 'ready' && roster.length === 0;
  useEffect(() => {
    if (!floor || !rosterEmpty || legacyFor?.floorId === floor.id) return;
    let live = true;
    readLegacy(floor.id)
      .then(({ reports, manual }) => {
        if (live) setLegacyFor({ floorId: floor.id, count: latestOf([...reports, ...manual]).length });
      })
      .catch(() => {
        if (live) setLegacyFor({ floorId: floor.id, count: 0 });
      });
    return () => {
      live = false;
    };
  }, [floor, rosterEmpty, legacyFor]);
  const legacyCount = floor && legacyFor?.floorId === floor.id ? legacyFor.count : 0;
  const migrate = async (): Promise<void> => {
    if (!floor) return;
    setMigrating(true);
    try {
      const { reports, manual } = await readLegacy(floor.id);
      const at = new Date().toISOString();
      await writeRosterBatch(
        floor.id,
        latestOf([...reports, ...manual]).map((report) => ({ kind: 'add' as const, patient: newRosterPatient(report, at, myName) })),
      );
    } finally {
      setMigrating(false);
    }
  };

  return (
    <AppShell title="List Maker" titleBadge={WIP}>
      <div className="mx-auto max-w-7xl space-y-4 px-4 pb-24 pt-0 lg:pt-4">
        {invites.map((invited) => (
          <Callout key={invited.id} title={`Undangan: ${invited.name}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex-1">
                Anda diundang ({invited.invites[(user?.email ?? '').toLowerCase()] === 'edit' ? 'lihat dan edit' : 'lihat saja'}).
              </span>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  if (uid && user?.email) void acceptInvite(invited, uid, user.email, myName);
                }}
              >
                Terima
              </Button>
            </div>
          </Callout>
        ))}

        {state === 'error' ? (
          <Callout tone="warn" title="List belum bisa dibuka">
            {error}
          </Callout>
        ) : null}

        {state === 'ready' && (floors.length === 0 || showCreate) ? (
          <section className="max-w-md space-y-3 rounded-2xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold">Buat list baru</h2>
            <p className="text-xs text-fg-muted">
              Boleh lebih dari satu list (mis. per lantai atau per tim). Setelah dibuat, undang anggota di tab Setelan.
            </p>
            <Field label="Nama list" htmlFor="floor-name">
              <input id="floor-name" value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
            </Field>
            <Field label="Denah" htmlFor="floor-ward">
              <select id="floor-ward" value={ward} onChange={(e) => setWard(e.target.value)} className={INPUT}>
                <option value="PJT Lantai 4">PJT Lantai 4</option>
              </select>
            </Field>
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => void create()} disabled={creating}>
                {creating ? 'Membuat…' : 'Buat list'}
              </Button>
              {floors.length > 0 ? <Button onClick={() => setShowCreate(false)}>Batal</Button> : null}
            </div>
            {createError ? <Callout tone="warn">{createError}</Callout> : null}
          </section>
        ) : null}

        {floor ? (
          <>
            <ListMakerHeader
              floors={floors}
              floorId={floor.id}
              onPickFloor={(id) => {
                const p = new URLSearchParams(params);
                p.set('f', id);
                setParams(p, { replace: true });
              }}
              onNewFloor={() => {
                setName('');
                setShowCreate(true);
              }}
              date={date}
              onDate={setDate}
              chiefs={editable ? chiefsOf(floor.chiefs) : null}
              onChiefs={(next) => void writeChiefs(floor.id, next.join(', '))}
              tab={tab}
              tabs={tabs}
              onTab={setTab}
            />

            {rosterEmpty && legacyCount > 0 ? (
              <Callout title="Ada data lama">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex-1">
                    List ini diisi sebelum pembaruan 12.12 ({legacyCount} pasien). Pindahkan ke daftar pasien yang baru, lalu
                    periksa warnanya.
                  </span>
                  <Button size="sm" onClick={() => void migrate()} disabled={migrating}>
                    {migrating ? 'Memindahkan…' : 'Pindahkan data lama'}
                  </Button>
                </div>
              </Callout>
            ) : null}

            {(tab === 'denah' || tab === 'list') && view.active.length > 0 ? (
              <div className="relative">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama, RM, kamar (417/2), residen, diagnosis…"
                  aria-label="Cari pasien"
                  className={`${INPUT} pr-10`}
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Hapus pencarian"
                    className="absolute right-0 top-0 h-full min-w-tap text-fg-muted hover:text-fg"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ) : null}

            {tab === 'denah' ? (
              view.active.length === 0 ? (
                <p className="text-sm text-fg-muted">Belum ada pasien di list.{editable ? ' Tempel pesan SOAP di tab Tempel.' : ''}</p>
              ) : (
                <FloorDenah plan={wardPlan(floor.ward)} ward={floor.ward} patients={view.active} onOpen={setOpen} words={words} marks={floor.marks} />
              )
            ) : null}
            {tab === 'list' ? (
              <ListPanel
                key={floor.id}
                floor={floor}
                roster={roster}
                view={view}
                date={date}
                editable={editable}
                onOpen={setOpen}
                myName={myName}
                editions={editions}
                words={words}
              />
            ) : null}
            {tab === 'tempel' && editable ? <PastePanel key={floor.id} floor={floor} roster={roster} myName={myName} /> : null}
            {tab === 'analisis' ? <AnalysisPanel key={floor.id} ward={floor.ward || floor.name} roster={roster} view={view} date={date} editions={editions} onOpen={setOpen} /> : null}
            {tab === 'riwayat' ? <EditionsPanel key={floor.id} floor={floor} editions={editions} editable={editable} /> : null}
            {tab === 'anggota' && uid ? (
              <MembersPanel key={floor.id} floor={floor} uid={uid} patients={[...view.active, ...view.left.map((p) => p.report)]} />
            ) : null}
            {isOwner(floor, uid) ? null : (
              <p className="text-[11px] text-fg-faint">
                Anda {editable ? 'bisa melihat dan mengedit' : 'hanya bisa melihat'} list ini.
              </p>
            )}
          </>
        ) : null}
      </div>
      {floor ? <RosterDatalists floor={floor} /> : null}
      {floor ? (
        <ManualPatientSheet
          open={manualFor !== null}
          onOpenChange={(next) => {
            if (!next) setManualFor(null);
          }}
          floorId={floor.id}
          ward={floor.ward}
          date={date}
          myName={myName}
          editing={manualFor}
        />
      ) : null}
      {/* Rendered in a fixed order (by slot) and layered by z-index: re-ordering
          the elements on a click would move the DOM node and drop the drag
          that click just started. */}
      {[...openKeys].sort((a, b) => (slots.current.get(a) ?? 0) - (slots.current.get(b) ?? 0)).map((key) => {
        const layer = openKeys.indexOf(key);
        const open = patientOf(key);
        const entry = open && floor ? roster.find((p) => p.key === key && p.status === 'dirawat') : undefined;
        return (
          <SoapFloat
            key={key}
            patient={open}
            onClose={() => closeOpen(key)}
            floorId={floor?.id}
            editable={editable}
            onEditManual={setManualFor}
            control={entry && floor ? { floor, entry, date, myName } : undefined}
            stack={{ slot: slots.current.get(key) ?? 0, layer, front: layer === openKeys.length - 1, onFocus: () => toFront(key) }}
          />
        );
      })}
    </AppShell>
  );
}
