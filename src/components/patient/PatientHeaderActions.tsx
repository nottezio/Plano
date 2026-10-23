import { SyncPill } from '@/components/common/SyncPill';
import { IconCalculator, IconColumns, IconMore } from '@/components/common/Icons';
import { Button } from '@/components/common/ui';

/**
 * The right-hand side of the patient page's sticky header (split out of
 * PatientPage, 2026-10-23).
 *
 * THE ROW'S COST IS FIXED. Below `sm` it keeps only what is irreducible: Salin,
 * the sync dot and ⋯. Lab, Format bangsal, Pembuka, the calculator and Compare
 * appear from `sm` up and are also listed in the ⋯ sheet, so nothing becomes
 * unreachable at any width. On a 360 px phone the full row came to more than
 * the screen before the title got a pixel, and ran off the right edge.
 */
export function PatientHeaderActions({
  locked,
  noteEmpty,
  calcOpen,
  paneOpen,
  onLab,
  onReformat,
  onOpening,
  onToggleCalc,
  onCopy,
  onTogglePane,
  onCompare,
  onActions,
}: {
  locked: boolean;
  noteEmpty: boolean;
  calcOpen: boolean;
  paneOpen: boolean;
  onLab: () => void;
  onReformat: () => void;
  onOpening: () => void;
  onToggleCalc: () => void;
  onCopy: () => void;
  onTogglePane: () => void;
  onCompare: () => void;
  onActions: () => void;
}): JSX.Element {
  return (
    <>
      {!locked ? (
        <>
          <Button size="sm" className="hidden shrink-0 sm:inline-flex" onClick={onLab}>
            Lab
          </Button>
          {/* Moved up from the "Tersimpan" status row: a transform that rewrites
              the whole note belongs with the other things you do TO a note. */}
          <Button size="sm" className="hidden shrink-0 sm:inline-flex" onClick={onReformat}>
            Format bangsal
          </Button>
          <Button size="sm" className="hidden shrink-0 sm:inline-flex" onClick={onOpening} disabled={noteEmpty}>
            Pembuka
          </Button>
        </>
      ) : null}
      <Button
        size="icon"
        variant={calcOpen ? 'ghost' : 'quiet'}
        onClick={onToggleCalc}
        aria-label={calcOpen ? 'Tutup kalkulator' : 'Buka kalkulator'}
        aria-pressed={calcOpen}
        title="Kalkulator melayang"
        className={`hidden shrink-0 sm:inline-flex ${calcOpen ? 'bg-[var(--accent-soft)]' : ''}`}
      >
        <IconCalculator width={18} height={18} />
      </Button>
      {/* The shell's title bar is off on this screen (it repeated the name), so
          its sync state moves here. Desktop has it in the sidebar. */}
      <span className="lg:hidden">
        <SyncPill dot />
      </span>
      <Button size="sm" variant="primary" className="shrink-0" onClick={onCopy}>
        Salin
      </Button>
      <Button
        size="icon"
        variant="quiet"
        onClick={onTogglePane}
        aria-label={paneOpen ? 'Sembunyikan panel samping' : 'Tampilkan panel samping'}
        aria-expanded={paneOpen}
        className="hidden shrink-0 xl:inline-flex"
      >
        <span aria-hidden="true">{paneOpen ? '⇥' : '⇤'}</span>
      </Button>
      <Button
        size="icon"
        variant="quiet"
        onClick={onCompare}
        aria-label="Bandingkan catatan atau revisi"
        title="Bandingkan catatan atau revisi"
        className="hidden shrink-0 sm:inline-flex"
      >
        <IconColumns width={18} height={18} />
      </Button>
      <Button size="icon" variant="quiet" onClick={onActions} aria-label="Tindakan pasien" className="shrink-0">
        <IconMore width={20} height={20} />
      </Button>
    </>
  );
}
