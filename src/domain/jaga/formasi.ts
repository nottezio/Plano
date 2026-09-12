import { expandOpeningTokens, timeOfDayWord } from '@/domain/opening';

import { matchJarkom } from './match';
import { JAGA_POSTS, type JagaPostId } from './types';
import type { DpjpRoster, JagaRoster, JagaShift, JarkomDirectory } from './types';

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/** `2026-07-13` → `Senin, 13 Juli 2026`. */
export function longDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  const at = new Date(year, month - 1, day);
  return `${DAY_NAMES[at.getDay()]}, ${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

/** The day after `date`, as the same ISO string. */
export function nextDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  const at = new Date(year, month - 1, day + 1);
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
}

export interface ResolvedPost {
  id: JagaPostId;
  label: string;
  place: string;
  /**
   * The name to print — the SAME string the confirmation row shows.
   *
   * Resolved once, here, so the Formasi and the list it is confirmed against
   * cannot disagree. They were computed with the same expression in two
   * places, which is one refactor away from drifting; a report naming someone
   * the user never messaged is the failure that would produce.
   */
  display: string;
  /** As printed in the roster, or empty where the post is unstaffed. */
  initials: string;
  /** Full name from the legend, or null when the initials are unknown. */
  name: string | null;
  /** Nickname from Jarkom — what the Formasi prints. */
  panggilan: string | null;
  muslim: boolean | null;
}

/**
 * Turn one shift's initials into people.
 *
 * Every post is returned, including the unstaffed ones. Paediatrics keeps its
 * own roster that only they see, so its column is blank in every row — the
 * Formasi prints the line with nothing after it, because a missing line reads
 * as an oversight and a blank one reads as "not ours to report".
 *
 * A name that resolves from the legend but not from Jarkom keeps the full
 * name and loses only the nickname and the greeting. That degrades in the
 * right direction: a slightly formal message beats no message.
 */
export function resolveShift(
  shift: JagaShift,
  roster: JagaRoster,
  jarkom: JarkomDirectory | null,
  /** Manual corrections by initials; see `store.setNameOverride`. */
  overrides: Readonly<Record<string, string>> = {},
): ResolvedPost[] {
  return JAGA_POSTS.map((post) => {
    const initials = shift.posts[post.id] ?? '';
    const name = initials ? (roster.initials[initials] ?? null) : null;
    const entry = name && jarkom ? matchJarkom(name, jarkom) : null;
    const override = initials ? overrides[initials] : undefined;

    return {
      id: post.id,
      label: post.label,
      place: post.place,
      initials,
      name,
      panggilan: entry?.panggilan ?? null,
      muslim: entry ? entry.muslim : null,
      /*
        Order of preference, and every step of it is deliberate:

          1. what the user typed        — the only deliberate source here
          2. the Jarkom nickname        — how the person is actually addressed
          3. the ROSTER's full name     — never Jarkom's spelling of it
          4. the initials as printed    — honest, and still readable by anyone
             on the rota

        There is no step that produces nothing. A post with a person on it
        always names them somehow, because a blank in a Formasi reads as
        "unstaffed" and this one is not.
      */
      display: override ?? entry?.panggilan ?? name ?? initials,
    };
  });
}

/**
 * The Formasi Jaga message.
 *
 * The post-midnight DPJP block is the NEXT CALENDAR DAY's row, not a second
 * column of the same one — the consultant on call changes at 00.00 WITA, which
 * is a date boundary. Omitted entirely when tomorrow is not in the imported
 * roster, rather than repeating today's pair: a wrong name there sends the
 * night's reports to someone who is not on.
 */
export function buildFormasi(
  shift: JagaShift,
  posts: readonly ResolvedPost[],
  dpjp: DpjpRoster | null,
  at: Date,
  /**
   * Posts whose senior has replied. Anything staffed and absent from this set
   * is printed `(belum konfirmasi)`.
   *
   * A set of the CONFIRMED rather than of the outstanding: the default state
   * of a name nobody has ticked is "not yet confirmed", and a store that has
   * to be seeded with every post before it means anything is one that reports
   * a full team the day somebody forgets to seed it.
   */
  confirmed: ReadonlySet<JagaPostId> = new Set(),
): string {
  const today = dpjp?.days.find((day) => day.date === shift.date) ?? null;
  const tomorrow = dpjp?.days.find((day) => day.date === nextDate(shift.date)) ?? null;

  const lines: string[] = [
    expandOpeningTokens('Assalamualaikum dokter, selamat (waktu) dokter', at),
    'Tabe dokter, mohon izin melaporkan tim jaga: ',
    '',
  ];

  if (today) {
    lines.push(`_DPJP Utama : ${today.utama}_`, `_DPJP Tindakan : ${today.tindakan}_`, '');
  }

  lines.push(`*Hari/Tanggal : ${longDate(shift.date)}*`, '');

  for (const post of posts) {
    /*
      An unstaffed post is blank, never "(belum konfirmasi)".

      Paediatrics keeps its own roster and its column is empty in every row.
      There is nobody to confirm, so marking it outstanding would put a
      permanent false alarm in every Formasi — and a warning that is always
      there is one that stops being read, taking the real ones with it.
    */
    const who = post.display;
    const pending = post.initials && !confirmed.has(post.id) ? ' (belum konfirmasi)' : '';
    lines.push(`${post.label} : ${who}${pending}`);
  }

  lines.push('', 'Mohon arahannya dokter. Terima kasih dokter.');

  if (tomorrow) {
    lines.push(
      '',
      '*DPJP Utama dan Tindakan setelah Pk. 00.00 WITA*',
      `_DPJP Utama : ${tomorrow.utama}_`,
      `_DPJP Tindakan : ${tomorrow.tindakan}_`,
    );
  }

  return lines.join('\n');
}

/**
 * The message sent to one senior to confirm they are on.
 *
 * The greeting follows their AGAMA, which is the only reason the Jarkom sheet
 * is imported at all. Where it is unknown the neutral form is used — the one
 * that is never wrong for anybody, rather than the commoner one that is wrong
 * for a quarter of the list.
 */
export function buildKonfirmasi(
  post: ResolvedPost,
  options: { senderName: string; senderPlace: string; date: string },
  at: Date,
): string {
  const waktu = timeOfDayWord(at.getHours());
  const greeting =
    post.muslim === true ? 'Assalamualaikum tabe dokter,' : `Selamat ${waktu} dokter, tabe dok,`;

  return [
    greeting,
    `Mohon maaf mengganggu. Saya ${options.senderName}, yang bertugas jaga di ${options.senderPlace} pada _${longDate(options.date)}_. Saya ingin mengonfirmasi apakah dokter bertugas sebagai *${post.place}* pada hari tersebut. Mohon arahan dan bimbingannya. Terima kasih, dokter.`,
  ].join('\n');
}
