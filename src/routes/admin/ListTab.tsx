import { useEffect, useState } from 'react';

import { adminListFloors } from '@/data/repositories/floors.repo';
import { ago } from './adminUi';

type Floors = Awaited<ReturnType<typeof adminListFloors>>;

/**
 * List: the List Maker floors people made, with their owner and members.
 *
 * The floor documents only (name, ward, owner, members and roles). Rosters and
 * sent lists hold patients and are not shown here. Loaded once when the tab
 * opens, with a reload button: no listener, so an open tab costs nothing more.
 * One read per floor per load.
 */
export function ListTab({ onError }: { onError: (message: string) => void }): JSX.Element {
  const [floors, setFloors] = useState<Floors | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const now = Date.now();

  useEffect(() => {
    let live = true;
    setFloors(null);
    setFailed(false);
    adminListFloors()
      .then((result) => {
        if (live) setFloors(result);
      })
      .catch((cause: unknown) => {
        console.error('[admin] floors', cause);
        if (!live) return;
        setFailed(true);
        onError('Tidak dapat membaca list. Jika aturan Firestore baru belum ter-deploy, tunggu workflow firestore-deploy selesai.');
      });
    return () => {
      live = false;
    };
  }, [attempt, onError]);

  const members = (floors ?? []).reduce((sum, entry) => sum + entry.floor.memberIds.length, 0);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-sm font-semibold">
          List yang dibuat{' '}
          <span className="font-normal text-fg-muted">
            {floors ? `${floors.length} list · ${members} keanggotaan` : '…'}
          </span>
        </h2>
        <button
          type="button"
          onClick={() => setAttempt((count) => count + 1)}
          disabled={floors === null && !failed}
          className="min-h-tap rounded-lg border border-border px-3 text-xs font-medium disabled:opacity-60 [@media(pointer:fine)]:min-h-8"
        >
          {failed ? 'Coba lagi' : 'Muat ulang'}
        </button>
      </div>

      {floors === null && !failed ? <p className="text-xs text-fg-muted">Memuat…</p> : null}
      {floors !== null && floors.length === 0 && !failed ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-fg-muted">
          Belum ada list.
        </p>
      ) : null}

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {(floors ?? []).map(({ floor, updatedAt }) => (
          <FloorRow key={floor.id} floor={floor} updatedAt={updatedAt} now={now} />
        ))}
      </ul>
      <p className="text-xs text-fg-faint">
        Hanya pengaturan list. Isi roster dan list terkirim tidak ditampilkan di sini.
      </p>
    </section>
  );
}

function FloorRow({
  floor,
  updatedAt,
  now,
}: {
  floor: Floors[number]['floor'];
  updatedAt: Date | null;
  now: number;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const owner = floor.names[floor.ownerUid] ?? '—';
  const invites = floor.inviteEmails.length;

  return (
    <li className="p-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="block w-full text-left"
      >
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{floor.name}</span>
          {floor.ward ? (
            <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-fg-muted">
              {floor.ward}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-fg-muted">
          <span>pemilik {owner}</span>
          <span>· {floor.memberIds.length} anggota</span>
          {invites > 0 ? <span>· {invites} undangan menunggu</span> : null}
          <span>· diubah {ago(updatedAt, now)}</span>
        </span>
      </button>
      {open ? (
        <ul className="ml-1 mt-2 space-y-1 text-xs">
          {floor.memberIds.map((id) => (
            <li key={id} className="flex items-baseline gap-2">
              <span className="min-w-0 truncate">{floor.names[id] ?? `${id.slice(0, 6)}…`}</span>
              <span className="shrink-0 text-fg-muted">
                {id === floor.ownerUid ? 'Pemilik' : floor.roles[id] === 'edit' ? 'Edit' : 'Lihat'}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
