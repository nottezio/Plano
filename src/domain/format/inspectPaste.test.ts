import { describe, expect, it } from 'vitest';

import { auditText, comparePaste, findQuestionMarks } from './inspectPaste';

describe('auditText', () => {
  it('finds nothing in text that is already ASCII', () => {
    expect(auditText('Suhu : 36.6 derajat Celcius\nNadi : 86 kali/menit')).toEqual([]);
  });

  it('reports the code point and a findable position', () => {
    const [hit] = auditText('baris satu\nSuhu 36.6\u00B0C');
    expect(hit).toMatchObject({ code: 'U+00B0', line: 2, column: 10 });
  });

  it('catches the characters that are invisible on screen', () => {
    // The two that made this bug unfindable by eye: a non-breaking space and a
    // zero-width space, both of which look like nothing at all.
    const codes = auditText('Nadi\u00A073\u200B x').map((hit) => hit.code);
    expect(codes).toContain('U+00A0');
    expect(codes).toContain('U+200B');
  });

  it('does not let a CRLF paste double every line number', () => {
    const [hit] = auditText('satu\r\ndua\r\n\u2022 tiga');
    expect(hit?.line).toBe(3);
  });
});

describe('findQuestionMarks', () => {
  it('finds the literal `?` that auditText cannot, because it is ASCII', () => {
    const [hit] = findQuestionMarks('Suhu 36.6 ?C');
    expect(hit).toMatchObject({ line: 1, column: 11 });
    expect(hit?.context).toContain('36.6');
  });

  it('stays quiet on a clean note', () => {
    expect(findQuestionMarks('Nadi 86 kali/menit')).toEqual([]);
  });
});

describe('comparePaste', () => {
  it('calls a Windows newline conversion identical', () => {
    // Every text field on Windows does this. A diff that flagged it would
    // report the whole note as changed and hide the one line that matters.
    expect(comparePaste('a\nb\nc', 'a\r\nb\r\nc').identical).toBe(true);
  });

  it('points at the first line where the two stop agreeing', () => {
    const result = comparePaste('Suhu 36.6 derajat\nNadi 86', 'Suhu 36.6 ?\nNadi 86');
    expect(result.identical).toBe(false);
    expect(result.firstDiffLine).toBe(1);
    expect(result.after).toContain('?');
  });

  it('stops at twenty changed lines rather than printing a wall', () => {
    const sent = Array.from({ length: 60 }, (_, index) => `baris ${index}`).join('\n');
    const received = Array.from({ length: 60 }, (_, index) => `lain ${index}`).join('\n');
    expect(comparePaste(sent, received).changedLines).toHaveLength(20);
  });
});
