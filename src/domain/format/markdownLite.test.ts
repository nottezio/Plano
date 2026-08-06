import { describe, expect, it } from 'vitest';

import {
  BOLD,
  ITALIC,
  insertSectionHeader,
  toggleBullet,
  toggleNumbered,
  toggleWrap,
} from './markdownLite';

describe('toggleWrap', () => {
  it('wraps a selection', () => {
    const result = toggleWrap('sesak berat', 0, 5, BOLD);
    expect(result.text).toBe('**sesak** berat');
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe('sesak');
  });

  it('unwraps when the markers are inside the selection', () => {
    const result = toggleWrap('**sesak** berat', 0, 9, BOLD);
    expect(result.text).toBe('sesak berat');
  });

  it('unwraps when the markers sit just outside the selection', () => {
    const result = toggleWrap('**sesak** berat', 2, 7, BOLD);
    expect(result.text).toBe('sesak berat');
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe('sesak');
  });

  it('inserts an empty pair and parks the caret inside', () => {
    const result = toggleWrap('S: ', 3, 3, ITALIC);
    expect(result.text).toBe('S: __');
    expect(result.selectionStart).toBe(4);
    expect(result.selectionEnd).toBe(4);
  });

  it('round-trips', () => {
    const once = toggleWrap('sesak', 0, 5, BOLD);
    const twice = toggleWrap(once.text, once.selectionStart, once.selectionEnd, BOLD);
    expect(twice.text).toBe('sesak');
  });
});

describe('toggleBullet', () => {
  it('bullets every selected line', () => {
    const text = 'O2 3 lpm\nCek DPL';
    const result = toggleBullet(text, 0, text.length);
    expect(result.text).toBe('- O2 3 lpm\n- Cek DPL');
  });

  it('removes bullets when every line already has one', () => {
    const text = '- O2 3 lpm\n- Cek DPL';
    expect(toggleBullet(text, 0, text.length).text).toBe('O2 3 lpm\nCek DPL');
  });

  it('leaves blank lines alone', () => {
    const text = 'O2 3 lpm\n\nCek DPL';
    expect(toggleBullet(text, 0, text.length).text).toBe('- O2 3 lpm\n\n- Cek DPL');
  });

  it('operates on the caret line when nothing is selected', () => {
    const text = 'S: sesak\nO2 3 lpm';
    const result = toggleBullet(text, 12, 12);
    expect(result.text).toBe('S: sesak\n- O2 3 lpm');
  });

  it('replaces numbering rather than stacking it', () => {
    const text = '1. O2 3 lpm';
    expect(toggleBullet(text, 0, text.length).text).toBe('- O2 3 lpm');
  });
});

describe('toggleNumbered', () => {
  it('numbers a block from 1', () => {
    const text = 'O2 3 lpm\nCek DPL\nKonsul';
    expect(toggleNumbered(text, 0, text.length).text).toBe(
      '1. O2 3 lpm\n2. Cek DPL\n3. Konsul',
    );
  });

  it('removes numbering when every line already has it', () => {
    const text = '1. O2\n2. DPL';
    expect(toggleNumbered(text, 0, text.length).text).toBe('O2\nDPL');
  });

  it('renumbers rather than trusting the existing digits', () => {
    const text = '- O2\n- DPL';
    expect(toggleNumbered(text, 0, text.length).text).toBe('1. O2\n2. DPL');
  });
});

describe('insertSectionHeader', () => {
  it('inserts at the caret when already at a line start', () => {
    const result = insertSectionHeader('S: sesak\n', 9, 'Penunjang');
    expect(result.text).toBe('S: sesak\nPenunjang: ');
    expect(result.selectionStart).toBe(result.text.length);
  });

  it('breaks the line first when the caret is mid-line', () => {
    const result = insertSectionHeader('S: sesak', 8, 'Penunjang');
    expect(result.text).toBe('S: sesak\nPenunjang: ');
  });

  it('keeps following text on its own line', () => {
    const result = insertSectionHeader('S: sesak\nA: pneumonia', 9, 'Penunjang');
    expect(result.text).toBe('S: sesak\nPenunjang: \nA: pneumonia');
  });

  it('produces a header the parser actually detects', () => {
    const result = insertSectionHeader('', 0, 'Penunjang');
    expect(result.text).toBe('Penunjang: ');
  });
});
