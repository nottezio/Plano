import { describe, expect, it } from 'vitest';
import { SLIDE_W } from './geometry';
import { nudge, rectAfterBoxResize, rectAfterDrag, rectAfterResize, slideMzFileName } from './editMath';

describe('photo moves', () => {
  it('drag moves by the delta and may leave the slide', () => {
    expect(rectAfterDrag({ x: 0, y: 0, w: 100, h: 50 }, -300, 7_000_000)).toEqual({ x: -300, y: 7_000_000, w: 100, h: 50 });
  });

  it('resize keeps aspect and a 5 % minimum width', () => {
    const r = rectAfterResize({ x: 0, y: 0, w: 1_000_000, h: 500_000 }, -5_000_000);
    expect(r.w).toBe(Math.round(SLIDE_W * 0.05));
    expect(r.h * 2).toBe(r.w);
  });

  it('resize grows from the top-left corner', () => {
    expect(rectAfterResize({ x: 10, y: 20, w: 1_000_000, h: 500_000 }, 1_000_000)).toEqual({ x: 10, y: 20, w: 2_000_000, h: 1_000_000 });
  });

  it('a free resize (text box) changes width and height independently, with a minimum', () => {
    expect(rectAfterBoxResize({ x: 0, y: 0, w: 1_000_000, h: 2_000_000 }, 500_000, -300_000)).toEqual({ x: 0, y: 0, w: 1_500_000, h: 1_700_000 });
    const tiny = rectAfterBoxResize({ x: 0, y: 0, w: 1_000_000, h: 800_000 }, -9_000_000, -9_000_000);
    expect(tiny).toMatchObject({ w: Math.round(SLIDE_W * 0.05), h: Math.round(SLIDE_W * 0.05) });
  });

  it('arrow nudge is 1 % of the slide, 5 % with Shift', () => {
    expect(nudge({ x: 0, y: 0, w: 1, h: 1 }, 'ArrowRight', false)?.x).toBe(Math.round(SLIDE_W * 0.01));
    expect(nudge({ x: 0, y: 0, w: 1, h: 1 }, 'ArrowLeft', true)?.x).toBe(-Math.round(SLIDE_W * 0.05));
    expect(nudge({ x: 0, y: 0, w: 1, h: 1 }, 'Enter', false)).toBeNull();
  });
});

describe('slideMzFileName', () => {
  it('names the file after the patient and date, without unsafe characters', () => {
    expect(slideMzFileName('Tn. A/B', '2026-11-12')).toBe('PPT - Tn. AB - 12-11-2026.pptx');
    expect(slideMzFileName('  ', '2026-11-12')).toBe('PPT - 12-11-2026.pptx');
  });
});
