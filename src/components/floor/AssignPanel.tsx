import { useMemo, useState } from 'react';

import { Button, Callout, INPUT } from '@/components/common/ui';
import { writeRosterBatch, type RosterChange } from '@/data/repositories/floors.repo';
import { assignGroup, loadsWith, needsHolder, proposeAssignment, type Load } from '@/domain/floorList/assign';
import { byRoute, dpjpCodeOf } from '@/domain/floorList/build';
import { chiefsOf, type FloorDoc } from '@/domain/floorList/floor';
import type { FloorPatient } from '@/domain/floorList/report';

const GROUP_LABEL = { mz: 'MZ', trio: 'Trio', lain: '' } as const;

/**
 * Bagi pasien (10 Nov 2026, Avi): the patients no floor resident holds,
 * proposed to the floor residents by `proposeAssignment` (MZ, then Trio, then
 * total load). Each row can be changed or skipped; nothing is written until
 * Terapkan, which sets the junior on those patients only.
 *
 * Firestore: no read (the roster is already loaded); Terapkan = one write per
 * patient given out, in one batch.
 */
export function AssignPanel({
  floor,
  active,
  editable,
  myName,
  onOpen,
}: {
  floor: FloorDoc;
  active: readonly FloorPatient[];
  editable: boolean;
  myName: string;
  onOpen: (patient: FloorPatient) => void;
}): JSX.Element {
  const residentsKey = floor.juniors;
  const residents = useMemo(() => chiefsOf(residentsKey), [residentsKey]);
  const sorted = useMemo(() => [...active].sort(byRoute(floor.ward)), [active, floor.ward]);
  // Residents left out of the share (11 Nov 2026, Avi: the list maker usually takes the fewest). Not saved: set per sitting.
  const [skip, setSkip] = useState<ReadonlySet<string>>(new Set());
  const proposal = useMemo(() => proposeAssignment(sorted, residents, skip), [sorted, residents, skip]);
  // Hand changes per patient key; '' = skip this patient for now.
  const [changed, setChanged] = useState<Record<string, string>>({});
  const [done, setDone] = useState('');
  // Every patient needing a holder, even with everyone left out (then all read "lewati").
  const open = useMemo(() => sorted.filter((p) => needsHolder(p, residents)), [sorted, residents]);
  const chosen = useMemo(() => {
    const out = new Map<string, string>();
    for (const { key } of open) {
      const pick = changed[key] ?? proposal.get(key);
      if (pick) out.set(key, pick);
    }
    return out;
  }, [open, proposal, changed]);
  const loads = loadsWith(sorted, residents, chosen);

  const apply = (): void => {
    const at = new Date().toISOString();
    const changes: RosterChange[] = open.flatMap((p) => {
      const to = chosen.get(p.key);
      return to ? [{ kind: 'fields' as const, key: p.key, fields: { junior: to }, log: { at, by: myName, what: `Bagi pasien: junior dr. ${to}` } }] : [];
    });
    if (changes.length === 0) return;
    // Not awaited: offline the batch resolves only when the server confirms; the cache shows it at once.
    void writeRosterBatch(floor.id, changes);
    setChanged({});
    setDone(`${changes.length} pasien dibagi.`);
  };

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="flex-1 text-sm font-semibold">Bagi pasien ke residen lantai</h3>
        <span className="text-xs text-fg-muted">{open.length} pasien belum dipegang residen lantai</span>
      </div>
      <p className="text-xs text-fg-muted">
        Hanya pasien tanpa junior, atau yang junior-nya bukan residen lantai (mis. jaga malam). Pasien yang sudah dipegang residen lantai, pasien
        divisi, dan pasien “tidak di-follow up” tidak disentuh. Urutan: MZ dulu (satu per residen), lalu Trio (AFM, AFG, ZD) merata, lalu sisanya ke
        yang pasiennya paling sedikit.
      </p>

      {residents.length === 0 ? (
        <Callout tone="info">Isi dulu Residen lantai di tab Setelan.</Callout>
      ) : (
        <div role="group" aria-label="Residen yang ikut dibagi" className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-fg-muted">Ikut dibagi:</span>
          {residents.map((r) => {
            const on = !skip.has(r);
            return (
              <button
                key={r}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setSkip((s) => {
                    const next = new Set(s);
                    if (on) next.add(r);
                    else next.delete(r);
                    return next;
                  });
                  setChanged({});
                }}
                className={`min-h-8 rounded-full border px-2.5 font-semibold ${on ? 'border-accent bg-accent text-on-accent' : 'border-border text-fg-muted line-through'}`}
              >
                dr. {r}
              </button>
            );
          })}
        </div>
      )}

      {residents.length === 0 ? null : open.length === 0 ? (
        <p className="text-xs text-fg-muted">{done || 'Semua pasien sudah dipegang residen lantai.'}</p>
      ) : (
        <>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {open.map((p) => {
              const group = GROUP_LABEL[assignGroup(p)];
              const code = dpjpCodeOf(p);
              return (
                <li key={p.key} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <button type="button" onClick={() => onOpen(p)} className="min-w-0 flex-1 text-left text-xs">
                    <span className="mr-1 inline-block rounded bg-bg-subtle px-1.5 font-semibold tabular-nums">
                      {p.room || '—'}
                      {p.bed ? `/${p.bed}` : ''}
                    </span>
                    {code ? <span className="mr-1 inline-block rounded border border-border px-1 text-[11px] font-semibold text-fg-muted">{code}</span> : null}
                    {group ? <span className="mr-1 inline-block rounded-full bg-[var(--accent-soft)] px-1.5 text-[11px] font-semibold text-accent">{group}</span> : null}
                    <span className="font-semibold">{p.name || p.identity}</span>
                    <span className="block text-fg-muted">{p.junior ? `sekarang dr. ${p.junior} (bukan residen lantai)` : 'belum ada junior'}</span>
                  </button>
                  {editable ? (
                    <select
                      value={changed[p.key] ?? proposal.get(p.key) ?? ''}
                      onChange={(e) => setChanged((c) => ({ ...c, [p.key]: e.target.value }))}
                      aria-label={`Residen untuk ${p.name || p.identity}`}
                      className={`${INPUT} !w-36 text-xs`}
                    >
                      {residents.map((r) => (
                        <option key={r} value={r}>
                          dr. {r}
                        </option>
                      ))}
                      <option value="">— lewati —</option>
                    </select>
                  ) : (
                    <span className="text-xs font-semibold">{proposal.get(p.key) ? `dr. ${proposal.get(p.key)}` : '—'}</span>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-fg-muted">
                <tr>
                  <th className="py-1 pr-2 text-left font-medium">Residen</th>
                  <th className="px-2 py-1 text-right font-medium">Total</th>
                  <th className="px-2 py-1 text-right font-medium">MZ</th>
                  <th className="py-1 pl-2 text-right font-medium">Trio</th>
                </tr>
              </thead>
              <tbody>
                {loads.map((l) => (
                  <tr key={l.name} className="border-t border-border">
                    <td className="py-1 pr-2">dr. {l.name}</td>
                    <Cell before={l.before} after={l.after} k="total" />
                    <Cell before={l.before} after={l.after} k="mz" />
                    <Cell before={l.before} after={l.after} k="trio" last />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editable ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={apply} disabled={chosen.size === 0}>
                Terapkan ({chosen.size})
              </Button>
              {Object.keys(changed).length > 0 ? (
                <Button variant="ghost" onClick={() => setChanged({})}>
                  Kembali ke usulan
                </Button>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function Cell({ before, after, k, last = false }: { before: Load; after: Load; k: keyof Load; last?: boolean }): JSX.Element {
  const grew = after[k] > before[k];
  return (
    <td className={`py-1 text-right tabular-nums ${last ? 'pl-2' : 'px-2'}`}>
      {grew ? (
        <>
          <span className="text-fg-muted">{before[k]} → </span>
          <strong>{after[k]}</strong>
        </>
      ) : (
        after[k]
      )}
    </td>
  );
}
