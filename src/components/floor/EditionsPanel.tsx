import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/common/ui';
import { formatDmy } from '@/domain/dateDmy';
import { wardPlan } from '@/domain/denahPlan';
import { EDITIONS_PAGE, groupByDay } from '@/domain/floorList/editionGroups';
import { localOf, type Edition, type FloorDoc, type RosterPatient } from '@/domain/floorList/floor';
import type { RestorePointMeta } from '@/domain/floorList/restore';
import { deleteEdition, readEditionPoint, readOlderEditions } from '@/data/repositories/floors.repo';
import { copyText } from '@/lib/clipboard';
import { useRestorePoints } from '@/hooks/useFloor';
import { usePrintSettings } from '@/hooks/usePrintSettings';
import { RestoreDialog, RestorePointList } from './RestoreDialog';
import { exportDenah, exportList, PrintSetup } from './PrintSetup';

/**
 * Riwayat (12.12): the lists as they were sent — 04.00, 16.00 for the shift
 * resident, 19.00 or any time typed. Each keeps its message and the roster
 * as it stood, so its Word files are the ones that went out, not today's.
 */
export function EditionsPanel({
  floor,
  editions,
  editable = false,
  roster = [],
  myName = '',
}: {
  floor: FloorDoc;
  editions: readonly Edition[];
  editable?: boolean;
  /** For restoring (2026-10-16). */
  roster?: readonly RosterPatient[];
  myName?: string;
}): JSX.Element {
  const [openId, setOpenId] = useState<string | null>(editions[0]?.id ?? null);
  const [restoring, setRestoring] = useState<RestorePointMeta | null>(null);
  const printSettings = usePrintSettings();
  const [setupOpen, setSetupOpen] = useState(false);
  const restoreDialog = <RestoreDialog floor={floor} roster={roster} meta={restoring} myName={myName} onClose={() => setRestoring(null)} />;
  const [copied, setCopied] = useState(false);
  const [asking, setAsking] = useState(false);
  /*
    Older pages (2026-10-25): `editions` is the live newest page; older ones are
    read once on demand and dropped when a new edition arrives, so the pages
    never leave a gap behind the live window.
  */
  const [older, setOlder] = useState<Edition[]>([]);
  const [exhausted, setExhausted] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const newestId = editions[0]?.id;
  useEffect(() => {
    setOlder([]);
    setExhausted(false);
  }, [newestId]);
  const all = useMemo(() => {
    const live = new Set(editions.map((e) => e.id));
    return [...editions, ...older.filter((e) => !live.has(e.id))];
  }, [editions, older]);
  const days = useMemo(() => groupByDay(all), [all]);
  // The newest day starts open, the rest shut; a tap on a day header flips it.
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(new Set());
  const flip = (date: string): void =>
    setFlipped((prev) => {
      const next = new Set(prev);
      if (!next.delete(date)) next.add(date);
      return next;
    });
  const canMore = !exhausted && editions.length >= EDITIONS_PAGE;
  const loadMore = (): void => {
    const oldest = all[all.length - 1];
    if (!oldest || loadingMore) return;
    setLoadingMore(true);
    setFailed(false);
    readOlderEditions(floor.id, oldest.createdAt, EDITIONS_PAGE)
      .then((page) => {
        setOlder((prev) => [...prev, ...page]);
        if (page.length < EDITIONS_PAGE) setExhausted(true);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoadingMore(false));
  };
  const open = all.find((e) => e.id === openId) ?? all[0] ?? null;

  // Points are read only once "Titik pulih" is opened (an edit member), not on every visit to Riwayat (2026-10-25, quota).
  const [pointsOpened, setPointsOpened] = useState(false);
  const points = useRestorePoints(pointsOpened && editable ? floor.id : null);
  // "Pulihkan list ke edisi ini": the open edition's point is looked up on tap, one read.
  const [pointNote, setPointNote] = useState('');
  const restoreOpen = (): void => {
    if (!open) return;
    setPointNote('');
    const known = points.find((p) => p.editionId === open.id);
    if (known) {
      setRestoring(known);
      return;
    }
    readEditionPoint(floor.id, open.id)
      .then((p) => (p ? setRestoring(p) : setPointNote('Edisi ini tidak punya titik pulih.')))
      .catch(() => setPointNote('Belum bisa membaca titik pulih. Coba lagi saat online.'));
  };
  const pointList = <RestorePointList points={points} editable={editable} onPick={setRestoring} onOpen={() => setPointsOpened(true)} />;
  if (editions.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-fg-muted">Belum ada edisi. Di tab List, isi jam lalu tekan Simpan edisi.</p>
        {pointList}
        {restoreDialog}
      </div>
    );
  }
  // The edition as it was sent, printed with this device's setup (2026-10-16).
  const printInput = open ? { ward: floor.ward, date: open.date, plan: wardPlan(floor.ward), patients: open.patients, listText: open.text } : null;
  const stamp = open ? `${open.date} ${open.time}` : '';

  return (
    <div className="space-y-3">
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div className="space-y-1 lg:max-h-[70dvh] lg:overflow-y-auto">
        {days.map((day, i) => {
          const shown = (i === 0) !== flipped.has(day.date);
          return (
            <section key={day.date}>
              <button
                type="button"
                aria-expanded={shown}
                onClick={() => flip(day.date)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-fg-muted hover:bg-bg-subtle"
              >
                <span>{formatDmy(day.date)}</span>
                <span>
                  {day.editions.length} edisi {shown ? '▾' : '▸'}
                </span>
              </button>
              {shown ? (
                <ul className="space-y-1">
                  {day.editions.map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenId(e.id);
                          setPointNote('');
                          setCopied(false);
                          setAsking(false);
                        }}
                        className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${e.id === open?.id ? 'border-accent bg-[var(--accent-soft)]' : 'border-border bg-surface'}`}
                      >
                        <span className="font-semibold">{e.time}</span>
                        <span className="block text-xs text-fg-muted">
                          {e.patients.length} pasien · {e.createdBy}
                          {e.createdAt ? ` · disimpan ${localOf(e.createdAt).slice(11, 16)}` : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          );
        })}
        {canMore ? (
          <Button size="sm" variant="ghost" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Memuat…' : 'Muat edisi lebih lama'}
          </Button>
        ) : null}
        {failed ? <p className="text-xs text-danger">Belum bisa memuat edisi lama. Coba lagi saat online.</p> : null}
      </div>
      {open ? (
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void copyText(open.text).then(setCopied)}>
              {copied ? 'Tersalin' : 'Salin'}
            </Button>
            <Button size="sm" onClick={() => printInput && exportList(printInput, printSettings, stamp)}>
              Word: List
            </Button>
            <Button size="sm" onClick={() => printInput && exportDenah(printInput, printSettings, stamp)}>
              Word: Denah
            </Button>
            <Button size="sm" onClick={() => setSetupOpen(true)}>
              Atur cetak…
            </Button>
            {printInput ? <PrintSetup open={setupOpen} onOpenChange={setSetupOpen} input={printInput} stamp={stamp} /> : null}
            {editable ? (
              // The roster as it stood with this list (2026-10-16): undo a mis-import.
              <Button size="sm" onClick={restoreOpen}>
                Pulihkan list ke edisi ini…
              </Button>
            ) : null}
            {pointNote ? <span className="self-center text-xs text-fg-muted">{pointNote}</span> : null}
            {editable ? (
              // A list saved twice, or by mistake (13.14). Two taps; the roster is not touched.
              asking ? (
                <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
                  Hapus edisi {formatDmy(open.date)} {open.time}?
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      setAsking(false);
                      // A loaded older page is not live, so drop it here.
                      setOlder((prev) => prev.filter((e) => e.id !== open.id));
                      void deleteEdition(floor.id, open.id);
                    }}
                  >
                    Ya, hapus
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>
                    Batal
                  </Button>
                </span>
              ) : (
                <button type="button" onClick={() => setAsking(true)} className="h-7 rounded px-1.5 text-xs text-fg-faint hover:text-danger hover:underline">
                  Hapus edisi
                </button>
              )
            ) : null}
          </div>
          <pre className="max-h-[70dvh] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-bg-subtle p-3 font-sans text-xs leading-relaxed">
            {open.text}
          </pre>
        </div>
      ) : null}
    </div>
    {pointList}
    {restoreDialog}
    </div>
  );
}
