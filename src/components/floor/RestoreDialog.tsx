import { useEffect, useMemo, useState } from 'react';

import { Button, Callout } from '@/components/common/ui';
import { Sheet } from '@/components/common/Sheet';
import { applyRestore, readRestorePoint, readRosterPatients, saveRestorePoint } from '@/data/repositories/floors.repo';
import { formatDmy } from '@/domain/dateDmy';
import { localOf, type FloorDoc, type RosterPatient } from '@/domain/floorList/floor';
import { isEmptyPlan, planRestore, pointBeforeRestore, type RestorePoint, type RestorePointMeta } from '@/domain/floorList/restore';

const where = (p: RosterPatient): string => `${p.report.room}${p.report.bed ? `/${p.report.bed}` : ''}`;
const named = (list: readonly RosterPatient[]): string => list.map((p) => `${where(p)} ${p.report.name}`).join(' · ');

export function pointWhen(meta: Pick<RestorePointMeta, 'createdAt'>): string {
  const local = localOf(meta.createdAt);
  return `${formatDmy(local.slice(0, 10))} ${local.slice(11, 16)}`;
}

/**
 * Restore the roster to a point (2026-10-16): what will change is read and
 * SHOWN first — put back, erased, left as is — and only "Pulihkan" writes.
 * The restore makes its own point first ("Sebelum pemulihan"), so it can be
 * undone the same way.
 */
export function RestoreDialog({
  floor,
  roster,
  meta,
  myName,
  onClose,
}: {
  floor: FloorDoc;
  roster: readonly RosterPatient[];
  /** The point to restore to; null = closed. */
  meta: RestorePointMeta | null;
  myName: string;
  onClose: () => void;
}): JSX.Element {
  const [point, setPoint] = useState<RestorePoint | null>(null);
  // Patients the point names that the live roster no longer holds (left over 30 days ago), read by key.
  const [older, setOlder] = useState<RosterPatient[]>([]);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPoint(null);
    setOlder([]);
    setError('');
    setDone('');
    if (!meta) return undefined;
    let live = true;
    readRestorePoint(floor.id, meta)
      .then(async (p) => {
        /*
          The live roster keeps 30 days of departures. A patient in the point
          who left before that is not missing, only out of view: without this
          read the plan called them "recreated", wrote the point's copy over
          their record, and undoing that restore deleted it (2026-10-31).
        */
        const known = new Set(roster.map((r) => r.key));
        const missing = [...new Set([...p.patients.map((r) => r.key), ...p.added])].filter((key) => !known.has(key));
        const { patients, unchecked } = missing.length ? await readRosterPatients(floor.id, missing) : { patients: [], unchecked: [] };
        if (!live) return;
        if (unchecked.length > 0) {
          setError('Belum bisa memeriksa pasien lama di titik pulih ini (butuh koneksi). Buka lagi saat online.');
          return;
        }
        setOlder(patients);
        setPoint(p);
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : 'Titik pulih tidak bisa dibaca.');
      });
    return () => {
      live = false;
    };
    // The roster is read once per opened point: its live changes reach the plan through `current`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floor.id, meta]);

  // Against the live roster: a colleague's edit while the dialog is open shows here. The roster wins over `older`.
  const current = useMemo(() => [...older, ...roster], [older, roster]);
  const plan = useMemo(() => (point ? planRestore(point, current) : null), [point, current]);

  const restore = async (): Promise<void> => {
    if (!plan || !meta) return;
    setBusy(true);
    setError('');
    const at = new Date().toISOString();
    try {
      saveRestorePoint(floor.id, pointBeforeRestore(plan, current, { label: `Sebelum pemulihan ke "${meta.label}"`, createdAt: at, createdBy: myName }));
      await applyRestore(floor.id, plan, { at, by: myName, what: `Dipulihkan ke ${meta.label} (${pointWhen(meta)})` });
      setDone(`${plan.revert.length} pasien dikembalikan, ${plan.remove.length} dihapus.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memulihkan.');
    } finally {
      setBusy(false);
    }
  };

  const back = plan?.revert.filter((r) => r.why === 'back').map((r) => r.patient) ?? [];
  const recreated = plan?.revert.filter((r) => r.why === 'recreated').map((r) => r.patient) ?? [];
  const changed = plan?.revert.filter((r) => r.why === 'changed').map((r) => r.patient) ?? [];

  return (
    <Sheet
      open={meta !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Pulihkan list"
      description={meta ? `${meta.label} · ${pointWhen(meta)} · ${meta.createdBy}` : ''}
      footer={
        done ? (
          <Button variant="primary" onClick={onClose}>
            Selesai
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => void restore()} disabled={!plan || isEmptyPlan(plan) || busy}>
              {busy ? 'Memulihkan…' : 'Pulihkan'}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Batal
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-3 text-sm">
        {error ? (
          <Callout tone="warn" title="Belum bisa">
            {error}
          </Callout>
        ) : null}
        {done ? (
          <Callout title="Dipulihkan">
            {done} Untuk membatalkan, pulihkan titik <strong>Sebelum pemulihan</strong> di tab Riwayat.
          </Callout>
        ) : !plan ? (
          error ? null : <p className="text-fg-muted">Membaca titik pulih…</p>
        ) : isEmptyPlan(plan) ? (
          <p className="font-medium">List sudah sama dengan titik ini — tidak ada yang perlu dipulihkan.</p>
        ) : (
          <>
            <p className="text-fg-muted">
              {meta?.scope === 'active'
                ? 'List dikembalikan seperti saat edisi ini disimpan. Perubahan sesudahnya pada pasien di bawah ini hilang.'
                : 'Hanya pasien yang diubah atau ditambahkan oleh tempel ini yang dikembalikan; pasien lain tidak disentuh.'}
            </p>
            <Group title="Dihapus (masuk setelah titik ini)" tone="danger" list={plan.remove} />
            <Group title="Dikembalikan seperti semula (SOAP, kamar, residen, status)" list={changed} />
            <Group title="Masuk list lagi (sudah pulang/pindah sesudahnya)" list={back} />
            <Group title="Dibuat lagi (terhapus sesudahnya)" list={recreated} />
            {plan.stuck.length > 0 ? (
              <p className="text-xs text-fg-muted">
                Tidak diubah — keluar lalu masuk lagi setelah titik ini, atur manual bila perlu: {named(plan.stuck)}
              </p>
            ) : null}
            <p className="text-xs text-fg-faint">{plan.same} pasien sudah sama.</p>
          </>
        )}
      </div>
    </Sheet>
  );
}

function Group({ title, list, tone }: { title: string; list: readonly RosterPatient[]; tone?: 'danger' }): JSX.Element | null {
  if (list.length === 0) return null;
  return (
    <div>
      <p className={`text-xs font-semibold ${tone === 'danger' ? 'text-danger' : ''}`}>
        {title} · {list.length}
      </p>
      <p className="text-xs leading-relaxed">{named(list)}</p>
    </div>
  );
}

/** The restore points, newest first, each with Pulihkan (Riwayat tab). */
export function RestorePointList({
  points,
  editable,
  onPick,
  onOpen,
}: {
  points: readonly RestorePointMeta[];
  editable: boolean;
  onPick: (meta: RestorePointMeta) => void;
  /** First opening: the points are only read from here on (2026-10-25, quota). */
  onOpen: () => void;
}): JSX.Element {
  return (
    <details
      className="rounded-xl border border-border bg-surface"
      onToggle={(e) => {
        if (e.currentTarget.open) onOpen();
      }}
    >
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold">Titik pulih{points.length > 0 ? ` (${points.length})` : ''}</summary>
      <div className="space-y-2 border-t border-border p-3">
        <p className="text-xs text-fg-muted">
          Disimpan otomatis sebelum setiap Tempel dan bersama setiap edisi. Pulihkan bila tempel memasukkan pasien yang salah.
          30 titik terakhir disimpan.
        </p>
        {points.length === 0 ? <p className="text-xs text-fg-muted">Belum ada titik pulih.</p> : null}
        <ul className="divide-y divide-border">
          {points.map((p) => (
            <li key={p.id} className="flex items-center gap-2 py-1.5 text-xs">
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{p.label}</span>
                <span className="block text-xs text-fg-muted">
                  {pointWhen(p)} · {p.createdBy} · {p.count} pasien
                </span>
              </span>
              {editable ? (
                <Button size="sm" onClick={() => onPick(p)}>
                  Pulihkan…
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
