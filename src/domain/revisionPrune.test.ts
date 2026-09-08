import { describe, expect, it } from 'vitest';

import { prunableRevisions, REVISION_CAP } from './revisionPrune';
import type { EntryRevision } from './types';

const auto = (id: string): Pick<EntryRevision, 'reason'> & { id: string } => ({
  id,
  reason: 'autosave',
});
const version = (id: string): Pick<EntryRevision, 'reason'> & { id: string } => ({
  id,
  reason: 'version',
});

describe('prunableRevisions', () => {
  it('keeps everything below the cap', () => {
    expect(prunableRevisions([auto('a'), auto('b')])).toEqual([]);
  });

  it('drops the oldest automatic snapshots past the cap', () => {
    const many = Array.from({ length: REVISION_CAP + 3 }, (_, index) => auto(`a${String(index)}`));
    expect(prunableRevisions(many).map((revision) => revision.id)).toEqual([
      `a${String(REVISION_CAP)}`,
      `a${String(REVISION_CAP + 1)}`,
      `a${String(REVISION_CAP + 2)}`,
    ]);
  });

  it('never prunes a saved version', () => {
    /*
     * The justification for hard-deleting anything here is that these are
     * derived safety copies rather than user-authored notes. Somebody pressed
     * a button to keep a version, so the justification does not reach it.
     */
    const many = [
      ...Array.from({ length: REVISION_CAP + 5 }, (_, index) => auto(`a${String(index)}`)),
      version('pagi'),
    ];
    expect(prunableRevisions(many).some((revision) => revision.id === 'pagi')).toBe(false);
  });

  it('does not let versions consume the cap', () => {
    /*
     * The failure this prevents, and it would have arrived on the days with
     * the most typing: counted towards the cap, a busy morning of autosaves
     * pushes the saved version past position 30 and deletes it.
     */
    const many = [
      version('pagi'),
      version('post-op'),
      ...Array.from({ length: REVISION_CAP }, (_, index) => auto(`a${String(index)}`)),
    ];
    // All 30 autosaves survive despite two versions sitting above them.
    expect(prunableRevisions(many)).toEqual([]);
  });

  it('keeps a version that is older than every autosave', () => {
    // Newest-first, so the morning version sits at the very bottom by evening.
    const many = [
      ...Array.from({ length: REVISION_CAP + 10 }, (_, index) => auto(`a${String(index)}`)),
      version('pagi'),
    ];
    const pruned = prunableRevisions(many);
    expect(pruned).toHaveLength(10);
    expect(pruned.every((revision) => revision.reason === 'autosave')).toBe(true);
  });
});
