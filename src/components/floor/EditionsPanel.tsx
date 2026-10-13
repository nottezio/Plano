import { useState } from 'react';

import { Button } from '@/components/common/ui';
import { formatDmy } from '@/domain/dateDmy';
import { wardPlan } from '@/domain/denahPlan';
import { buildDenahDocx, buildListDocx, DOCX_MIME, floorFileName } from '@/domain/floorList/docx';
import { localOf, type Edition, type FloorDoc } from '@/domain/floorList/floor';
import { deleteEdition } from '@/data/repositories/floors.repo';
import { copyText } from '@/lib/clipboard';
import { deliverFile } from '@/lib/download';

/**
 * Riwayat (12.12): the lists as they were sent — 04.00, 16.00 for the shift
 * resident, 19.00 or any time typed. Each keeps its message and the roster
 * as it stood, so its Word files are the ones that went out, not today's.
 */
export function EditionsPanel({ floor, editions, editable = false }: { floor: FloorDoc; editions: readonly Edition[]; editable?: boolean }): JSX.Element {
  const [openId, setOpenId] = useState<string | null>(editions[0]?.id ?? null);
  const [copied, setCopied] = useState(false);
  const [asking, setAsking] = useState(false);
  const open = editions.find((e) => e.id === openId) ?? editions[0] ?? null;

  if (editions.length === 0) {
    return <p className="text-sm text-fg-muted">Belum ada edisi. Di tab List, isi jam lalu tekan Simpan edisi.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <ul className="space-y-1">
        {editions.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => {
                setOpenId(e.id);
                setCopied(false);
                setAsking(false);
              }}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${e.id === open?.id ? 'border-accent bg-[var(--accent-soft)]' : 'border-border bg-surface'}`}
            >
              <span className="font-semibold">
                {formatDmy(e.date)} · {e.time}
              </span>
              <span className="block text-[11px] text-fg-muted">
                {e.patients.length} pasien · {e.createdBy}
                {e.createdAt ? ` · disimpan ${localOf(e.createdAt).slice(11, 16)}` : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {open ? (
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void copyText(open.text).then(setCopied)}>
              {copied ? 'Tersalin' : 'Salin'}
            </Button>
            <Button
              size="sm"
              onClick={() =>
                void deliverFile(new Blob([buildListDocx(open.text)], { type: DOCX_MIME }), floorFileName('List Pasien', floor.ward, `${open.date} ${open.time}`))
              }
            >
              Word: List
            </Button>
            <Button
              size="sm"
              onClick={() =>
                void deliverFile(
                  new Blob([buildDenahDocx({ ward: floor.ward, date: open.date, plan: wardPlan(floor.ward), patients: open.patients })], { type: DOCX_MIME }),
                  floorFileName('Denah', floor.ward, `${open.date} ${open.time}`),
                )
              }
            >
              Word: Denah
            </Button>
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
                <button type="button" onClick={() => setAsking(true)} className="h-7 rounded px-1.5 text-[11px] text-fg-faint hover:text-danger hover:underline">
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
  );
}
