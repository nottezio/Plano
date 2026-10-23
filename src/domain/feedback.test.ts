import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { LIMIT as SESSION_LOG_LIMIT } from '@/lib/sessionLog';
import { MAX_FEEDBACK_CHARS, feedbackForClaude, type Feedback } from './feedback';

const RULES = readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8');

const report: Feedback = {
  id: 'f1',
  uid: 'u1',
  email: 'a@b.c',
  kind: 'bug',
  text: 'Kartu tidak muncul',
  status: 'baru',
  createdAt: new Date('2026-10-24T03:00:00Z'),
  device: { appVersion: 'test-build', userAgent: 'UA', viewport: '390x844', online: true, standalone: true },
  log: [
    { at: '2026-10-24T02:59:00Z', kind: 'boot', online: true },
    { at: '2026-10-24T02:59:30Z', kind: 'error', online: false, detail: 'TypeError: x @ /p/1 [a.js:1:2]' },
  ],
};

describe('feedback rules agree with the client', () => {
  it('bounds text and log the same way', () => {
    expect(RULES).toContain(`text.size() <= ${String(MAX_FEEDBACK_CHARS)}`);
    expect(RULES).toContain(`log.size() <= ${String(SESSION_LOG_LIMIT)}`);
  });
});

describe('feedbackForClaude', () => {
  it('puts the description, errors and the full log in one block', () => {
    const text = feedbackForClaude(report);
    expect(text).toContain('## Plano bug report');
    expect(text).toContain('Kartu tidak muncul');
    expect(text).toContain('### Errors recorded on the device (1)');
    expect(text).toContain('- 2026-10-24T02:59:30Z TypeError: x @ /p/1 [a.js:1:2]');
    expect(text).toContain('- 2026-10-24T02:59:30Z error (offline) — TypeError');
    expect(text).toContain('390x844, installed app, online');
  });

  it('leaves the log out of a feature request', () => {
    const text = feedbackForClaude({ ...report, kind: 'fitur' });
    expect(text).toContain('## Plano feature request');
    expect(text).not.toContain('Session log');
  });
});
