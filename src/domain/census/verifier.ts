import type { DenahExtraction, ListExtraction, PatientLine } from './verify';

/**
 * Plano — Ward Census Verificator: VERIFICATION LAYER (Stages 4–8)
 *
 * PORTED from Avi's `verifier.ts`. The pipeline, rules, severities and wording
 * are his. Every change is marked `PORT:` where it happens, and each one is a
 * bug fix or a spec item the original did not implement — none is a
 * re-interpretation of a rule. See CHANGES.md for the list.
 *
 * Consumes the JSON from extraction.ts (DENAH_TOOL / LIST_TOOL output).
 * Everything here is deterministic — no LLM calls. This is where the actual
 * checking happens; extraction.ts's only job was faithful transcription.
 *
 * Pipeline:
 *   4. flatten()        → PatientRecord[] per view
 *   4. matchPatients()  → MatchedPatient[] keyed by RM (name fallback)
 *   5. runChecks()      → Issue[] (orphans, counts, field agreement, category rules)
 *   6. diffAgainstPrevious() → mark resolved / persisting / new
 *   7. (severity is assigned inline per rule)
 *   8. formatReport()   → VerificationReport (+ toMarkdown())
 */

// ───────────────────────────────────────────────────────────────
// 1. TYPES
// ───────────────────────────────────────────────────────────────

export type ViewId = "roomGrid" | "dpjpTable" | "holderList" | "listPasien";
export type Severity = "high" | "medium" | "confirm" | "cosmetic";

export interface PatientRecord {
  view: ViewId;
  rm: string | null;
  nameRaw: string;
  nameNorm: string;
  dpjp: string; // normalized: no "dr."/"Prof.", uppercase, first code if dual e.g. "AHA-NP" -> "AHA"
  dpjpRaw: string;
  room: string | null;
  bed: number | null;
  tags: string[];
  resident: string | null;
  chief: string | null; // normalized via CONFIRMED aliases only
  chiefRaw: string | null;
  disposition: string[];
  sourceLine: string;
  hasClinicalDetail?: boolean;
}

export interface MatchedPatient {
  key: string; // rm or "name:<normalized>"
  rm: string | null;
  displayName: string;
  byView: Partial<Record<ViewId, PatientRecord>>;
  presentIn: ViewId[];
}

export interface Issue {
  id: string; // stable across runs: ruleId + sorted patient keys (+ field, for F-rules)
  ruleId: string;
  severity: Severity;
  title: string;
  detail: string;
  patients: { key: string; rm: string | null; name: string }[];
  comparison?: Partial<Record<ViewId | "header" | "footer", string>>;
  status: "new" | "persisting" | "resolved";
}

// PORT: the extraction types come from `verify.ts`, where the transcription
// is typed in full. The original declared narrower copies of the same shapes;
// two declarations of one document is how they come to disagree.
type RawLine = PatientLine;

// ───────────────────────────────────────────────────────────────
// 2. CONFIG — edit as roster/aliases evolve
// ───────────────────────────────────────────────────────────────
export interface VerifierConfig {
  dpjpCodes: string[];
  pediatricDpjps: string[];       // e.g. ["AAU", "YP"]
  unassignedCategories: string[]; // e.g. ["AAU", "YP", "NP"] — expected to have no resident/chief
  primaryChiefs: string[];        // tallied in the DENAH footer, e.g. ["Arya", "Gabi"]
  /** Only apply an alias once a human has confirmed it (see spec §5). Unconfirmed variants are
   *  reported as `unknownNames`, never silently merged. */
  confirmedChiefAliases: Record<string, string>; // e.g. {} until Avi confirms "Gaby" -> "Gabi"
}

export const DEFAULT_CONFIG: VerifierConfig = {
  dpjpCodes: ["KS", "PT", "AHA", "AFM", "ZD", "AFG", "AHN", "PK", "MZ", "IM", "MAA", "ARB", "NP", "AAU", "YP"],
  pediatricDpjps: ["AAU", "YP"],
  unassignedCategories: ["AAU", "YP", "NP"],
  primaryChiefs: ["Arya", "Gabi"],
  confirmedChiefAliases: {},
};

// ───────────────────────────────────────────────────────────────
// 3. NORMALIZATION HELPERS
// ───────────────────────────────────────────────────────────────

function normName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b(tn|ny|dr|prof|sp\.?jp|subsp\.?ar)\b\.?/gi, "")
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normDpjp(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/^(DR\.?|PROF\.?)\s*/i, "")
    .split(/[-\s]/)[0] // "AHA-NP" -> "AHA"
    // PORT: `?? ""` for Plano's `noUncheckedIndexedAccess`; split always
    // returns at least one element, so behaviour is unchanged.
    ?.trim() ?? "";
}

function normChief(raw: string | null, cfg: VerifierConfig): { chief: string | null; wasAliased: boolean } {
  if (!raw) return { chief: null, wasAliased: false };
  const cleaned = raw.replace(/^dr\.?\s*/i, "").replace(/^dr\.?\s*/i, "").trim(); // strips "dr. dr. X" too
  const alias = cfg.confirmedChiefAliases[cleaned];
  return alias ? { chief: alias, wasAliased: true } : { chief: cleaned, wasAliased: false };
}

function normRm(rm: string | null): string | null {
  if (!rm) return null;
  return rm.replace(/\D/g, "") || null;
}

// ───────────────────────────────────────────────────────────────
// 4a. FLATTEN — extraction JSON → PatientRecord[] per view
// ───────────────────────────────────────────────────────────────

function lineToRecord(l: RawLine, view: ViewId, cfg: VerifierConfig, extraCount?: boolean): PatientRecord {
  const { chief, chiefRaw } = { chiefRaw: l.chiefRaw, ...normChief(l.chiefRaw, cfg) };
  return {
    view,
    rm: normRm(l.rm),
    nameRaw: l.nameRaw,
    nameNorm: normName(l.nameRaw),
    dpjp: normDpjp(l.dpjpRaw),
    dpjpRaw: l.dpjpRaw,
    room: l.room,
    bed: l.bed,
    tags: l.tags ?? [],
    resident: l.residentRaw?.trim() || null,
    chief,
    chiefRaw,
    disposition: l.dispositionNotes ?? [],
    sourceLine: l.sourceLine,
    // PORT: typed instead of `(l as any)`.
    ...(extraCount && l.hasClinicalDetail !== undefined
      ? { hasClinicalDetail: l.hasClinicalDetail }
      : {}),
  };
}

export function flatten(denah: DenahExtraction | null, list: ListExtraction | null, cfg: VerifierConfig) {
  const roomGrid = denah?.roomGrid.map((l) => lineToRecord(l, "roomGrid", cfg)) ?? [];
  const dpjpTable = denah?.dpjpTable.flatMap((col) => col.entries.map((l) => lineToRecord(l, "dpjpTable", cfg))) ?? [];
  const holderList = denah?.holderList.flatMap((h) => h.entries.map((l) => lineToRecord(l, "holderList", cfg))) ?? [];
  const listPasien = list?.sections.flatMap((s) => s.entries.map((l) => lineToRecord(l, "listPasien", cfg, true))) ?? [];
  return { roomGrid, dpjpTable, holderList, listPasien };
}

// ───────────────────────────────────────────────────────────────
// 4b. MATCH — same patient across views, keyed by RM (name fallback)
// ───────────────────────────────────────────────────────────────

export function matchPatients(views: Record<ViewId, PatientRecord[]>): MatchedPatient[] {
  const byKey = new Map<string, MatchedPatient>();

  for (const view of Object.keys(views) as ViewId[]) {
    for (const rec of views[view]) {
      const key = rec.rm ? `rm:${rec.rm}` : `name:${rec.nameNorm}`;
      let m = byKey.get(key);
      if (!m) {
        m = { key, rm: rec.rm, displayName: rec.nameRaw, byView: {}, presentIn: [] };
        byKey.set(key, m);
      }
      // Prefer a view's own record for that view; if the same patient shows up
      // twice in one view (shouldn't happen), keep the first and note nothing —
      // extractionNotes should have flagged that upstream.
      if (!m.byView[view]) {
        m.byView[view] = rec;
        m.presentIn.push(view);
      }
    }
  }
  /*
    PORT: fold a name-only record into the RM-keyed patient with the same
    normalised name, when there is exactly one.

    The original keyed name-only records separately, so a patient whose RM was
    written in the room grid but left off (or garbled) in LIST_PASIEN became
    TWO patients: one orphaned from the LIST (O3) and one stale entry (O4) —
    two high-severity findings for one missing number. The spec says "fall
    back to normalized name when RM missing/garbled"; this is that fallback.

    Only when unambiguous. Two RM-keyed patients sharing a normalised name are
    two people, and guessing which one the name-only line meant would be the
    silent merge the spec rules out for chief names too.
  */
  const byName = new Map<string, MatchedPatient[]>();
  for (const m of byKey.values()) {
    if (!m.rm) continue;
    for (const rec of Object.values(m.byView)) {
      if (!rec) continue;
      const list = byName.get(rec.nameNorm) ?? [];
      if (!list.includes(m)) list.push(m);
      byName.set(rec.nameNorm, list);
    }
  }
  for (const [key, nameOnly] of [...byKey.entries()]) {
    if (nameOnly.rm) continue;
    const candidates = byName.get(key.slice('name:'.length)) ?? [];
    const target = candidates.length === 1 ? candidates[0] : undefined;
    if (!target) continue;
    const clash = nameOnly.presentIn.some((view) => target.byView[view]);
    if (clash) continue; // Both have a record in the same view: two people.
    for (const view of nameOnly.presentIn) {
      const rec = nameOnly.byView[view];
      if (!rec) continue;
      target.byView[view] = rec;
      target.presentIn.push(view);
    }
    byKey.delete(key);
  }

  return [...byKey.values()];
}

// ───────────────────────────────────────────────────────────────
// 5. RULE CHECKS
// ───────────────────────────────────────────────────────────────

const ALL_VIEWS: ViewId[] = ["roomGrid", "dpjpTable", "holderList", "listPasien"];

function mkIssue(
  ruleId: string,
  severity: Severity,
  title: string,
  detail: string,
  patients: MatchedPatient[],
  comparison?: Issue["comparison"],
  /**
   * PORT: what the issue is ABOUT when it is not about patients — the DPJP
   * code for C3, the chief for C9, the category for C10b, the RM for O5.
   *
   * The id was `ruleId + patient keys`, and those rules have no patients, so
   * every DPJP mismatch got the same id `C3:` (and every chief `C9:`, every
   * vanished patient `O5:`). Stage 6 diffs by id, so fixing one DPJP's count
   * reported a DIFFERENT DPJP as resolved, and two open issues collapsed into
   * one. The id must name the thing, or diffing is meaningless.
   */
  scope = ""
): Issue {
  const sortedKeys = patients.map((p) => p.key).sort().join(",");
  return {
    id: `${ruleId}:${scope}:${sortedKeys}`,
    ruleId,
    severity,
    title,
    detail,
    patients: patients.map((p) => ({ key: p.key, rm: p.rm, name: p.displayName })),
    ...(comparison ? { comparison } : {}),
    status: "new", // overwritten by diffAgainstPrevious()
  };
}

export interface CheckContext {
  denah: DenahExtraction | null;
  list: ListExtraction | null;
  matched: MatchedPatient[];
  cfg: VerifierConfig;
  /** Previous run's matched RM set + view presence, for O5 (vanished patient) detection. */
  previousActiveRms?: Set<string>;
  /**
   * PORT: names for those RMs. The original noted "caller should pass richer
   * history if display name matters" — it does: "RM 1709802 vanished" is a
   * number to look up, "Tn. Kahar vanished" is a patient.
   */
  previousNames?: Record<string, string>;
}

export function runChecks(ctx: CheckContext): Issue[] {
  const issues: Issue[] = [];
  const { denah, list, matched, cfg } = ctx;

  // ---- P1/P2: pre-flight ----
  if (!denah || !list) {
    issues.push(
      mkIssue(
        "P1",
        "high",
        "Missing document",
        `${!denah ? "DENAH" : "LIST_PASIEN"} was not provided. Only partial checks were run.`,
        []
      )
    );
  }
  if (denah?.shiftDateIso && list?.shiftDateIso && denah.shiftDateIso !== list.shiftDateIso) {
    issues.push(
      mkIssue(
        "P2",
        "high",
        "Document dates don't match",
        `DENAH is dated ${denah.shiftDateIso}, LIST_PASIEN is dated ${list.shiftDateIso}. Cross-doc differences below are provisional.`,
        [],
        { header: denah.shiftDateIso, footer: list.shiftDateIso }
      )
    );
  }

  // ---- O1–O4: presence / orphans ----
  for (const m of matched) {
    const inGrid = !!m.byView.roomGrid;
    const inTable = !!m.byView.dpjpTable;
    const inHolder = !!m.byView.holderList;
    const inList = !!m.byView.listPasien;
    const dpjp = m.byView.roomGrid?.dpjp ?? m.byView.dpjpTable?.dpjp ?? m.byView.listPasien?.dpjp ?? "";
    const isUnassignedCategory = cfg.unassignedCategories.includes(dpjp);
    const hasResidentAssigned = !!(m.byView.roomGrid?.resident ?? m.byView.dpjpTable?.resident);

    if (inGrid && !inTable) {
      issues.push(mkIssue("O1", "high", "Orphaned from DPJP minitable", `${m.displayName} is in the room grid but missing from the DPJP minitable.`, [m]));
    }
    if (inGrid && !inHolder && hasResidentAssigned && !isUnassignedCategory) {
      issues.push(mkIssue("O2", "high", "Orphaned from holder-list", `${m.displayName} is in the room grid, has a resident assigned, but is missing from the holder-list.`, [m]));
    }
    if (inGrid && !inList) {
      issues.push(mkIssue("O3", "high", "Orphaned from LIST_PASIEN", `${m.displayName} is in the room grid but has no entry in LIST_PASIEN — no diagnosis/plan documented for this shift.`, [m]));
    }
    if (!inGrid && (inTable || inHolder || inList)) {
      const staleViews = ALL_VIEWS.filter((v) => v !== "roomGrid" && !!m.byView[v]);
      issues.push(
        mkIssue(
          "O4",
          "medium",
          "Stale entry (not in room grid)",
          `${m.displayName} appears in ${staleViews.join(", ")} but is not in the current room grid — likely discharged/transferred without being removed from other views.`,
          [m]
        )
      );
    }
  }

  // O5: vanished without disposition notation
  if (ctx.previousActiveRms) {
    const currentRms = new Set(matched.map((m) => m.rm).filter((x): x is string => !!x));
    for (const rm of ctx.previousActiveRms) {
      if (!currentRms.has(rm)) {
        const name = ctx.previousNames?.[rm];
        issues.push(
          mkIssue(
            "O5",
            "confirm",
            name ? `Patient vanished: ${name}` : "Patient vanished",
            // PORT: the original said "with no LEPAS RAWAT / Pindah CVCU /
            // Operkan ke Tmn Lain notation found", but it never looked for
            // one. A patient absent from every view has no line left to carry
            // a notation, so this now says only what is known.
            `${name ?? `RM ${rm}`} was active in the last verified run and is absent from every view now. Confirm discharge or transfer.`,
            [],
            undefined,
            rm
          )
        );
      }
    }
  }

  // ---- Count checks C1–C8 ----
  if (list) {
    const h = list.header;
    const gridCount = ctx.matched.filter((m) => m.byView.roomGrid).length;

    if (h.jumlahPasien != null && h.jumlahPasien !== gridCount) {
      issues.push(mkIssue("C1", "high", "JUMLAH PASIEN ≠ room grid count", `Header says ${h.jumlahPasien}, room grid has ${gridCount}.`, [], { header: String(h.jumlahPasien), roomGrid: String(gridCount) }));
    }
    const sumPerDpjp = h.perDpjp.reduce((n, x) => n + (x.count ?? 0), 0);
    if (h.jumlahPasien != null && h.jumlahPasien !== sumPerDpjp) {
      issues.push(mkIssue("C2", "high", "JUMLAH PASIEN ≠ sum of per-DPJP counts", `Header total ${h.jumlahPasien}, per-DPJP lines sum to ${sumPerDpjp}.`, [], { header: `${h.jumlahPasien} vs sum ${sumPerDpjp}` }));
    }

    // C3/C4: per-DPJP agreement across header, body heading, minitable, room grid
    /*
      PORT: every code that APPEARS, not only the configured ones. A DPJP new
      to the ward is exactly the one whose counts nobody has checked yet, and
      iterating over the config alone skipped it silently.
    */
    const seenCodes = new Set<string>([
      ...cfg.dpjpCodes,
      ...h.perDpjp.map((x) => x.dpjpCode),
      ...list.sections.map((s) => s.dpjpCode),
      ...matched.map((m) => m.byView.roomGrid?.dpjp).filter((x): x is string => !!x),
    ]);
    for (const dpjpCode of seenCodes) {
      const headerN = h.perDpjp.find((x) => x.dpjpCode === dpjpCode)?.count ?? null;
      const section = list.sections.find((s) => s.dpjpCode === dpjpCode);
      const bodyN = section ? section.entries.length : 0;
      const headingN = section?.headingCount ?? null;
      const gridN = matched.filter((m) => m.byView.roomGrid?.dpjp === dpjpCode).length;
      const tableN = matched.filter((m) => m.byView.dpjpTable?.dpjp === dpjpCode).length;

      const values = { header: headerN, headingBody: headingN, listBody: bodyN, roomGrid: gridN, dpjpTable: tableN };
      const known = Object.values(values).filter((v): v is number => v != null);
      const allAgree = known.every((v) => v === known[0]);
      if (!allAgree) {
        issues.push(
          mkIssue(
            "C3",
            "high",
            `Per-DPJP count mismatch: ${dpjpCode}`,
            `Values disagree across views for ${dpjpCode}.`,
            [],
            {
              // PORT: the original had `header /* alias */ as any: undefined`
              // here, which is not valid TypeScript — the file did not compile.
              header: String(headerN),
              listPasien: `heading=${headingN}, body=${bodyN}`,
              roomGrid: String(gridN),
              dpjpTable: String(tableN),
            },
            dpjpCode
          )
        );
      }
    }

    /*
      PORT (spec §3.4, not in the original): the TRANSPOSITION detector.

      When two DPJPs' header counts are each off by exactly one in opposite
      directions against the room grid, the total still adds up — C1 and C2
      pass — and C3 reports two unrelated mismatches. The spec calls this out
      because it is the error a sum cannot see: the counts were swapped. The
      two C3 issues are replaced by one that says so.
    */
    const offByOne = new Map<string, number>();
    for (const code of seenCodes) {
      const headerN = h.perDpjp.find((x) => x.dpjpCode === code)?.count;
      if (headerN == null) continue;
      const gridN = matched.filter((m) => m.byView.roomGrid?.dpjp === code).length;
      if (Math.abs(headerN - gridN) === 1) offByOne.set(code, headerN - gridN);
    }
    const over = [...offByOne].filter(([, delta]) => delta === 1).map(([code]) => code);
    const under = [...offByOne].filter(([, delta]) => delta === -1).map(([code]) => code);
    if (over.length === 1 && under.length === 1) {
      const [a] = over;
      const [b] = under;
      if (a && b) {
        for (const code of [a, b]) {
          const index = issues.findIndex((issue) => issue.id.startsWith(`C3:${code}:`));
          if (index >= 0) issues.splice(index, 1);
        }
        issues.push(
          mkIssue(
            "C3T",
            "high",
            `Counts swapped between ${a} and ${b}`,
            `The LIST header has one too many under ${a} and one too few under ${b}; the total still matches, so only a per-DPJP check sees it.`,
            [],
            undefined,
            [a, b].sort().join("+")
          )
        );
      }
    }

    // C5: KJS BTKV
    const btkvActual = matched.filter((m) => (m.byView.roomGrid?.tags ?? []).some((t) => /KJS BTKV/i.test(t))).length;
    if (h.kjsBtkv != null && h.kjsBtkv !== btkvActual) {
      issues.push(mkIssue("C5", "high", "KJS BTKV count wrong", `Header says ${h.kjsBtkv}, ${btkvActual} patients are tagged (KJS BTKV).`, [], { header: String(h.kjsBtkv), roomGrid: String(btkvActual) }));
    }
    // C7: PEDIATRI
    const pediActual = matched.filter((m) => cfg.pediatricDpjps.includes(m.byView.roomGrid?.dpjp ?? "")).length;
    if (h.pediatri != null && h.pediatri !== pediActual) {
      issues.push(mkIssue("C7", "high", "PEDIATRI count wrong", `Header says ${h.pediatri}, ${pediActual} patients are under pediatric DPJPs (${cfg.pediatricDpjps.join("/")}).`, [], { header: String(h.pediatri), roomGrid: String(pediActual) }));
    }
    // C6: KARDIO derived
    if (h.jumlahPasien != null && h.kardio != null && h.kjsBtkv != null && h.kjsTsLain != null && h.pediatri != null) {
      const expectedKardio = h.jumlahPasien - h.kjsBtkv - h.kjsTsLain - h.pediatri;
      if (h.kardio !== expectedKardio) {
        issues.push(
          mkIssue(
            "C6",
            "high",
            "KARDIO count wrong",
            `Header says ${h.kardio}; expected JUMLAH(${h.jumlahPasien}) − BTKV(${h.kjsBtkv}) − TS Lain(${h.kjsTsLain}) − PEDIATRI(${h.pediatri}) = ${expectedKardio}.`,
            [],
            { header: String(h.kardio) }
          )
        );
        // Cascade detection: same root cause as C5/C7 if those also failed
        const relatedRoot = issues.find((i) => i.ruleId === "C5" || i.ruleId === "C7");
        const last = issues.at(-1);
        if (relatedRoot && last) last.detail += ` Likely the same root cause as "${relatedRoot.title}".`;
      }
    }
  }

  // C8: holder-list total
  const holderTotal = matched.filter((m) => m.byView.holderList).length;
  const gridTotal = matched.filter((m) => m.byView.roomGrid).length;
  const unassignedTotal = matched.filter((m) => cfg.unassignedCategories.includes(m.byView.roomGrid?.dpjp ?? "")).length;
  if (holderTotal !== gridTotal - unassignedTotal) {
    issues.push(
      mkIssue(
        "C8",
        "medium",
        "Holder-list total doesn't reconcile",
        `Holder-list has ${holderTotal} patients; expected room grid (${gridTotal}) minus unassigned-category patients (${unassignedTotal}) = ${gridTotal - unassignedTotal}.`,
        []
      )
    );
  }

  // C9: chief tally — compute two ways (raw grouping, and with confirmed aliases applied)
  if (denah) {
    const tallyRaw: Record<string, number> = {};
    const tallyAliased: Record<string, number> = {};
    for (const m of matched) {
      const rec = m.byView.roomGrid;
      if (!rec?.chiefRaw) continue;
      const cleanedRaw = rec.chiefRaw.replace(/^dr\.?\s*/i, "").replace(/^dr\.?\s*/i, "").trim();
      tallyRaw[cleanedRaw] = (tallyRaw[cleanedRaw] ?? 0) + 1;
      const key = rec.chief ?? cleanedRaw; // chief already has confirmed aliases applied
      tallyAliased[key] = (tallyAliased[key] ?? 0) + 1;
    }
    for (const { chiefRaw, count } of denah.chiefTally) {
      if (count == null) continue;
      const cleaned = chiefRaw.replace(/^dr\.?\s*/i, "").trim();
      const actualRaw = tallyRaw[cleaned] ?? 0;
      const actualAliased = tallyAliased[cleaned] ?? 0;
      if (count !== actualRaw && count !== actualAliased) {
        issues.push(
          mkIssue(
            "C9",
            "high",
            `Chief tally wrong: ${cleaned}`,
            // PORT: "if unconfirmed name variants are folded in" described
            // something the code does not do — only CONFIRMED aliases are
            // folded. The sentence now says what was counted.
            `Footer says ${count}; independently counted ${actualRaw} by exact spelling (${actualAliased} with confirmed aliases applied). Unconfirmed variants are not merged.`,
            [],
            { footer: String(count), roomGrid: `raw=${actualRaw}, aliased=${actualAliased}` },
            cleaned
          )
        );
      }
    }
  }

  // C10 / Tidak di FU
  if (denah) {
    if (!denah.tidakDiFU.present) {
      const anyUnassigned = matched.some((m) => cfg.unassignedCategories.includes(m.byView.roomGrid?.dpjp ?? ""));
      if (anyUnassigned) {
        issues.push(mkIssue("C10a", "medium", "Tidak di FU footer missing", "Unassigned-category patients exist but the DENAH has no 'Tidak di FU' footer at all.", []));
      }
    } else {
      for (const cat of cfg.unassignedCategories) {
        const footerEntry = denah.tidakDiFU.entries.find((e) => e.categoryRaw.toUpperCase().includes(cat));
        const actual = matched.filter((m) => m.byView.roomGrid?.dpjp === cat).length;
        if (footerEntry?.count != null && footerEntry.count !== actual) {
          issues.push(
            mkIssue(
              "C10b",
              "medium",
              `Tidak di FU stale: ${cat}`,
              `Footer says ${cat} ${footerEntry.count}; room grid has ${actual} patients under ${cat}.`,
              [],
              { footer: String(footerEntry.count), roomGrid: String(actual) },
              cat
            )
          );
        }
      }
    }
  }

  // ---- Field agreement F1–F6 ----
  for (const m of matched) {
    const present = ALL_VIEWS.map((v) => m.byView[v]).filter((r): r is PatientRecord => !!r);
    if (present.length < 2) continue;

    checkFieldAgreement(m, present, "dpjp", "F1", "DPJP code disagrees across views", issues);
    checkFieldAgreement(m, present, "resident", "F2", "Resident disagrees across views", issues);
    checkFieldAgreement(m, present, "chief", "F3", "Chief disagrees across views (check for stale chief after rotation)", issues);
    checkRoomBedAgreement(m, present, issues);

    /*
      PORT (spec §3.5, not in the original): F6, the same RM with a different
      name. Cosmetic — the RM already says it is one patient — but it is the
      typo that makes someone search the wrong name on the next shift.
    */
    const names = new Set(present.map((r) => r.nameNorm).filter((n) => n.length > 0));
    if (m.rm && names.size > 1) {
      const comparison: Issue["comparison"] = {};
      for (const r of present) comparison[r.view] = r.nameRaw;
      issues.push(mkIssue("F6", "cosmetic", `Name spelled differently: ${m.displayName}`, "Same RM, different name by view.", [m], comparison));
    }
  }

  /*
    PORT (spec §3.5 F5, not in the original): a dual DPJP code (`AHA-NP`) in
    the room grid, cosmetic when the other views agree on one code. The
    original normalised it to its first code and never reported it, so the
    agreement check passed silently over a line the spec asks to be flagged.
  */
  for (const m of matched) {
    const grid = m.byView.roomGrid;
    if (!grid || !/[-/]/.test(grid.dpjpRaw.trim())) continue;
    const others = ALL_VIEWS.filter((v) => v !== "roomGrid")
      .map((v) => m.byView[v]?.dpjp)
      .filter((x): x is string => !!x);
    if (others.length > 0 && new Set(others).size === 1) {
      issues.push(mkIssue("F5", "cosmetic", `Dual DPJP code: ${m.displayName}`, `Room grid says "${grid.dpjpRaw}"; the other views say ${others[0]}.`, [m]));
    }
  }

  return issues;
}

function checkFieldAgreement(
  m: MatchedPatient,
  present: PatientRecord[],
  field: "dpjp" | "resident" | "chief",
  ruleId: string,
  title: string,
  issues: Issue[]
) {
  const values = present.map((r) => ({ view: r.view, value: r[field] }));
  const nonNull = values.filter((v) => v.value != null);
  if (nonNull.length < 2) return;
  const distinct = new Set(nonNull.map((v) => v.value));
  if (distinct.size > 1) {
    const comparison: Issue["comparison"] = {};
    for (const v of nonNull) comparison[v.view] = String(v.value);
    issues.push(mkIssue(ruleId, ruleId === "F3" ? "medium" : "high", `${title}: ${m.displayName}`, `${field} differs by view.`, [m], comparison));
  }
}

function checkRoomBedAgreement(m: MatchedPatient, present: PatientRecord[], issues: Issue[]) {
  const withRoom = present.filter((r) => r.room != null);
  if (withRoom.length < 2) return;
  const distinctRooms = new Set(withRoom.map((r) => r.room));
  if (distinctRooms.size > 1) {
    const comparison: Issue["comparison"] = {};
    for (const r of withRoom) comparison[r.view] = `room ${r.room}${r.bed != null ? ` bed ${r.bed}` : ""}`;
    issues.push(mkIssue("F4", "high", `Room/bed disagrees: ${m.displayName}`, "Room number differs by view.", [m], comparison));
  }
}

// ───────────────────────────────────────────────────────────────
// 6. DIFF AGAINST PREVIOUS RUN
// ───────────────────────────────────────────────────────────────

export function diffAgainstPrevious(current: Issue[], previous: Issue[]): { issues: Issue[]; resolved: Issue[] } {
  const prevIds = new Set(previous.map((i) => i.id));
  const currIds = new Set(current.map((i) => i.id));

  const issues = current.map((i) => ({ ...i, status: prevIds.has(i.id) ? "persisting" : "new" } as Issue));
  const resolved = previous.filter((i) => !currIds.has(i.id)).map((i) => ({ ...i, status: "resolved" as const }));

  return { issues, resolved };
}

// ───────────────────────────────────────────────────────────────
// 7. SEVERITY ORDER (for sorting/report grouping)
// ───────────────────────────────────────────────────────────────
const SEVERITY_ORDER: Severity[] = ["high", "medium", "confirm", "cosmetic"];
const SEVERITY_LABEL: Record<Severity, string> = {
  high: "🔴 High",
  medium: "🟠 Medium",
  confirm: "🟡 Needs confirmation",
  cosmetic: "Cosmetic",
};

// ───────────────────────────────────────────────────────────────
// 8. REPORT
// ───────────────────────────────────────────────────────────────

export interface VerificationReport {
  shiftDate: string | null;
  verdict: "CLEAN" | "NOT_CLEAN" | "PARTIAL";
  patientCount: number;
  issues: Issue[];
  resolvedSinceLastRun: Issue[];
}

export function buildReport(denah: DenahExtraction | null, list: ListExtraction | null, ctx: CheckContext, previousIssues: Issue[] = []): VerificationReport {
  const rawIssues = runChecks(ctx);
  const { issues, resolved } = diffAgainstPrevious(rawIssues, previousIssues);

  const patientCount = ctx.matched.filter((m) => m.byView.roomGrid).length;
  const verdict: VerificationReport["verdict"] = !denah || !list ? "PARTIAL" : issues.length === 0 ? "CLEAN" : "NOT_CLEAN";

  issues.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));

  return {
    shiftDate: denah?.shiftDateIso ?? list?.shiftDateIso ?? null,
    verdict,
    patientCount,
    issues,
    resolvedSinceLastRun: resolved,
  };
}

export function toMarkdown(report: VerificationReport): string {
  const lines: string[] = [];
  lines.push(`## Verification Result: ${report.shiftDate ?? "unknown date"} — ${report.verdict}${report.verdict === "NOT_CLEAN" ? ` (${report.issues.length} issue${report.issues.length === 1 ? "" : "s"})` : ""}`);
  lines.push("");

  if (report.resolvedSinceLastRun.length) {
    lines.push("### ✅ Resolved since last run");
    for (const i of report.resolvedSinceLastRun) lines.push(`- ${i.title}`);
    lines.push("");
  }

  const bySeverity = new Map<Severity, Issue[]>();
  for (const i of report.issues) {
    if (!bySeverity.has(i.severity)) bySeverity.set(i.severity, []);
    bySeverity.get(i.severity)!.push(i);
  }

  for (const sev of SEVERITY_ORDER) {
    const group = bySeverity.get(sev);
    if (!group?.length) continue;
    lines.push(`### ${SEVERITY_LABEL[sev]}`);
    for (const i of group) {
      lines.push(`**${i.title}**${i.status === "persisting" ? " _(persisting)_" : ""}`);
      lines.push(i.detail);
      if (i.comparison) {
        for (const [k, v] of Object.entries(i.comparison)) if (v) lines.push(`- ${k}: ${v}`);
      }
      lines.push("");
    }
  }

  if (report.verdict === "CLEAN") lines.push("All checks passed.");
  return lines.join("\n");
}

// ───────────────────────────────────────────────────────────────
// 9. TOP-LEVEL ENTRY POINT
// ───────────────────────────────────────────────────────────────

export function verify(
  denah: DenahExtraction | null,
  list: ListExtraction | null,
  cfg: VerifierConfig = DEFAULT_CONFIG,
  previousIssues: Issue[] = [],
  previousActiveRms?: Set<string>,
  previousNames?: Record<string, string>
): VerificationReport {
  const views = flatten(denah, list, cfg);
  const matched = matchPatients(views);
  const ctx: CheckContext = {
    denah,
    list,
    matched,
    cfg,
    ...(previousActiveRms ? { previousActiveRms } : {}),
    ...(previousNames ? { previousNames } : {}),
  };
  return buildReport(denah, list, ctx, previousIssues);
}

// Usage:
// const denah = await extract("DENAH.pdf", "DENAH");
// const list  = await extract("LIST.pdf", "LIST_PASIEN");
// const report = verify(denah, list, DEFAULT_CONFIG, previousRun?.issues, previousRun?.activeRms);
// console.log(toMarkdown(report));
