import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Callout } from '@/components/common/ui';
import { deleteSlides, slideUsage } from '@/data/slidesLocal';
import { formatSlideUsage } from '@/domain/slides/mzLink';

/**
 * Slide MZ keeps its photos on this device, so archiving a patient is when they
 * go (owner, 2026-11-12). Two uses:
 *
 *  - In an archive dialog, BEFORE archiving: says what will be deleted, with a
 *    way to download the deck first. The caller deletes after the archive.
 *  - On an already-archived patient (archived on another device): offers the
 *    same deletion here. Nothing is ever deleted in the background.
 */
export function SlideCleanupNotice({ patientIds, archived = true }: { patientIds: readonly string[]; archived?: boolean }): JSX.Element | null {
  const key = patientIds.join('|');
  const [usage, setUsage] = useState<Array<{ id: string; images: number; bytes: number }>>([]);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let live = true;
    void Promise.all(key.split('|').filter(Boolean).map(async (id) => ({ id, usage: await slideUsage(id) }))).then((list) => {
      if (live) setUsage(list.flatMap((entry) => (entry.usage ? [{ id: entry.id, ...entry.usage }] : [])));
    });
    return () => {
      live = false;
    };
  }, [key]);

  if (usage.length === 0) return null;
  const total = usage.reduce((sum, u) => ({ images: sum.images + u.images, bytes: sum.bytes + u.bytes }), { images: 0, bytes: 0 });
  const who = usage.length > 1 ? `${usage.length} pasien` : '';
  const single = usage.length === 1 ? usage[0]!.id : null;

  if (!archived) {
    return (
      <Callout
        tone="warn"
        title={`Slide MZ tersimpan di perangkat ini${who ? ` (${who})` : ''}: ${formatSlideUsage(total)}`}
        action={
          single ? (
            <Link to={`/p/${single}/slide-mz`} className="text-xs font-semibold text-accent underline">
              Unduh .pptx dulu
            </Link>
          ) : undefined
        }
      >
        Slide dan gambar akan dihapus dari perangkat ini saat pasien diarsipkan. Tidak bisa dikembalikan. Mengaktifkan kembali pasien tidak
        mengembalikan slide.
      </Callout>
    );
  }

  return (
    <Callout
      tone="warn"
      title={`Pasien ini sudah diarsipkan, tetapi Slide MZ masih tersimpan di perangkat ini: ${formatSlideUsage(total)}`}
      action={
        confirming ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                void Promise.all(usage.map((u) => deleteSlides(u.id))).then(() => setUsage([]));
              }}
            >
              Ya, hapus
            </Button>
            <Button size="sm" onClick={() => setConfirming(false)}>
              Batal
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>
            Hapus slide
          </Button>
        )
      }
    >
      Unduh dulu bila masih perlu. Penghapusan tidak bisa dikembalikan.
    </Callout>
  );
}

/**
 * Drop the archived patients' local slides, only once the archive write succeeded:
 * a refused archive leaves the patient active, and its photos must still be there.
 */
export async function deleteSlidesAfterArchive(archive: Promise<unknown>, patientIds: readonly string[]): Promise<void> {
  try {
    await archive;
  } catch {
    return;
  }
  await Promise.all(patientIds.map((id) => deleteSlides(id).catch(() => undefined)));
}
