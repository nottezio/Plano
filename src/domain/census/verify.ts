/**
 * Ward Census Verificator — the transcription types, and its self-check.
 *
 * Two layers, kept apart on purpose:
 *
 *   `selfCheckProblems` — ported from `extraction.ts`. Does the model's own
 *   count of its arrays match the arrays? A mismatch means a dropped or
 *   duplicated row in the TRANSCRIPTION, and it is what triggers the retry.
 *
 *   Stages 4–8 live in `verifier.ts` (ported from Avi's `verifier.ts`). The
 *   provisional `censusFindings` that stood in for them was deleted when the
 *   real verifier arrived, rather than left as a second checker.
 */

export type CensusKind = 'DENAH' | 'LIST_PASIEN';

export interface PatientLine {
  sourceLine: string;
  entryNumberRaw: string | null;
  room: string | null;
  bed: number | null;
  dpjpRaw: string;
  nameRaw: string;
  rm: string | null;
  dobRaw: string | null;
  ageRaw: string | null;
  tags: string[];
  residentRaw: string | null;
  chiefRaw: string | null;
  dispositionNotes: string[];
  unknownNames: string[];
  hasClinicalDetail?: boolean;
}

export interface DenahExtraction {
  documentType: CensusKind | 'UNKNOWN';
  shiftDateRaw: string | null;
  shiftDateIso: string | null;
  roomBlocks: Array<{ room: string; label: string | null; bedsListed: number; occupiedBeds: number[] }>;
  roomGrid: PatientLine[];
  dpjpTable: Array<{ headerRaw: string; dpjpCode: string; entries: PatientLine[] }>;
  chiefTally: Array<{ lineRaw: string; chiefRaw: string; count: number | null }>;
  holderList: Array<{ residentHeaderRaw: string; entries: PatientLine[] }>;
  operkanKeTmnLain: string[];
  gantiChief: string[];
  tidakDiFU: { present: boolean; entries: Array<{ categoryRaw: string; count: number | null }> };
  selfCheck: { roomGridPatientCount: number; dpjpTableEntryCount: number; holderListEntryCount: number };
  extractionNotes: string[];
}

export interface ListExtraction {
  documentType: CensusKind | 'UNKNOWN';
  shiftDateRaw: string | null;
  shiftDateIso: string | null;
  header: {
    jumlahPasien: number | null;
    kardio: number | null;
    kjsBtkv: number | null;
    kjsTsLain: number | null;
    pediatri: number | null;
    pediKjs: number | null;
    perDpjp: Array<{ lineRaw: string; dpjpCode: string; count: number | null }>;
  };
  sections: Array<{ headingRaw: string; dpjpCode: string; headingCount: number | null; entries: PatientLine[] }>;
  selfCheck: { headerPerDpjpLineCount: number; bodyEntryCount: number };
  extractionNotes: string[];
}

/**
 * Ported from `extraction.ts`, typed. Same checks, same order, same wording —
 * with ONE deliberate change: it stops at a wrong document type.
 *
 * The original pushed the type problem and carried on counting, reading
 * `roomGrid` off whatever came back. When the shape really is the other
 * document's, those arrays are missing and the count THROWS — so a user who
 * dropped the LIST into the DENAH slot got an exception instead of "this is
 * the wrong document", which is the one message that tells them what to do.
 * Counts of the wrong document mean nothing anyway.
 */
export function selfCheckProblems(
  data: DenahExtraction | ListExtraction,
  kind: CensusKind,
): string[] {
  const problems: string[] = [];
  if (data.documentType !== kind) {
    problems.push(`Expected ${kind}, got ${data.documentType}`);
    return problems;
  }

  if (kind === 'DENAH') {
    const d = data as DenahExtraction;
    const grid = (d.roomGrid ?? []).length;
    const table = (d.dpjpTable ?? []).reduce((n, column) => n + column.entries.length, 0);
    const holder = (d.holderList ?? []).reduce((n, section) => n + section.entries.length, 0);
    const occupied = (d.roomBlocks ?? []).reduce((n, block) => n + block.occupiedBeds.length, 0);
    if (grid !== d.selfCheck.roomGridPatientCount)
      problems.push(`roomGrid ${String(grid)} ≠ selfCheck ${String(d.selfCheck.roomGridPatientCount)}`);
    if (table !== d.selfCheck.dpjpTableEntryCount)
      problems.push(`dpjpTable ${String(table)} ≠ selfCheck ${String(d.selfCheck.dpjpTableEntryCount)}`);
    if (holder !== d.selfCheck.holderListEntryCount)
      problems.push(`holderList ${String(holder)} ≠ selfCheck ${String(d.selfCheck.holderListEntryCount)}`);
    if (occupied !== grid) problems.push(`roomBlocks occupied ${String(occupied)} ≠ roomGrid ${String(grid)}`);
  } else {
    const l = data as ListExtraction;
    const body = (l.sections ?? []).reduce((n, section) => n + section.entries.length, 0);
    if (body !== l.selfCheck.bodyEntryCount)
      problems.push(`body ${String(body)} ≠ selfCheck ${String(l.selfCheck.bodyEntryCount)}`);
    if (l.header.perDpjp.length !== l.selfCheck.headerPerDpjpLineCount)
      problems.push('header perDpjp line count mismatch');
  }
  return problems;
}
