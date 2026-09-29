import { create } from 'zustand';

/**
 * What Plano last put on the clipboard, and whose it was.
 *
 * The mistake this exists for: switching between SIMGOS and Plano a dozen
 * times, and pasting the SOAP of the patient you were on a moment ago into
 * the chart of the one you are on now. The paste looks right; nothing flags
 * it afterwards. So the app keeps saying what it last copied, and shows it in
 * warning colours when a different patient is open.
 *
 * It is what PLANO copied, not a reading of the clipboard (browsers do not
 * allow that without a permission prompt): something copied in another app
 * afterwards is not known here, which the label says ("Terakhir disalin").
 */
export interface CopiedNote {
  /** What was copied: "SOAP harian", "Nomor RM", … */
  what: string;
  patientId: string | null;
  patientName: string;
  mrn: string | null;
  at: number;
}

interface ClipboardNoteState {
  last: CopiedNote | null;
  /** The patient whose page is open, to tell a mismatch. */
  openPatientId: string | null;
  remember: (note: Omit<CopiedNote, 'at'>) => void;
  dismiss: () => void;
  setOpenPatient: (id: string | null) => void;
}

const KEY = 'plano.clipboard.last';

function read(): CopiedNote | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CopiedNote) : null;
  } catch {
    return null;
  }
}

function write(note: CopiedNote | null): void {
  try {
    if (note) sessionStorage.setItem(KEY, JSON.stringify(note));
    else sessionStorage.removeItem(KEY);
  } catch {
    // Kept in memory only.
  }
}

export const useClipboardNote = create<ClipboardNoteState>((set) => ({
  last: read(),
  openPatientId: null,
  remember: (note) => {
    const next = { ...note, at: Date.now() };
    write(next);
    set({ last: next });
  },
  dismiss: () => {
    write(null);
    set({ last: null });
  },
  setOpenPatient: (id) => set({ openPatientId: id }),
}));

/** True when the last copy belongs to a different patient than the open one. */
export function isMismatch(last: CopiedNote | null, openPatientId: string | null): boolean {
  return Boolean(last?.patientId && openPatientId && last.patientId !== openPatientId);
}
