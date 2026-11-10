import { parseSections } from '@/domain/sections/parseSections';
import { tintFor, type SectionTint } from '@/domain/sections/sectionTint';
import type { SectionAlias } from '@/domain/types';

/**
 * A colleague's SOAP cut into the parts a reader jumps between (12.12, Avi:
 * "auto-scroll header like the sensus" in the floating SOAP box): the opening
 * and identity, S, O, A, Terapi, Plan, and each TS block. Everything else
 * (an EKG or echo heading, a lab line) stays inside the part it sits in, so
 * the jump row has a handful of chips, not twenty.
 *
 * Display only: the parts are slices of the text, and joined back they are the
 * text unchanged.
 */
export interface SoapPart {
  /** The chip label ("S", "Assessment", "TS GER"); '' for the opening. */
  label: string;
  tint: SectionTint;
  text: string;
}

const MAIN: Record<string, string> = { s: 'S', o: 'O', a: 'Assessment', terapi: 'Terapi', p: 'Plan' };

/** "TS GER", "*TS BTKV*", "TS KGH:" alone on a line: a consulting team's block. */
const TS_LINE = /^[\s*_]*(TS\s+[A-Za-z][^\n:]{0,30}?)[\s*_:]*$/i;

function labelFor(sectionId: string, headerLine: string | null): string {
  const flat = (headerLine ?? '').replace(/[*_~:]/g, '').replace(/\s+/g, ' ').trim();
  // An early "Diagnosis :" summary is shown as written; the "Mohon izin…"
  // heading is the Assessment.
  if (sectionId === 'a' && flat && !/^mohon\b/i.test(flat) && flat.length <= 20) return flat.charAt(0).toUpperCase() + flat.slice(1).toLowerCase();
  return MAIN[sectionId] ?? flat;
}

export function soapParts(text: string, aliases?: readonly SectionAlias[]): SoapPart[] {
  const starts: Array<{ at: number; label: string; tint: SectionTint }> = [];
  for (const section of parseSections(text, aliases)) {
    if (!section.ownsLine || !(section.sectionId in MAIN)) continue;
    starts.push({ at: section.start, label: labelFor(section.sectionId, section.headerLine), tint: tintFor(section.sectionId, section.label) });
  }
  // TS blocks are found by line: the parser does not read a bare "TS GER" as a heading.
  let offset = 0;
  for (const line of text.split('\n')) {
    const ts = TS_LINE.exec(line);
    if (ts?.[1] && !starts.some((start) => start.at === offset)) starts.push({ at: offset, label: ts[1].replace(/\s+/g, ' '), tint: 'ts' });
    offset += line.length + 1;
  }
  starts.sort((a, b) => a.at - b.at);
  const parts: SoapPart[] = [];
  const first = starts[0]?.at ?? text.length;
  if (first > 0) parts.push({ label: '', tint: 'identitas', text: text.slice(0, first) });
  starts.forEach((start, index) => {
    parts.push({ label: start.label, tint: start.tint, text: text.slice(start.at, starts[index + 1]?.at ?? text.length) });
  });
  return parts;
}

/** The groups Tempel's "Lihat perubahan" sorts a SOAP's changes into (10 Nov 2026, Avi), in reading order. */
export const SOAP_GROUPS = ['Identitas', 'S', 'O', 'A', 'P', 'KJS'] as const;
export type SoapGroup = (typeof SOAP_GROUPS)[number];

function groupOf(part: SoapPart): SoapGroup {
  if (part.tint === 'ts') return 'KJS';
  if (part.label === '') return 'Identitas';
  if (part.label === 'S' || part.label === 'O') return part.label;
  if (part.label === 'Terapi' || part.label === 'Plan') return 'P';
  // "Assessment", or an early "Diagnosis" summary shown as written.
  return 'A';
}

/** The SOAP's text per group: its parts joined, so each group can be compared on its own. */
export function soapGroups(text: string, aliases?: readonly SectionAlias[]): Record<SoapGroup, string> {
  const out: Record<SoapGroup, string> = { Identitas: '', S: '', O: '', A: '', P: '', KJS: '' };
  for (const part of soapParts(text, aliases)) out[groupOf(part)] += part.text;
  return out;
}
