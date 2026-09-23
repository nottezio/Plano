import type { Issue, VerificationReport } from './verifier';

/**
 * Stage 6's memory, and the confirmation loop (spec §6, §7.6).
 *
 * The verifier is a pure function of this run's documents plus "what did the
 * last run find". That second input has to live somewhere between shifts, and
 * the original left it to the caller; this is the caller's half.
 *
 * WHAT IS KEPT
 *   - the last run's issues, so the next run can say resolved / persisting / new;
 *   - the RMs on the ward and their names, so a patient who vanishes is named;
 *   - the user's answers to 🟡 items.
 *
 * ANSWERS CLOSE ONLY 🟡 ITEMS. The spec gives confirmation buttons to "needs
 * confirmation" items. If "intentional" could close a count mismatch, the next
 * shift's genuinely wrong count — same rule, same DPJP, same id — would be
 * hidden by yesterday's answer. A count is either right or wrong, and the
 * documents say which.
 */

export type Resolution = 'confirmedDischarge' | 'intentional' | 'fixed';

export const RESOLUTION_LABEL: Record<Resolution, string> = {
  confirmedDischarge: 'Sudah pulang / pindah',
  intentional: 'Memang disengaja',
  fixed: 'Salah ketik, sudah diperbaiki',
};

export interface CensusHistory {
  shiftDate: string | null;
  /** The last run's OPEN issues — the baseline Stage 6 diffs against. */
  issues: Issue[];
  /**
   * RMs treated as on the ward for O5: this run's room grid, plus any patient
   * who vanished earlier and has not been confirmed gone. The spec's "keep
   * carrying it forward until user confirms".
   */
  activeRms: string[];
  names: Record<string, string>;
  resolutions: Record<string, Resolution>;
}

export const HISTORY_KEY = 'visite.census.history';

export function parseHistory(raw: string | null): CensusHistory | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<CensusHistory>;
    if (!Array.isArray(value.issues) || !Array.isArray(value.activeRms)) return null;
    return {
      shiftDate: typeof value.shiftDate === 'string' ? value.shiftDate : null,
      issues: value.issues,
      activeRms: value.activeRms.filter((rm): rm is string => typeof rm === 'string'),
      names: value.names && typeof value.names === 'object' ? value.names : {},
      resolutions: value.resolutions && typeof value.resolutions === 'object' ? value.resolutions : {},
    };
  } catch {
    // A corrupt history costs one diff, not the verifier.
    return null;
  }
}

/** The report as the user sees it: open issues, and those they have answered. */
export function applyResolutions(
  report: VerificationReport,
  resolutions: Record<string, Resolution>,
): { open: Issue[]; answered: Array<Issue & { resolution: Resolution }>; verdict: VerificationReport['verdict'] } {
  const open: Issue[] = [];
  const answered: Array<Issue & { resolution: Resolution }> = [];
  for (const issue of report.issues) {
    const resolution = resolutions[issue.id];
    if (resolution && issue.severity === 'confirm') answered.push({ ...issue, resolution });
    else open.push(issue);
  }
  // PARTIAL stays PARTIAL: an answer cannot supply a missing document.
  const verdict =
    report.verdict === 'PARTIAL' ? 'PARTIAL' : open.length === 0 ? 'CLEAN' : 'NOT_CLEAN';
  return { open, answered, verdict };
}

/**
 * What to remember after a run.
 *
 * `issues` is the OPEN set, so an answered item does not reappear as
 * "resolved since last run" merely because it was answered. A vanished
 * patient stays in `activeRms` until confirmed gone.
 */
export function nextHistory(input: {
  report: VerificationReport;
  roomGrid: Array<{ rm: string | null; name: string }>;
  previous: CensusHistory | null;
  resolutions: Record<string, Resolution>;
}): CensusHistory {
  const { report, roomGrid, previous, resolutions } = input;
  const names: Record<string, string> = { ...(previous?.names ?? {}) };
  const active = new Set<string>();
  for (const patient of roomGrid) {
    if (!patient.rm) continue;
    active.add(patient.rm);
    names[patient.rm] = patient.name;
  }

  for (const issue of report.issues) {
    if (issue.ruleId !== 'O5') continue;
    const rm = issue.id.split(':')[1];
    if (!rm) continue;
    if (resolutions[issue.id] === 'confirmedDischarge') continue;
    active.add(rm); // Carried forward: still unconfirmed.
  }

  const { open } = applyResolutions(report, resolutions);
  return {
    shiftDate: report.shiftDate,
    issues: open,
    activeRms: [...active],
    names,
    // Only answers to issues that still exist are worth keeping.
    resolutions: Object.fromEntries(
      Object.entries(resolutions).filter(([id]) => report.issues.some((issue) => issue.id === id)),
    ),
  };
}
