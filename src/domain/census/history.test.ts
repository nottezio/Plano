import { describe, expect, it } from 'vitest';

import { applyResolutions, nextHistory, parseHistory } from './history';
import type { Issue, VerificationReport } from './verifier';

const issue = (id: string, ruleId: string, severity: Issue['severity']): Issue => ({
  id, ruleId, severity, title: id, detail: '', patients: [], status: 'new',
});

const report = (issues: Issue[], verdict: VerificationReport['verdict'] = 'NOT_CLEAN'): VerificationReport => ({
  shiftDate: '2026-09-23', verdict, patientCount: 2, issues, resolvedSinceLastRun: [],
});

describe('applyResolutions', () => {
  it('closes an answered 🟡 item and turns the verdict CLEAN when nothing else is open', () => {
    const r = report([issue('O5:1709802:', 'O5', 'confirm')]);
    const result = applyResolutions(r, { 'O5:1709802:': 'confirmedDischarge' });
    expect(result.open).toEqual([]);
    expect(result.answered).toHaveLength(1);
    expect(result.verdict).toBe('CLEAN');
  });

  it('never lets an answer close a count or orphan', () => {
    const r = report([issue('C3:IM:', 'C3', 'high')]);
    const result = applyResolutions(r, { 'C3:IM:': 'intentional' });
    expect(result.open).toHaveLength(1);
    expect(result.verdict).toBe('NOT_CLEAN');
  });

  it('keeps PARTIAL: an answer cannot supply a missing document', () => {
    expect(applyResolutions(report([], 'PARTIAL'), {}).verdict).toBe('PARTIAL');
  });
});

describe('nextHistory — O5 carry-forward', () => {
  const vanished = issue('O5:1607407:', 'O5', 'confirm');

  it('keeps carrying an unconfirmed vanished patient', () => {
    const next = nextHistory({
      report: report([vanished]),
      roomGrid: [{ rm: '1709802', name: 'Tn. Kahar' }],
      previous: null,
      resolutions: {},
    });
    expect(next.activeRms.sort()).toEqual(['1607407', '1709802']);
  });

  it('drops them once confirmed discharged', () => {
    const next = nextHistory({
      report: report([vanished]),
      roomGrid: [{ rm: '1709802', name: 'Tn. Kahar' }],
      previous: null,
      resolutions: { 'O5:1607407:': 'confirmedDischarge' },
    });
    expect(next.activeRms).toEqual(['1709802']);
  });

  it('remembers names, keeping those of patients no longer on the grid', () => {
    const next = nextHistory({
      report: report([]),
      roomGrid: [{ rm: '1', name: 'Tn. A' }],
      previous: { shiftDate: null, issues: [], activeRms: [], names: { '2': 'Ny. B' }, resolutions: {} },
      resolutions: {},
    });
    expect(next.names).toEqual({ '1': 'Tn. A', '2': 'Ny. B' });
  });

  it('stores only open issues as the next baseline', () => {
    const next = nextHistory({
      report: report([vanished, issue('C3:IM:', 'C3', 'high')]),
      roomGrid: [],
      previous: null,
      resolutions: { 'O5:1607407:': 'confirmedDischarge' },
    });
    expect(next.issues.map((i) => i.id)).toEqual(['C3:IM:']);
  });

  it('forgets answers to issues that no longer exist', () => {
    const next = nextHistory({
      report: report([]),
      roomGrid: [],
      previous: null,
      resolutions: { 'O5:gone:': 'confirmedDischarge' },
    });
    expect(next.resolutions).toEqual({});
  });
});

describe('parseHistory', () => {
  it('treats missing, corrupt and wrong-shaped storage as no history', () => {
    expect(parseHistory(null)).toBeNull();
    expect(parseHistory('{nope')).toBeNull();
    expect(parseHistory('{"issues":"x"}')).toBeNull();
  });
});
