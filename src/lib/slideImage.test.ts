import { describe, expect, it } from 'vitest';
import type { StoredImage } from '@/data/slidesLocal';
import { SLIDE_IMAGE_SIDE, slideImageSize, storedToDeckPhoto } from './slideImage';

describe('slideImage', () => {
  it('caps the longest side at 2000 and never enlarges', () => {
    expect(SLIDE_IMAGE_SIDE).toBe(2000);
    expect(slideImageSize(4000, 3000)).toEqual({ width: 2000, height: 1500 });
    expect(slideImageSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('turns a stored image into a deck photo with its bytes and placed rect', async () => {
    const stored: StoredImage = {
      imageId: 'i1', patientId: 'p1', blob: new Blob([new Uint8Array([7, 8, 9])], { type: 'image/jpeg' }),
      widthPx: 4, heightPx: 3, kind: 'ekg', date: '2026-11-12', place: '', caption: '',
    };
    const photo = await storedToDeckPhoto(stored, { x: -1, y: 2, w: 3, h: 4 });
    expect([...photo.bytes]).toEqual([7, 8, 9]);
    expect(photo).toMatchObject({ imageId: 'i1', mime: 'image/jpeg', widthPx: 4, heightPx: 3, rect: { x: -1, y: 2, w: 3, h: 4 } });
  });

  it('a PNG stays PNG', async () => {
    const stored = { imageId: 'i2', blob: new Blob([new Uint8Array([1])], { type: 'image/png' }), widthPx: 1, heightPx: 1 } as StoredImage;
    expect((await storedToDeckPhoto(stored)).mime).toBe('image/png');
  });
});
