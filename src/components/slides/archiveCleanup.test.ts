import { describe, expect, it, vi } from 'vitest';

const deleteSlides = vi.fn(async () => undefined);
vi.mock('@/data/slidesLocal', () => ({ deleteSlides, slideUsage: vi.fn(async () => null) }));

const { deleteSlidesAfterArchive } = await import('./SlideCleanupNotice');

describe('deleteSlidesAfterArchive', () => {
  it('deletes only after the archive write succeeds', async () => {
    deleteSlides.mockClear();
    await deleteSlidesAfterArchive(Promise.resolve(), ['p1']);
    expect(deleteSlides).toHaveBeenCalledWith('p1');
  });

  it('keeps the slides when the archive is refused', async () => {
    deleteSlides.mockClear();
    await deleteSlidesAfterArchive(Promise.reject(new Error('permission-denied')), ['p1']);
    expect(deleteSlides).not.toHaveBeenCalled();
  });
});
