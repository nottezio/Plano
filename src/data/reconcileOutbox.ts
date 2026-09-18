import { getDoc } from 'firebase/firestore';

import { clearOutbox, listOutbox, type OutboxRecord } from './localBase';
import { entryDoc } from './paths';
import { appendRevision, writeBody } from './repositories/entries.repo';
import { planLateWrite } from '@/domain/merge/lateWrite';
import type { ClinicalDate, DailyEntry } from '@/domain/types';

/**
 * Settles body writes this device made and never saw confirmed.
 *
 * Runs at startup and whenever the browser says it is back online. For each
 * outstanding write it reads what the note holds NOW and follows
 * `planLateWrite`: already there, write it again, merge it, or hand it back.
 *
 * Nothing here overwrites a newer note. The merge case writes with the
 * server's current body as its base, so if the note moves again between the
 * read and the write, the rules refuse it and the record survives for the next
 * run.
 */

export interface ReconcileResult {
  patientId: string;
  date: ClinicalDate;
  outcome: 'landed' | 'rewritten' | 'merged' | 'review';
  /** How old the unconfirmed write was, in ms. */
  age: number;
}

export async function reconcileOutbox(): Promise<ReconcileResult[]> {
  const records = await listOutbox();
  const results: ReconcileResult[] = [];
  for (const record of records) {
    try {
      const result = await settle(record);
      if (result) results.push(result);
    } catch (error) {
      // Offline, refused, or the note is gone. The record stays; the next run
      // tries again. Never dropped on an error — that is the edit itself.
      console.warn('[outbox] left for the next run', record.key, error);
    }
  }
  return results;
}

async function settle(record: OutboxRecord): Promise<ReconcileResult | null> {
  const { patientId, date, body, base } = record;
  const snapshot = await getDoc(entryDoc(patientId, date));
  if (snapshot.metadata.fromCache) return null; // Offline: decide nothing.

  const entry = snapshot.exists() ? (snapshot.data() as DailyEntry) : null;
  const server = entry?.body ?? '';
  const age = Date.now() - record.at;

  // The day was cleared or deleted while this write was outstanding. Keeping
  // the text in the trail is the safe half; re-writing it would undo a
  // deliberate clear.
  if (entry?.deletedAt != null || (server.length === 0 && body.length > 0 && entry !== null)) {
    await snapshotForReview(patientId, date, body, entry?.rev ?? 0);
    await clearOutbox(patientId, date, body);
    return { patientId, date, outcome: 'review', age };
  }

  const plan = planLateWrite({ body, base, server });

  switch (plan.kind) {
    case 'landed':
      await clearOutbox(patientId, date, body);
      return null;

    case 'rewrite':
      await writeBody(patientId, date, plan.body, entry?.hariRawat ?? 0, {
        isNew: entry === null,
        base: plan.base,
      });
      await clearOutbox(patientId, date, body);
      return { patientId, date, outcome: 'rewritten', age };

    case 'merge':
      // The version being replaced goes into the trail FIRST, so a merge
      // nobody watched is undoable.
      await appendRevision(patientId, date, {
        body: plan.replaced,
        rev: entry?.rev ?? 0,
        reason: 'pre-conflict',
        label: 'sebelum gabung versi luring',
      });
      await writeBody(patientId, date, plan.body, entry?.hariRawat ?? 0, {
        isNew: false,
        base: plan.base,
      });
      await clearOutbox(patientId, date, body);
      return { patientId, date, outcome: 'merged', age };

    case 'review':
    default:
      await snapshotForReview(patientId, date, body, entry?.rev ?? 0);
      await clearOutbox(patientId, date, body);
      return { patientId, date, outcome: 'review', age };
  }
}

/**
 * The offline text goes into the revision trail, where it can be read,
 * compared and restored, and the record is cleared.
 *
 * Cleared rather than kept pending: a record that stays would append the same
 * snapshot on every startup. One copy in Riwayat perubahan, and the person
 * decides — which is the only correct owner of a decision about which version
 * of a clinical note is right.
 */
async function snapshotForReview(
  patientId: string,
  date: ClinicalDate,
  body: string,
  rev: number,
): Promise<void> {
  await appendRevision(patientId, date, {
    body,
    rev,
    reason: 'pre-conflict',
    label: 'versi luring belum digabung',
  });
}
