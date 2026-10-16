import type { FloorDoc, RosterPatient } from '@/domain/floorList/floor';
import { IconClose } from '@/components/common/Icons';
import { PastePanel } from './PastePanel';

/**
 * Tempel as a floating box over the List tab (2026-10-16, Avi: "add a tempel
 * button that opens a floating box for pasting a WhatsApp message").
 *
 * Not a modal: the list stays readable and live behind it, so what a paste
 * changed shows in the list the moment it is saved, and the box stays open
 * for the next message. The same panel as the Tempel tab — one paste flow,
 * with its review and its undo.
 */
export function PasteFloat({
  floor,
  roster,
  myName,
  onClose,
}: {
  floor: FloorDoc;
  roster: readonly RosterPatient[];
  myName: string;
  onClose: () => void;
}): JSX.Element {
  return (
    <section
      role="dialog"
      aria-label="Tempel pesan WhatsApp"
      className="fixed inset-x-0 bottom-0 z-40 flex max-h-[85dvh] flex-col rounded-t-2xl border border-border bg-surface shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:max-h-[min(80dvh,46rem)] sm:w-[30rem] sm:rounded-2xl"
    >
      <header className="flex items-center gap-2 border-b border-border px-3 py-1.5">
        <h2 className="flex-1 text-sm font-semibold">Tempel pesan WhatsApp</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup Tempel"
          className="flex min-h-tap min-w-tap items-center justify-center rounded-lg text-fg-muted hover:bg-bg-subtle hover:text-fg [@media(pointer:fine)]:min-h-9 [@media(pointer:fine)]:min-w-9"
        >
          <IconClose width={18} height={18} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <PastePanel floor={floor} roster={roster} myName={myName} />
      </div>
    </section>
  );
}
