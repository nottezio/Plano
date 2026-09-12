import { describe, expect, it } from 'vitest';

import { buildFormasi, buildKonfirmasi, longDate, nextDate, resolveShift } from './formasi';
import type { DpjpRoster, JagaRoster, JagaShift, JarkomDirectory } from './types';

const SHIFT: JagaShift = {
  date: '2026-09-17',
  shift: 'penuh',
  hari: 'Kamis',
  posts: { chiefPjt: 'HM', bangsalA: 'IK' },
};

const ROSTER: JagaRoster = {
  title: 'Jadwal Jaga PPDS Kardiologi',
  shifts: [SHIFT],
  initials: { HM: 'dr. Siti Hajar Malika', IK: 'dr. Indah Kurniati Ramli' },
  importedAt: '',
};

const JARKOM: JarkomDirectory = {
  entries: [{ name: 'dr. Sitti Hajar Malika', panggilan: 'Malika', muslim: true }],
  importedAt: '',
};

const DPJP: DpjpRoster = {
  title: 'SEPTEMBER 2026',
  days: [
    { date: '2026-09-17', utama: 'dr. Asrul', tindakan: 'dr. Asrul' },
    { date: '2026-09-18', utama: 'dr. Pendrik', tindakan: 'Prof. Idar' },
  ],
  importedAt: '',
};

describe('dates', () => {
  it('spells a date the way the message does', () => {
    expect(longDate('2026-07-13')).toBe('Senin, 13 Juli 2026');
  });

  it('rolls over a month end', () => {
    expect(nextDate('2026-09-30')).toBe('2026-10-01');
  });
});

describe('resolveShift', () => {
  const posts = resolveShift(SHIFT, ROSTER, JARKOM);

  it('returns every post, including the ones nobody is on', () => {
    // Paediatrics keeps its own roster, so its column is blank in every row.
    // The line is printed empty rather than dropped: a missing line reads as
    // an oversight, a blank one reads as "not ours to report".
    expect(posts).toHaveLength(10);
    expect(posts.find((post) => post.id === 'pedi')).toMatchObject({ initials: '' });
  });

  it('resolves through a one-letter spelling difference between the documents', () => {
    // `Siti` in the roster legend, `Sitti` in Jarkom — the same person.
    expect(posts.find((post) => post.id === 'chiefPjt')).toMatchObject({
      panggilan: 'Malika',
      muslim: true,
    });
  });

  it('keeps the full name when Jarkom has no row for them', () => {
    // The sheet is a semester old and the roster is not. Degrading to the
    // formal name is usable; dropping the person is not.
    expect(posts.find((post) => post.id === 'bangsalA')).toMatchObject({
      name: 'dr. Indah Kurniati Ramli',
      panggilan: null,
      muslim: null,
    });
  });
});

describe('buildFormasi', () => {
  const text = buildFormasi(
    SHIFT,
    resolveShift(SHIFT, ROSTER, JARKOM),
    DPJP,
    new Date(2026, 8, 16, 13, 0),
  );

  it('uses the greeting for the hour it is written', () => {
    expect(text).toContain('selamat siang dokter');
  });

  it('takes the post-midnight DPJP from the NEXT calendar day', () => {
    // The consultant on call changes at 00.00 WITA, which is a date boundary
    // — not a second column of the same row.
    expect(text).toContain('_DPJP Utama : dr. Asrul_');
    expect(text).toContain('*DPJP Utama dan Tindakan setelah Pk. 00.00 WITA*');
    expect(text).toContain('_DPJP Utama : dr. Pendrik_');
  });

  it('omits the post-midnight block rather than repeating today', () => {
    // A wrong name there sends the night's reports to someone who is not on.
    const short: DpjpRoster = { ...DPJP, days: [DPJP.days[0]!] };
    const only = buildFormasi(SHIFT, resolveShift(SHIFT, ROSTER, JARKOM), short, new Date());
    expect(only).not.toContain('setelah Pk. 00.00');
  });

  it('prints the nickname, falling back to the full name', () => {
    expect(text).toContain('Chief PJT : Malika');
    expect(text).toContain('Bangsal A : dr. Indah Kurniati Ramli');
  });
});

describe('belum konfirmasi', () => {
  const posts = resolveShift(SHIFT, ROSTER, JARKOM);

  it('marks every staffed post outstanding until it is ticked', () => {
    const text = buildFormasi(SHIFT, posts, DPJP, new Date(2026, 8, 16, 13, 0), new Set());
    expect(text).toContain('Chief PJT : Malika (belum konfirmasi)');
    expect(text).toContain('Bangsal A : dr. Indah Kurniati Ramli (belum konfirmasi)');
  });

  it('drops the mark once that senior has replied', () => {
    const text = buildFormasi(
      SHIFT,
      posts,
      DPJP,
      new Date(2026, 8, 16, 13, 0),
      new Set(['chiefPjt'] as const),
    );
    expect(text).toContain('Chief PJT : Malika\n');
    expect(text).not.toContain('Chief PJT : Malika (belum');
    expect(text).toContain('Bangsal A : dr. Indah Kurniati Ramli (belum konfirmasi)');
  });

  it('never marks an unstaffed post outstanding', () => {
    // Paediatrics has nobody to confirm. A warning that is always there is one
    // that stops being read, and takes the real ones with it.
    const text = buildFormasi(SHIFT, posts, DPJP, new Date(), new Set());
    expect(text).toContain('Pediatri : \n');
  });

  it('defaults to outstanding when no set is passed at all', () => {
    // The default state of a name nobody has ticked is "not yet confirmed" —
    // a store that must be seeded first reports a full team the day somebody
    // forgets to seed it.
    expect(buildFormasi(SHIFT, posts, DPJP, new Date())).toContain('(belum konfirmasi)');
  });
});

describe('buildKonfirmasi', () => {
  const posts = resolveShift(SHIFT, ROSTER, JARKOM);
  const at = new Date(2026, 8, 16, 13, 0);

  it('greets a Muslim colleague with the salam', () => {
    const text = buildKonfirmasi(posts[0]!, { senderName: 'Avi', senderPlace: 'Bangsal PJT A', date: '2026-09-17' }, at);
    expect(text.startsWith('Assalamualaikum tabe dokter,')).toBe(true);
  });

  it('uses the neutral greeting when the agama is unknown', () => {
    // Never the commoner one: it is wrong for a quarter of the list, and this
    // is the one thing the Jarkom sheet exists to get right.
    const unknown = posts.find((post) => post.id === 'bangsalA')!;
    const text = buildKonfirmasi(unknown, { senderName: 'Avi', senderPlace: 'Bangsal PJT A', date: '2026-09-17' }, at);
    expect(text.startsWith('Selamat siang dokter, tabe dok,')).toBe(true);
  });

  it('names the sender, their post, the date and the target post', () => {
    const text = buildKonfirmasi(posts[0]!, { senderName: 'Asad', senderPlace: 'Bangsal PJT A', date: '2026-07-13' }, at);
    expect(text).toContain('Saya Asad');
    expect(text).toContain('bertugas jaga di Bangsal PJT A');
    expect(text).toContain('_Senin, 13 Juli 2026_');
    expect(text).toContain('*Chief Jaga PJT*');
  });
});

describe('display name', () => {
  it('is the same string the Formasi prints and the list shows', () => {
    // Computed once, in resolveShift. Two call sites deriving it with the same
    // expression is one refactor away from drifting, and the failure that
    // produces is a report naming someone the user never messaged.
    const posts = resolveShift(SHIFT, ROSTER, JARKOM);
    const text = buildFormasi(SHIFT, posts, DPJP, new Date(), new Set(['chiefPjt'] as const));
    for (const post of posts) {
      if (post.initials) expect(text).toContain(`${post.label} : ${post.display}`);
    }
  });

  it('lets a manual correction win over both documents', () => {
    const posts = resolveShift(SHIFT, ROSTER, JARKOM, { HM: 'Ika' });
    expect(posts.find((post) => post.id === 'chiefPjt')?.display).toBe('Ika');
  });

  it('falls back to the ROSTER name, never to Jarkom’s spelling', () => {
    const posts = resolveShift(SHIFT, ROSTER, null);
    expect(posts.find((post) => post.id === 'chiefPjt')?.display).toBe('dr. Siti Hajar Malika');
  });

  it('names somebody even when nothing resolves', () => {
    // A blank in a Formasi reads as "unstaffed", and this post is not.
    const posts = resolveShift(SHIFT, { ...ROSTER, initials: {} }, null);
    expect(posts.find((post) => post.id === 'chiefPjt')?.display).toBe('HM');
  });
});
