import { isoDate } from './sections/investigationHeading';
import { parseSections } from './sections/parseSections';
import type { ClinicalDate } from './types';

/**
 * Planned labs, read from the plan of the note: `- Cek DL, SE (30/10/2026)`.
 *
 * The owner's corpus (2026-10-30): residents write the tests first and the
 * day they are due after them, in the plan. So a planned lab is a line BELOW
 * the assessment that carries a date and reads as a lab order. Above the
 * assessment a dated line is a RESULT (`*Lab (02-10-2026)*`, see
 * `penunjang`), which is why the zone starts where penunjang's ends.
 *
 * Read-only and derived: the line stays where it was written, and the board
 * only shows the ones dated today (see the "Lab hari ini" sticky).
 */
export interface LabPlan {
  date: ClinicalDate;
  /** The line as written, trimmed. Never rewritten. */
  text: string;
}

const BELOW = new Set(['a', 'p', 'terapi']);
const DATE_RE = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/;
// shortcut: keyword match, not a lab vocabulary; widen when a real plan line is missed.
const LAB_RE = /\b(?:lab|laboratorium|cek|periksa)\b/i;
const NOT_LAB_RE = /\b(?:ekg|ecg|echo|ekokardiogra\w*|thorax|thoraks|toraks|foto|rontgen|x-?ray|ct|msct|usg|cag|pci|ptca|angiografi|holter|treadmill)\b/i;
/** Keeps the patient document small whatever a plan holds. */
const MAX_PLANS = 12;

export function labPlans(body: string): LabPlan[] {
  const cutoff =
    parseSections(body).find((section) => BELOW.has(section.sectionId) && section.ownsLine)?.start ??
    body.length;
  const plans: LabPlan[] = [];
  for (const line of body.slice(cutoff).split('\n')) {
    if (!LAB_RE.test(line) || NOT_LAB_RE.test(line)) continue;
    const match = DATE_RE.exec(line);
    const date = match ? isoDate(match[1] ?? '', match[2] ?? '', match[3] ?? '') : null;
    if (date) plans.push({ date: date as ClinicalDate, text: line.trim() });
    if (plans.length === MAX_PLANS) break;
  }
  return plans;
}
