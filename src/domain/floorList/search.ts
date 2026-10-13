import { dpjpById } from '@/domain/dpjp';
import type { FloorPatient } from './report';

/**
 * Search on the list and the denah (13.7, Avi). One box, typed in a hurry on
 * the ward: every word must match somewhere in the patient's line — name,
 * RM, room/bed ("417", "417/2", "417 bed 2"), DPJP code, residents, the
 * diagnosis and plan, or the colour's word ("H-1", "pulang", a floor mark).
 * Case and punctuation do not matter.
 */
const squash = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * The query's terms. A term typed with a hyphen or slash stays one phrase
 * ("pre-op" → "pre op", never "pre" and "op" anywhere); "417/2" and
 * "417 bed 2" are the same place, so the word "bed" is dropped.
 */
export function searchWords(query: string): string[] {
  return query
    .split(/\s+/)
    .map(squash)
    .filter((word) => word && word !== 'bed');
}

function haystack(p: FloorPatient): string {
  const code = p.dpjpId ? (dpjpById(p.dpjpId)?.initials ?? '') : '';
  const colour = p.discharge === 'tomorrow' ? 'h-1 h1 merah' : p.discharge === 'today' ? 'pulang hari ini hijau' : '';
  return ` ${squash(
    [p.name, p.identity, p.rm, p.room, p.bed, `${p.room}${p.bed}`, code, p.junior, p.chief, p.btkv ? 'kjs btkv' : '', colour, p.mark?.label ?? '', p.body].join(' '),
  )} `;
}

/** True when every word of the query is found (at the start of a word, or a number anywhere in one). */
export function matchesSearch(patient: FloorPatient, words: readonly string[]): boolean {
  if (words.length === 0) return true;
  const text = haystack(patient);
  return words.every((word) => (/^[\d ]+$/.test(word) ? text.includes(word) : text.includes(` ${word}`)));
}
