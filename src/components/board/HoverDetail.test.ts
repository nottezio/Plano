import { describe, expect, it } from 'vitest';

import { placeHoverPanel } from './HoverDetail';

const viewport = { width: 1400, height: 800 };
const zone = { left: 410, right: 700, top: 300, bottom: 340 };

describe('placeHoverPanel', () => {
  it('opens to the right of the card when there is room', () => {
    const card = { left: 400, right: 710, top: 250, bottom: 450 };
    expect(placeHoverPanel(card, zone, 200, viewport)).toEqual({ left: 718, top: 300, width: 340 });
  });

  it('opens to the left when the card sits against the right edge', () => {
    const card = { left: 1080, right: 1390, top: 250, bottom: 450 };
    const place = placeHoverPanel(card, { ...zone, left: 1090 }, 200, viewport);
    expect(place.left).toBe(1080 - 340 - 8);
  });

  it('opens below the text when a row fills the width, and above when below has no room', () => {
    const row = { left: 0, right: 1400, top: 0, bottom: 800 };
    expect(placeHoverPanel(row, zone, 200, viewport).top).toBe(348);
    expect(placeHoverPanel(row, { ...zone, top: 700, bottom: 740 }, 200, viewport).top).toBe(492);
  });

  it('stays inside the screen when the panel is tall', () => {
    const card = { left: 400, right: 710, top: 600, bottom: 780 };
    expect(placeHoverPanel(card, { ...zone, top: 700 }, 500, viewport).top).toBe(292);
  });
});
