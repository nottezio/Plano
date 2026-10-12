import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AppShell } from '@/components/common/AppShell';
import { DateField } from '@/components/common/DateField';
import { Button, Callout, ChoiceChip, Field, INPUT, Segmented } from '@/components/common/ui';
import { FloorDenah } from '@/components/floor/FloorDenah';
import { ListPanel } from '@/components/floor/ListPanel';
import { MembersPanel } from '@/components/floor/MembersPanel';
import { PastePanel } from '@/components/floor/PastePanel';
import { SoapFloat } from '@/components/floor/SoapFloat';
import { acceptInvite, createFloor, writeDayFields } from '@/data/repositories/floors.repo';
import { wardPlan } from '@/domain/denahPlan';
import { buildFloorList } from '@/domain/floorList/build';
import { buildDenahDocx, buildListDocx, DOCX_MIME, floorFileName } from '@/domain/floorList/docx';
import { canEdit, dayView, emptyDay, isOwner, type FloorDoc } from '@/domain/floorList/floor';
import { deliverFile } from '@/lib/download';
import type { FloorPatient } from '@/domain/floorList/report';
import { useClinicalToday } from '@/hooks/useClinicalToday';
import { useFloorDays, useMyFloors } from '@/hooks/useFloor';
import { useSession } from '@/store/useSession';

type Tab = 'denah' | 'list' | 'tempel' | 'anggota';

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
  const { days } = useFloorDays(floor?.id ?? null, date);
  const day = days.find((d) => d.date === date) ?? emptyDay(date);
  const view = useMemo(() => (floor ? dayView(floor, days, date) : { present: [], gone: [], hidden: [] }), [floor, days, date]);
  const [open, setOpen] = useState<FloorPatient | null>(null);
  const editable = floor ? canEdit(floor, uid) : false;

  // New floor form.
  const [name, setName] = useState('PJT Lantai 4');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const create = async (): Promise<void> => {
    if (!uid) return;
    setCreating(true);
    setCreateError('');
    try {
      const id = await createFloor(uid, myName, name.trim() || 'PJT Lantai 4', name.trim() || 'PJT Lantai 4');
      const p = new URLSearchParams(params);
      p.set('f', id);
      setParams(p, { replace: true });
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
    ['anggota', 'Anggota'],
  ];

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

        {state === 'ready' && floors.length === 0 ? (
          <section className="max-w-md space-y-3 rounded-2xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold">Buat list lantai</h2>
            <p className="text-xs text-fg-muted">
              Satu list per lantai. Setelah dibuat, undang anggota tim di tab Anggota.
            </p>
            <Field label="Nama lantai" htmlFor="floor-name">
              <input id="floor-name" value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
            </Field>
            <Button variant="primary" onClick={() => void create()} disabled={creating}>
              {creating ? 'Membuat…' : 'Buat list'}
            </Button>
            {createError ? <Callout tone="warn">{createError}</Callout> : null}
          </section>
        ) : null}

        {floor ? (
          <>
            <div className="flex flex-wrap items-end gap-2">
              {floors.length > 1
                ? floors.map((f) => (
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
                  ))
                : <h2 className="text-sm font-semibold">{floor.name}</h2>}
              <span className="flex-1" />
              <Field label="Tanggal list">
                <DateField value={date} onChange={setDate} className="w-40" />
              </Field>
              {editable ? (
                <>
                  <Field label="Jam" htmlFor="list-time">
                    <input
                      id="list-time"
                      key={`t-${day.time}`}
                      defaultValue={day.time}
                      onBlur={(e) => {
                        const next = e.target.value.trim();
                        if (next && next !== day.time) void writeDayFields(floor.id, date, { time: next });
                      }}
                      className={`${INPUT} w-20`}
                    />
                  </Field>
                  <Field label="Chief hari ini" htmlFor="list-chief">
                    <input
                      id="list-chief"
                      key={`c-${day.chief}`}
                      defaultValue={day.chief}
                      placeholder="Nama"
                      onBlur={(e) => {
                        const next = e.target.value.trim();
                        if (next !== day.chief) void writeDayFields(floor.id, date, { chief: next });
                      }}
                      className={`${INPUT} w-32`}
                    />
                  </Field>
                </>
              ) : null}
            </div>

            <Segmented label="Tampilan" value={tab} onChange={setTab} options={tabs} />

            {view.present.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    const text = buildFloorList(view.present, { ward: floor.ward, date, time: day.time });
                    void deliverFile(new Blob([buildListDocx(text)], { type: DOCX_MIME }), floorFileName('List Pasien', floor.ward, date));
                  }}
                >
                  Word: List Pasien
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const bytes = buildDenahDocx({ ward: floor.ward, date, plan: wardPlan(floor.ward), patients: view.present });
                    void deliverFile(new Blob([bytes], { type: DOCX_MIME }), floorFileName('Denah', floor.ward, date));
                  }}
                >
                  Word: Denah
                </Button>
              </div>
            ) : null}

            {tab === 'denah' ? (
              view.present.length === 0 ? (
                <p className="text-sm text-fg-muted">
                  Belum ada pasien untuk {date === today ? 'hari ini' : 'tanggal ini'}.
                  {editable ? ' Tempel pesan SOAP di tab Tempel.' : ''}
                </p>
              ) : (
                <FloorDenah plan={wardPlan(floor.ward)} ward={floor.ward} patients={view.present} onOpen={setOpen} />
              )
            ) : null}
            {tab === 'list' ? (
              <ListPanel floorId={floor.id} ward={floor.ward} date={date} day={day} view={view} editable={editable} onOpen={setOpen} />
            ) : null}
            {tab === 'tempel' && editable ? <PastePanel floor={floor} days={days} date={date} myName={myName} /> : null}
            {tab === 'anggota' && uid ? (
              <MembersPanel floor={floor} uid={uid} patients={[...view.present, ...view.gone.map((g) => g.patient)]} />
            ) : null}
            {isOwner(floor, uid) ? null : (
              <p className="text-[11px] text-fg-faint">
                Anda {editable ? 'bisa melihat dan mengedit' : 'hanya bisa melihat'} list ini.
              </p>
            )}
          </>
        ) : null}
      </div>
      <SoapFloat patient={open} onClose={() => setOpen(null)} />
    </AppShell>
  );
}
