import { describe, expect, it } from 'vitest';

import {
  COPY_GROUPS,
  availableGroups,
  groupForSection,
  sectionsForGroups,
} from './copyGroups';
import { DEFAULT_SECTION_ALIASES as ALIASES } from '../sections/aliases';
import type { SectionId } from '../types';

const BODY = [
  "Assalamu'alaikum dokter. Tabe dokter, melaporkan pasien atas nama :",
  '',
  '*S:*',
  '- nyeri dada tidak ada',
  '',
  '*O:*',
  'TD 116/72 mmHg',
  '',
  '*EKG PJT Lantai 5 06-08-2026*',
  'Sinus bradikardi',
  '',
  '*Laboratorium PJT (04-08-2026)*',
  'GDS : 222',
  '',
  '*A:*',
  '- CAD3VD',
  '',
  '*Mohon izin pasien kami terapi dengan :*',
  '- Clopidogrel 75mg',
  '',
  '*TS EMD*',
  '- sitagliptin 100 mg',
  '',
  '*Plan :*',
  '- Monitoring tanda vital',
].join('\n');

describe('the five groups', () => {
  it('are exactly S, O, A, Terapi, Plan', () => {
    expect(COPY_GROUPS.map((group) => group.id)).toEqual(['s', 'o', 'a', 'terapi', 'plan']);
  });
});

describe('groupForSection', () => {
  it('routes investigations into O', () => {
    expect(groupForSection('custom_ekg' as SectionId, 'EKG PJT 06-08-2026')).toBe('o');
    expect(groupForSection('custom_lab' as SectionId, 'Laboratorium PJT')).toBe('o');
    expect(groupForSection('custom_echo' as SectionId, 'Echo Full Study')).toBe('o');
    expect(groupForSection('penunjang' as SectionId, 'Penunjang')).toBe('o');
  });

  it('routes consultant replies into Terapi', () => {
    expect(groupForSection('custom_ts_emd' as SectionId, 'TS EMD')).toBe('terapi');
    expect(groupForSection('custom_konsul' as SectionId, 'Balasan konsul')).toBe('terapi');
  });

  it('routes diagnosis headings into A', () => {
    expect(groupForSection('custom_dx' as SectionId, 'Diagnosis Primer')).toBe('a');
    expect(groupForSection('custom_p' as SectionId, 'Problem')).toBe('a');
  });

  it('routes an unrecognised heading into O rather than dropping it', () => {
    // Wrong-but-included is editable after pasting; omitted is never noticed.
    expect(groupForSection('custom_xyz' as SectionId, 'Sesuatu')).toBe('o');
  });
});

describe('sectionsForGroups', () => {
  it('pulls EKG and lab in with O', () => {
    const ids = sectionsForGroups(BODY, ALIASES, ['o']);
    expect(ids).toContain('o');
    expect(ids.some((id) => id.includes('ekg'))).toBe(true);
    expect(ids.some((id) => id.includes('laboratorium'))).toBe(true);
  });

  it('pulls the TS reply in with Terapi', () => {
    const ids = sectionsForGroups(BODY, ALIASES, ['terapi']);
    expect(ids.some((id) => id.includes('ts'))).toBe(true);
  });

  it('never includes the greeting block', () => {
    const all = sectionsForGroups(BODY, ALIASES, ['s', 'o', 'a', 'terapi', 'plan']);
    expect(all).not.toContain('_intro');
  });

  it('keeps the groups disjoint — no section copied twice', () => {
    const all = sectionsForGroups(BODY, ALIASES, ['s', 'o', 'a', 'terapi', 'plan']);
    expect(new Set(all).size).toBe(all.length);
  });

  it('returns nothing for a group the note does not have', () => {
    expect(sectionsForGroups('*S:*\n- x', ALIASES, ['plan'])).toEqual([]);
  });

  it('keeps a dated heading whose values parse as their own sections', () => {
    // `Laboratorium PJT (04-08-2026)` is empty because `GDS : 222` under it is
    // itself a heading. Losing it would keep the number and lose the date.
    const ids = sectionsForGroups(BODY, ALIASES, ['o']);
    expect(ids.some((id) => id.includes('laboratorium'))).toBe(true);
    expect(ids.some((id) => id.includes('gds'))).toBe(true);
  });
});

describe('availableGroups', () => {
  it('reports which groups this note actually has', () => {
    const present = availableGroups(BODY, ALIASES);
    expect([...present].sort()).toEqual(['a', 'o', 'plan', 's', 'terapi']);
  });

  it('is empty for a note with no headings', () => {
    expect(availableGroups('catatan bebas tanpa header', ALIASES).size).toBe(0);
  });
});
