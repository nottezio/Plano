/**
 * Run two independent calls at the same time; a call refused for QUOTA is
 * retried once, after the other has finished.
 *
 * Why (2026-10-11): the census verifier read DENAH and then LIST PASIEN one
 * after the other, so the wait was the SUM of two long transcriptions. They do
 * not depend on each other. The one cost of running them together is a key
 * with a low per-minute quota, which may refuse the second (429): that call
 * alone is run again once the first is done — the old sequential behaviour,
 * only when it is actually needed.
 *
 * Any other failure is thrown as it is: retrying a broken request wastes the
 * wait and hides the reason.
 */
export async function sideBySide<A, B>(
  first: (() => Promise<A>) | null,
  second: (() => Promise<B>) | null,
  isQuota: (error: unknown) => boolean,
): Promise<[A | null, B | null]> {
  const [a, b] = await Promise.allSettled([first ? first() : null, second ? second() : null]);
  for (const outcome of [a, b]) {
    if (outcome.status === 'rejected' && !isQuota(outcome.reason)) throw outcome.reason;
  }
  const firstResult = a.status === 'fulfilled' ? a.value : await first!();
  const secondResult = b.status === 'fulfilled' ? b.value : await second!();
  return [firstResult, secondResult];
}
