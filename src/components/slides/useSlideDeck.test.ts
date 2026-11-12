import { describe, expect, it, vi } from 'vitest';

const fetchEntryBodies = vi.fn(async () => [{ date: '2026-11-12', body: 'S :\n- baik' }]);
const writeBody = vi.fn();
vi.mock('@/data/repositories/entries.repo', () => ({ fetchEntryBodies, writeBody }));
vi.mock('@/data/slidesLocal', () => ({
  loadDeck: vi.fn(async () => null),
  listImages: vi.fn(async () => []),
}));

const { loadSlideInputs } = await import('./useSlideDeck');

describe('loadSlideInputs', () => {
  it('reads the entries once per open and writes nothing to Firestore', async () => {
    const inputs = await loadSlideInputs('p1');
    expect(fetchEntryBodies).toHaveBeenCalledTimes(1);
    expect(fetchEntryBodies).toHaveBeenCalledWith('p1');
    expect(writeBody).not.toHaveBeenCalled();
    expect(inputs).toEqual({ days: [{ date: '2026-11-12', body: 'S :\n- baik' }], deck: null, images: [] });
  });
});
