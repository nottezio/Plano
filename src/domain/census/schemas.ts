/**
 * Ward Census Verificator — EXTRACTION SCHEMAS AND PROMPT (Stages 0–3).
 *
 * Ported from Avi's `extraction.ts` with the wording UNCHANGED: the tool
 * schemas and the system prompt are the specification of what the model is
 * asked to do, and paraphrasing a spec while porting it is how two versions
 * of one instruction come to disagree.
 *
 * What changed in the port, and only this:
 *   - no `@anthropic-ai/sdk` and no `readFileSync`: Plano is a browser app,
 *     so the call goes through `lib/ai` with the user's own key, and the PDF
 *     arrives from a file input (see `lib/censusExtraction`);
 *   - `selfCheckProblems` is typed instead of `any`, and moved to
 *     `domain/census/verify` beside the other checks.
 *
 * Claude only TRANSCRIBES. Every check runs in deterministic code afterwards.
 */

export const ROSTER = {
  dpjpCodes: ["KS", "PT", "AHA", "AFM", "ZD", "AFG", "AHN", "PK", "MZ", "IM", "MAA", "ARB", "NP", "AAU", "YP"],
  residents: ["Qalby", "Ari", "Imelda", "Yudi", "Indah", "Avi", "Lummy"],
  chiefs: ["Arya", "Gabi", "Mirna", "Aul", "Ellen", "Miranti", "Nadiah", "Ricky", "Soekarno Hatta", "Jordy"],
};

// ───────────────────────────────────────────────────────────────
// 2. SHARED SUB-SCHEMA: one patient line, as written
// ───────────────────────────────────────────────────────────────
const patientLine = {
  type: "object",
  additionalProperties: false,
  required: [
    "sourceLine", "entryNumberRaw", "room", "bed", "dpjpRaw", "nameRaw", "rm",
    "dobRaw", "ageRaw", "tags", "residentRaw", "chiefRaw", "dispositionNotes", "unknownNames",
  ],
  properties: {
    sourceLine: { type: "string", description: "The full patient line copied verbatim, joined into one line if it wraps." },
    entryNumberRaw: { type: ["string", "null"], description: "Leading list number exactly as written, e.g. '1.', '11.', '1. 1.'. Null if none." },
    room: { type: ["string", "null"], description: "Room number, e.g. '419'. From the KAMAR block or the line prefix. Split fused tokens: 'I404M' → room '404'." },
    bed: { type: ["integer", "null"], description: "Bed number. Accept typos like 'be 3' or 'bed2'. In the room grid, use the bed list number." },
    dpjpRaw: { type: "string", description: "DPJP code exactly as written, e.g. 'IM', 'AHA-NP'. Fused 'I404M' → 'IM'." },
    nameRaw: { type: "string", description: "Patient name as written, with the title (Tn./Ny./dr.) kept." },
    rm: { type: ["string", "null"], description: "Medical record number, digits only, including leading zeros. Null if absent." },
    dobRaw: { type: ["string", "null"], description: "Date of birth as written. Do not reformat." },
    ageRaw: { type: ["string", "null"], description: "Age as written ('56 tahun', '61 th'). Null if blank." },
    tags: { type: "array", items: { type: "string" }, description: "Parenthesised tags, e.g. ['KJS BTKV']." },
    residentRaw: { type: ["string", "null"], description: "First name after '- dr.', as written. Null if the line has no trailing doctor pair." },
    chiefRaw: { type: ["string", "null"], description: "Second name in the trailing pair, as written. Keep oddities such as 'dr. Miranti' from 'dr. dr. Miranti'. Null if absent." },
    dispositionNotes: {
      type: "array",
      items: { type: "string" },
      description: "Any of: 'Operkan', 'Operkan ke Tmn Lain', 'Pindah CVCU', 'LEPAS RAWAT', or an incoming-transfer note like 'dr. Diva -> Yudi', attached to THIS patient.",
    },
    unknownNames: {
      type: "array",
      items: { type: "string" },
      description: "Resident or chief names on this line that are NOT in the provided roster. Copy as written.",
    },
  },
} as const;

// ───────────────────────────────────────────────────────────────
// 3. DENAH TOOL SCHEMA
// ───────────────────────────────────────────────────────────────
export const DENAH_TOOL = {
  name: "record_denah",
  description: "Record the verbatim structured transcription of a DENAH PASIEN document.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "documentType", "shiftDateRaw", "shiftDateIso", "roomBlocks", "roomGrid", "dpjpTable",
      "chiefTally", "holderList", "operkanKeTmnLain", "gantiChief", "tidakDiFU", "selfCheck", "extractionNotes",
    ],
    properties: {
      documentType: { type: "string", enum: ["DENAH", "LIST_PASIEN", "UNKNOWN"], description: "What this document actually is, regardless of filename." },
      shiftDateRaw: { type: ["string", "null"], description: "Date text from the title, e.g. 'Senin, 31/08/2026'." },
      shiftDateIso: { type: ["string", "null"], description: "The same date as YYYY-MM-DD." },
      roomBlocks: {
        type: "array",
        description: "Every KAMAR block in the room grid, including empty ones.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["room", "label", "bedsListed", "occupiedBeds"],
          properties: {
            room: { type: "string" },
            label: { type: ["string", "null"], description: "e.g. 'VIP', 'SUPER VIP', 'Pria-Kelas I'." },
            bedsListed: { type: "integer", description: "Number of numbered bed slots shown." },
            occupiedBeds: { type: "array", items: { type: "integer" } },
          },
        },
      },
      roomGrid: { type: "array", items: patientLine, description: "Every occupied bed in the room grid (the KAMAR blocks), one entry per patient." },
      dpjpTable: {
        type: "array",
        description: "The DPJP-grouped table, one item per doctor column, INCLUDING doctors with zero patients. The PDF lays this out in 3 columns per row; assign each entry to the correct column header.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["headerRaw", "dpjpCode", "entries"],
          properties: {
            headerRaw: { type: "string", description: "e.g. 'Prof. IM', 'dr AFG'." },
            dpjpCode: { type: "string", description: "Code only, e.g. 'IM'." },
            entries: { type: "array", items: patientLine },
          },
        },
      },
      chiefTally: {
        type: "array",
        description: "The chief tally footer lines, e.g. 'dr. Gabi 8'.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["lineRaw", "chiefRaw", "count"],
          properties: {
            lineRaw: { type: "string" },
            chiefRaw: { type: "string" },
            count: { type: ["integer", "null"], description: "Null if the name appears with no number." },
          },
        },
      },
      holderList: {
        type: "array",
        description: "Resident-grouped sections between '=====' separators, headed *Name*.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["residentHeaderRaw", "entries"],
          properties: {
            residentHeaderRaw: { type: "string" },
            entries: { type: "array", items: patientLine },
          },
        },
      },
      operkanKeTmnLain: { type: "array", items: { type: "string" }, description: "Lines under 'Operkan ke Tmn Lain:', verbatim. Empty if none." },
      gantiChief: { type: "array", items: { type: "string" }, description: "Lines under 'Ganti Chief:', verbatim. Empty if none." },
      tidakDiFU: {
        type: "object",
        additionalProperties: false,
        required: ["present", "entries"],
        properties: {
          present: { type: "boolean", description: "False if the '*Tidak di FU*' footer does not appear at all." },
          entries: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["categoryRaw", "count"],
              properties: { categoryRaw: { type: "string" }, count: { type: ["integer", "null"] } },
            },
          },
        },
      },
      selfCheck: {
        type: "object",
        additionalProperties: false,
        required: ["roomGridPatientCount", "dpjpTableEntryCount", "holderListEntryCount"],
        description: "Count your OWN arrays above, as a transcription check. These are not the document's printed totals.",
        properties: {
          roomGridPatientCount: { type: "integer" },
          dpjpTableEntryCount: { type: "integer" },
          holderListEntryCount: { type: "integer" },
        },
      },
      extractionNotes: { type: "array", items: { type: "string" }, description: "Anything unreadable, ambiguous, or that you could not place. Empty if none." },
    },
  },
} as const;

// ───────────────────────────────────────────────────────────────
// 4. LIST_PASIEN TOOL SCHEMA
// ───────────────────────────────────────────────────────────────
export const LIST_TOOL = {
  name: "record_list_pasien",
  description: "Record the verbatim structured transcription of a LIST PASIEN document.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["documentType", "shiftDateRaw", "shiftDateIso", "header", "sections", "selfCheck", "extractionNotes"],
    properties: {
      documentType: { type: "string", enum: ["DENAH", "LIST_PASIEN", "UNKNOWN"] },
      shiftDateRaw: { type: ["string", "null"], description: "e.g. 'Senin, 31-08-2026 05.00 WITA'." },
      shiftDateIso: { type: ["string", "null"] },
      header: {
        type: "object",
        additionalProperties: false,
        required: ["jumlahPasien", "kardio", "kjsBtkv", "kjsTsLain", "pediatri", "pediKjs", "perDpjp"],
        description: "The summary block at the top, with numbers EXACTLY as printed.",
        properties: {
          jumlahPasien: { type: ["integer", "null"] },
          kardio: { type: ["integer", "null"] },
          kjsBtkv: { type: ["integer", "null"] },
          kjsTsLain: { type: ["integer", "null"] },
          pediatri: { type: ["integer", "null"] },
          pediKjs: { type: ["integer", "null"] },
          perDpjp: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["lineRaw", "dpjpCode", "count"],
              properties: { lineRaw: { type: "string" }, dpjpCode: { type: "string" }, count: { type: ["integer", "null"] } },
            },
          },
        },
      },
      sections: {
        type: "array",
        description: "Each DPJP detail section in document order, INCLUDING '0 pasien' sections.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["headingRaw", "dpjpCode", "headingCount", "entries"],
          properties: {
            headingRaw: { type: "string", description: "e.g. '*🫀 DPJP Prof. IM : 4 pasien*'." },
            dpjpCode: { type: "string" },
            headingCount: { type: ["integer", "null"], description: "The number printed in the heading." },
            entries: {
              type: "array",
              items: {
                ...patientLine,
                required: [...patientLine.required, "hasClinicalDetail"],
                properties: {
                  ...patientLine.properties,
                  hasClinicalDetail: { type: "boolean", description: "True if a Diagnosis/Terapi/Plan block follows this patient line." },
                },
              },
            },
          },
        },
      },
      selfCheck: {
        type: "object",
        additionalProperties: false,
        required: ["headerPerDpjpLineCount", "bodyEntryCount"],
        description: "Count your OWN arrays above.",
        properties: {
          headerPerDpjpLineCount: { type: "integer" },
          bodyEntryCount: { type: "integer" },
        },
      },
      extractionNotes: { type: "array", items: { type: "string" } },
    },
  },
} as const;

// ───────────────────────────────────────────────────────────────
// 5. SYSTEM PROMPT
// ───────────────────────────────────────────────────────────────
export function buildSystemPrompt(docKind: "DENAH" | "LIST_PASIEN"): string {
  return `You are a precise clinical-document TRANSCRIBER for a cardiology ward (PJT Lantai 4) in an Indonesian teaching hospital. You convert one shift document into structured JSON by calling the provided tool exactly once.

# Your only job: transcribe, never correct
- Record what is WRITTEN, including errors. A separate program checks for mistakes; if you fix them, it cannot find them.
- Never recompute or "fix" a printed count. If the header says 16 and there are 17 patients, record 16.
- Never replace a stale or odd name with the one you think is right. 'Gaby', 'Gabriel' and 'dr. dr. Miranti' stay as written (chiefRaw 'Gaby', 'Gabriel', 'dr. Miranti').
- Never invent missing data. Use null for absent fields and [] for absent lists.
- Do not skip patients because they look like duplicates. The same patient legitimately appears in several sections.
- Do not transcribe diagnosis, therapy or plan text.

# Document conventions
- Language is Bahasa Indonesia, with WhatsApp formatting (*bold*, emoji).
- Patient line grammar (field order and separators vary):
  [room] [bed N]/[DPJP]/[Title Name]/[DOB]/[Age]/RM [number] [(TAG)] - dr. [Resident] / dr. [Chief]
  - The room/bed prefix is absent inside room-grid KAMAR blocks (take room from the block, bed from the list number).
  - The separator between resident and chief may be '/' or ' - '.
  - Pediatric and NP patients often have NO trailing doctor pair; that is expected, so use null.
  - Typos to tolerate: 'be 3' = bed 3, 'bed2' = bed 2, 'I404M' = room 404 + DPJP IM, RM without the 'RM' label, blank age '/ /'.
  - Stray digits fused to list numbers or text ('11.', '3Plan:', '1- Ebstein') are cosmetic. Record the entryNumberRaw exactly as written.
- DPJP is the attending doctor code (first token of the patient string). Strip 'dr.'/'Prof.' for dpjpCode.
- Disposition notations: 'Operkan', 'Operkan ke Tmn Lain', 'Pindah CVCU', 'LEPAS RAWAT', incoming transfer 'dr. X -> [resident]'.

# Known roster (for flagging unknownNames only; do NOT normalise to it)
- DPJP codes: ${ROSTER.dpjpCodes.join(", ")}
- Residents: ${ROSTER.residents.join(", ")}
- Chiefs: ${ROSTER.chiefs.join(", ")}

${docKind === "DENAH" ? DENAH_NOTES : LIST_NOTES}

# Before calling the tool
1. Walk the whole document top to bottom once more.
2. Confirm every patient line in every section is captured.
3. Fill selfCheck by counting YOUR arrays.
4. Put anything uncertain in extractionNotes rather than guessing silently.
If the document is not the expected type, set documentType accordingly and transcribe what you can.`;
}

const DENAH_NOTES = `# DENAH structure (expected type: DENAH)
The document has these parts, in order:
1. ROOM GRID: 'KAMAR <n>' blocks with numbered bed slots. Empty slots appear as a bare number ('3.'). Record every block in roomBlocks; record occupied beds in roomGrid.
2. DPJP TABLE: doctor-headed columns laid out THREE PER ROW (e.g. 'dr. KS | dr. PT | dr. AHA'). Text extraction merges the columns. Use the visual layout to assign each entry to the correct column. A '1.' with nothing after it means that column is empty. Include every column, even empty ones.
3. CHIEF TALLY: lines like 'dr. Gabi 8' / 'dr. Arya 8' near the legend 'Merah H1–Hijau Pulang Hari ini'. The number may be missing; record null.
4. HOLDER LIST: sections between '=================================' lines, headed '*ResidentName*'.
5. FOOTERS: 'Operkan ke Tmn Lain:', 'Ganti Chief:', '*Tidak di FU*' followed by lines like 'YP 0' / 'AAU 1'. If the Tidak di FU footer is missing entirely, set present=false.`;

const LIST_NOTES = `# LIST_PASIEN structure (expected type: LIST_PASIEN)
1. Title line with day, date and '05.00 WITA'.
2. HEADER: 'JUMLAH PASIEN', 'KARDIO : LT 4 (n)', 'KJS BTKV: LT 4 (n)', 'KJS TS Lain : LT 4 (n)', 'PEDIATRI : LT 4 (n) PEDI KJS(n)', then one line per DPJP ('🫀 dr. KS : 1 Pasien'). Record the number inside the parentheses for the LT 4 lines.
3. BODY: sections headed like '*🫀 dr. ZD : 4 pasien*' or '*🫀DPJP dr. AHN : 3 Pasien*', separated by dashed lines. Each numbered patient line starts an entry, followed by Diagnosis/Terapi/Plan and possibly consultant (TS ...) blocks. Only the patient line is transcribed; set hasClinicalDetail accordingly.
4. A section with '0 pasien' still gets an item, with entries [].
5. Ignore the closing legend ('Ket:', emoji key, 'Tabe terima kasih dokter') and a trailing page number.`;
