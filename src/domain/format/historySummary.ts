export interface HistoryEntry {
  date: string;
  body: string;
}

export interface HistorySelection {
  /** What is sent, oldest first. */
  included: HistoryEntry[];
  /** Dates left out, so the summary can say so rather than imply completeness. */
  omitted: string[];
}

/**
 * Choose which days of a stay to send.
 *
 * A three-week admission is far more text than one request can carry, so
 * something has to be dropped — and WHICH is the whole decision.
 *
 * The admission note is kept whatever else goes. It carries the identity, the
 * referral, the presenting problem and the first assessment; a summary built
 * without it has to infer why the patient is in hospital from a middle-of-stay
 * note that assumes everyone already knows.
 *
 * The most recent days are kept next, because "keluhan sekarang" and the
 * current plan can only come from them.
 *
 * The MIDDLE is what goes. Its content is largely carried forward into the
 * days either side, and a gap there costs a detail; a gap at either end costs
 * the shape of the story.
 *
 * The dates dropped are reported rather than hidden. A summary that silently
 * skipped a week is one nobody can trust, and the person presenting it needs
 * to know which days they are answering for.
 */
export function selectHistory(
  entries: readonly HistoryEntry[],
  budget = 60_000,
): HistorySelection {
  const usable = entries
    .filter((entry) => entry.body.trim().length > 0)
    .sort((left, right) => left.date.localeCompare(right.date));

  if (usable.length === 0) return { included: [], omitted: [] };

  const cost = (entry: HistoryEntry): number => entry.body.length + 40;
  const total = usable.reduce((sum, entry) => sum + cost(entry), 0);
  if (total <= budget) return { included: [...usable], omitted: [] };

  const first = usable[0] as HistoryEntry;
  const chosen = new Set<HistoryEntry>([first]);
  let used = cost(first);

  // Walk backwards from today. The newest day is the one a summary cannot do
  // without, so it is taken first and the budget runs out at the older end.
  for (let index = usable.length - 1; index > 0; index -= 1) {
    const entry = usable[index] as HistoryEntry;
    if (used + cost(entry) > budget) break;
    chosen.add(entry);
    used += cost(entry);
  }

  return {
    included: usable.filter((entry) => chosen.has(entry)),
    omitted: usable.filter((entry) => !chosen.has(entry)).map((entry) => entry.date),
  };
}

/** The transcript sent to the model, oldest first, each day labelled. */
export function formatHistory(selection: HistorySelection): string {
  const parts = selection.included.map((entry) => `### ${entry.date}\n${entry.body.trim()}`);
  if (selection.omitted.length > 0) {
    // Named where the model will read it, not only in the UI: a gap it does
    // not know about is a gap it will narrate straight through.
    parts.push(
      `### CATATAN YANG TIDAK DISERTAKAN\nTanggal berikut tidak dikirim: ${selection.omitted.join(', ')}.`,
    );
  }
  return parts.join('\n\n');
}
