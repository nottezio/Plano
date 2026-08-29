import { describe, expect, it } from 'vitest';

import { DEFAULT_SECTION_ALIASES } from '../defaults';
import { parseSections } from '../sections/parseSections';
import { appendShiftNote, formatShiftTime } from './shiftNote';

const AT = new Date(2026, 7, 29, 14, 5);

const DAY = ['*S :*', 'Sesak berkurang.', '*O :*', 'Compos mentis'].join('\n');

describe('shift note', () => {
  it('formats the time with a dot, not a colon', () => {
    // A colon reads as a header delimiter to the parser.
    expect(formatShiftTime(AT)).toBe('Jam 14.05');
  });

  it('appends at the end, never at the caret', () => {
    // A shift note is a later event; interleaving it with the morning
    // findings would misreport when something happened.
    const { text } = appendShiftNote(DAY, AT);
    expect(text.startsWith(DAY)).toBe(true);
    expect(text.trimEnd().endsWith('Jam 14.05')).toBe(true);
  });

  it('leaves one blank line between the day and the block', () => {
    const { text } = appendShiftNote(DAY, AT);
    expect(text).toContain('Compos mentis\n\n*SOAP Jaga:*\nJam 14.05');
  });

  it('adds no separator to an empty body', () => {
    const { text } = appendShiftNote('', AT);
    expect(text).toBe('*SOAP Jaga:*\nJam 14.05\n');
  });

  it('does not stack blank lines on a body that already ends in them', () => {
    const { text } = appendShiftNote(`${DAY}\n\n\n`, AT);
    expect(text).not.toContain('\n\n\n');
  });

  it('leaves the caret ready to type', () => {
    const { text, selectionStart, selectionEnd } = appendShiftNote(DAY, AT);
    expect(selectionStart).toBe(text.length);
    expect(selectionEnd).toBe(text.length);
  });

  it('parses as one stable section id regardless of the time', () => {
    // The whole reason the clock is on the line below: `*SOAP Jaga 14:05:*`
    // would parse to `custom_soap_jaga_14_05`, a different section every time.
    const morning = appendShiftNote(DAY, new Date(2026, 7, 29, 9, 30)).text;
    const evening = appendShiftNote(DAY, new Date(2026, 7, 29, 21, 15)).text;

    const idOf = (body: string): string =>
      parseSections(body, DEFAULT_SECTION_ALIASES)
        .map((section) => section.sectionId)
        .filter((id) => id.startsWith('custom_'))
        .join(',');

    expect(idOf(morning)).toBe('custom_soap_jaga');
    expect(idOf(evening)).toBe('custom_soap_jaga');
  });

  it('does not disturb the day sections it is appended to', () => {
    // The block must be additive: the morning S and O keep their identity, in
    // their original order, with no new occurrences introduced.
    const before = parseSections(DAY, DEFAULT_SECTION_ALIASES).map((s) => s.sectionId);
    const after = parseSections(appendShiftNote(DAY, AT).text, DEFAULT_SECTION_ALIASES).map(
      (s) => s.sectionId,
    );
    expect(after).toEqual([...before, 'custom_soap_jaga']);
  });

  it('introduces no second occurrence of s or o', () => {
    // This is the copy hazard the empty block exists to avoid: `composeCopy`
    // gathers EVERY occurrence, so a nested `*S:*` here would merge the shift
    // complaint into the morning one on the way out to the chief.
    const sections = parseSections(appendShiftNote(DAY, AT).text, DEFAULT_SECTION_ALIASES);
    expect(sections.filter((s) => s.sectionId === 's')).toHaveLength(1);
    expect(sections.filter((s) => s.sectionId === 'o')).toHaveLength(1);
  });

  it('stacks two shift notes in one day without nesting them', () => {
    const once = appendShiftNote(DAY, new Date(2026, 7, 29, 14, 5)).text;
    const twice = appendShiftNote(once, new Date(2026, 7, 29, 21, 40)).text;
    expect(twice).toContain('Jam 14.05');
    expect(twice).toContain('Jam 21.40');
    const ids = parseSections(twice, DEFAULT_SECTION_ALIASES).map((s) => s.sectionId);
    expect(ids.filter((id) => id === 'custom_soap_jaga')).toHaveLength(2);
  });
});
