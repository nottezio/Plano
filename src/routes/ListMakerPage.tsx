import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AppShell } from '@/components/common/AppShell';
import { DateField } from '@/components/common/DateField';
import { Button, Callout, ChoiceChip, Field, INPUT, Segmented } from '@/components/common/ui';
import { FloorDenah } from '@/components/floor/FloorDenah';
import { ListPanel } from '@/components/floor/ListPanel';
import { MembersPanel } from '@/components/floor/MembersPanel';
import { PastePanel } from '@/components/floor/PastePanel';
import { SoapFloat } from '@/components/floor/SoapFloat';
import { acceptInvite, createFloor, readLegacy, writeChiefs, writeRosterBatch } from '@/data/repositories/floors.repo';
import { wardPlan } from '@/domain/denahPlan';
import { canEdit, chiefsOf, isOwner, newRosterPatient, rosterView, type FloorDoc } from '@/domain/floorList/floor';
import { ChiefsField } from '@/components/floor/ChiefsField';
import { EditionsPanel } from '@/components/floor/EditionsPanel';
import { latestOf, type FloorPatient } from '@/domain/floorList/report';
import { useClinicalToday } from '@/hooks/useClinicalToday';
import { useEditions, useMyFloors, useRoster } from '@/hooks/useFloor';
import { useSession } from '@/store/useSession';

type Tab = 'denah' | 'list' | 'tempel' | 'riwayat' | 'anggota';

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
  const view = useMemo(() => (floor ? rosterView(floor, roster, date) : { active: [], left: [] }), [floor, roster, date]);
  // The OPEN patient is kept by key and read from the live view, so an edit
  // (Ubah SOAP, another member's paste) shows in the open box at once.
  const [openKey, setOpenKey] = useState<string | null>(null);
  const setOpen = (patient: FloorPatient | null): void => setOpenKey(patient?.key ?? null);
  const open: FloorPatient | null =
    openKey === null
      ? null
      : (view.active.find((p) => p.key === openKey) ?? view.left.find((p) => p.key === openKey)?.report ?? null);
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
    ['riwayat', 'Riwayat'],
    ['anggota', 'Anggota'],
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
              Boleh lebih dari satu list (mis. per lantai atau per tim). Setelah dibuat, undang anggota di tab Anggota.
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
            <div className="flex flex-wrap items-end gap-2">
              {floors.map((f) => (
                <ChoiceChip
                  key={f.id}
                  active={f.id === floor.id}
                  onClick={() => {
                    const p = new URLSearchParams(params);
                    p.set('f', f.id);
                    setParams(p, { replace: true });
                  }}
                >
                  {f.name}
                </ChoiceChip>
              ))}
              <ChoiceChip
                active={false}
                onClick={() => {
                  setName('');
                  setShowCreate(true);
                }}
              >
                + List baru
              </ChoiceChip>
              <span className="flex-1" />
              <Field label="Tanggal list">
                <DateField value={date} onChange={setDate} className="w-40" />
              </Field>
              {editable ? (
                <ChiefsField chiefs={chiefsOf(floor.chiefs)} onChange={(next) => void writeChiefs(floor.id, next.join(', '))} />
              ) : null}
            </div>

            <Segmented label="Tampilan" value={tab} onChange={setTab} options={tabs} />

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

            {tab === 'denah' ? (
              view.active.length === 0 ? (
                <p className="text-sm text-fg-muted">Belum ada pasien di list.{editable ? ' Tempel pesan SOAP di tab Tempel.' : ''}</p>
              ) : (
                <FloorDenah plan={wardPlan(floor.ward)} ward={floor.ward} patients={view.active} onOpen={setOpen} />
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
              />
            ) : null}
            {tab === 'tempel' && editable ? <PastePanel key={floor.id} floor={floor} roster={roster} myName={myName} /> : null}
            {tab === 'riwayat' ? <EditionsPanel key={floor.id} floor={floor} editions={editions} /> : null}
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
      <SoapFloat patient={open} onClose={() => setOpenKey(null)} floorId={floor?.id} editable={editable} />
    </AppShell>
  );
}
