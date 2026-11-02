/**
 * First-time guides (Panduan), 2 Nov 2026: a short paged walkthrough per page,
 * shown once per device and reopened from a "Panduan" button. Plain data so
 * the steps are testable; `PageGuide` renders them.
 */

export interface GuideStep {
  id: string;
  title: string;
  /** One short line on what this part is for. */
  lead: string;
  /** What to do, in order; **bold** marks a button or tab name. */
  points: string[];
}

/** Split "Ketuk **Baca**." into plain and bold runs, for rendering without HTML. */
export function boldRuns(text: string): { text: string; bold: boolean }[] {
  return text
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((part) => (part.startsWith('**') && part.endsWith('**') ? { text: part.slice(2, -2), bold: true } : { text: part, bold: false }));
}

/** Per device: once dismissed (Selesai, Lewati or ✕), a guide does not open by itself again. */
export function readGuideSeen(storage: Pick<Storage, 'getItem'> | undefined, key: string): boolean {
  try {
    return storage?.getItem(key) === '1';
  } catch {
    // A private window: treat as seen, so it does not reopen on every visit.
    return true;
  }
}

export function writeGuideSeen(storage: Pick<Storage, 'setItem'> | undefined, key: string): void {
  try {
    storage?.setItem(key, '1');
  } catch {
    // Not remembered; it will open once more next time.
  }
}
