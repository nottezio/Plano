import { describe, expect, it } from 'vitest';

import { notePreview, noteTone } from './NoteCards';

describe('notePreview', () => {
  it('turns block markup into line breaks', () => {
    expect(notePreview('<p>Baris satu</p><p>Baris dua</p>')).toBe('Baris satu\nBaris dua');
  });

  it('marks list items so a checklist still reads as one', () => {
    expect(notePreview('<ul><li>EKG</li><li>Lab</li></ul>')).toBe('• EKG\n• Lab');
  });

  it('strips inline markup and decodes the entities a paste brings', () => {
    expect(notePreview('<b>TD</b> 120/80 &amp; nadi&nbsp;80')).toBe('TD 120/80 & nadi 80');
  });

  it('never leaves a tag in the preview', () => {
    expect(notePreview('<div onclick="x()">halo</div><img src="y">')).toBe('halo');
  });

  it('collapses runs of blank lines', () => {
    expect(notePreview('<p>a</p><br><br><br><p>b</p>')).toBe('a\n\nb');
  });

  it('is empty for an empty note', () => {
    expect(notePreview('<p><br></p>')).toBe('');
  });
});

describe('noteTone', () => {
  it('is stable for an id', () => {
    expect(noteTone('n1')).toEqual(noteTone('n1'));
  });

  it('uses the shared tokens, never a literal colour', () => {
    expect(noteTone('nabc').bg).toMatch(/^var\(--card-step-\d+-bg\)$/);
    expect(noteTone('nabc').fg).toMatch(/^var\(--card-step-\d+-fg\)$/);
  });

  it('spreads different ids across the palette', () => {
    const tones = new Set(
      ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8'].map((id) => noteTone(id).bg),
    );
    expect(tones.size).toBeGreaterThan(3);
  });
});
