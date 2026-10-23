import { describe, expect, it } from 'vitest';

import { describeError } from './sessionLog';

describe('describeError', () => {
  it('keeps the message, route and top frames', () => {
    const error = new TypeError("Cannot read properties of undefined (reading 'body')");
    error.stack = [
      "TypeError: Cannot read properties of undefined (reading 'body')",
      '    at Xa (https://plano.app/assets/PatientPage-a1b2.js:1:2345)',
      '    at https://plano.app/assets/index-c3d4.js:12:99',
    ].join('\n');
    expect(describeError(error, '/p/abc')).toBe(
      "TypeError: Cannot read properties of undefined (reading 'body') @ /p/abc " +
        '[PatientPage-a1b2.js:1:2345 < index-c3d4.js:12:99]',
    );
  });

  it('cuts quoted text, which may be a note', () => {
    const error = new SyntaxError('Unexpected token \'a\', "Tn. Budi, 54 th" is not valid JSON');
    error.stack = '';
    const line = describeError(error, '/');
    expect(line).not.toContain('Budi');
    expect(line).toContain('"…" is not valid JSON');
  });

  it('handles non-Error values and caps the length', () => {
    expect(describeError('x'.repeat(1000), '/')).toHaveLength(200 + ' @ /'.length);
    expect(describeError(undefined, '/list')).toBe('unknown error @ /list');
  });
});
