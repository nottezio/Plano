import { formatDmy } from '@/domain/dateDmy';
import { planRooms, type DenahRoomSlot, type WardPlan } from '@/domain/denahPlan';
import { escapeXml, inlineRuns, DOCX_MIME, type Run } from '@/domain/format/soapDocx';
import { storeZip } from '@/lib/zip';
import { placeBeds } from './beds';
import { planLayout, type RoomCell } from './layout';
import { byRoute, dpjpCodeOf, dpjpTitle, isPediatri, LIST_DPJP_ORDER, PEDIATRI_DPJP_IDS } from './build';
import { MARK_COLORS, printedTags } from './marks';
import { residentGroups } from './residents';
import type { FloorPatient } from './report';

/**
 * List Maker → Word (12.9), laid out like Avi's printed LIST and DENAH
 * (31-08-2026): A4, Arial, small type, black text.
 *
 * - LIST: the List Pasien message in three newspaper columns; `*bold*` →
 *   bold; page number at the foot.
 * - DENAH: page 1 the floor plan as one table (420 | 421 across the top,
 *   then left rooms | nurse station / 411 | right rooms), then the DPJP tables
 *   three to a row; page 2 the chief counts and the juniors' blocks, then
 *   "Operkan ke Tmn Lain" and "Ganti Chief" to fill in by hand. Red = H-1,
 *   green = pulang hari ini, the pediatri DPJP code amber; the legend is in
 *   the footer of every page.
 *
 * Hand-written WordprocessingML in a stored ZIP, as `soapDocx`: no library.
 */

export { DOCX_MIME };

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const PAGE = { width: 11906, height: 16838 };
const RED = 'FF0000';
const GREEN = '00B050';
const AMBER = 'FFC000';
const GREY = '7F7F7F';
const ORANGE_FILL = 'FFC000';

interface Styled {
  text: string;
  bold?: boolean;
  color?: string;
}

function run({ text, bold, color }: Styled): string {
  if (!text) return '';
  const props = `${bold ? '<w:b/><w:bCs/>' : ''}${color ? `<w:color w:val="${color}"/>` : ''}`;
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function para(runs: readonly Styled[], options: { center?: boolean; pageBreakBefore?: boolean } = {}): string {
  const pPr = `${options.pageBreakBefore ? '<w:pageBreakBefore/>' : ''}${options.center ? '<w:jc w:val="center"/>' : ''}`;
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${runs.map(run).join('')}</w:p>`;
}

const fromRuns = (runs: readonly Run[]): Styled[] => runs.map((r) => ({ text: r.text, ...(r.bold ? { bold: true } : {}) }));

/**
 * One patient as styled runs: colour for H-1/pulang, amber pediatri code, bold
 * residents, then the floor's tags each in its own colour (13.10: a tag never
 * colours the identity).
 */
export function patientRuns(patient: FloorPatient, options: { number?: number | undefined; place?: boolean } = {}): Styled[] {
  const color = patient.discharge === 'tomorrow' ? RED : patient.discharge === 'today' ? GREEN : undefined;
  const tint = (s: Styled): Styled => (color ? { ...s, color } : s);
  const code = dpjpCodeOf(patient);
  const place = options.place !== false && patient.room ? `${patient.room}${patient.bed ? ` Bed ${patient.bed}` : ''}/` : '';
  const residents = [patient.junior, patient.chief].filter(Boolean).map((n) => `dr. ${n}`).join(' / ');
  const out: Styled[] = [tint({ text: `${options.number !== undefined ? `${options.number}. ` : ''}${place}` })];
  if (code) out.push(isPediatri(patient.dpjpId) ? { text: code, color: AMBER } : tint({ text: code }), tint({ text: '/' }));
  out.push(tint({ text: patient.identity }));
  if (patient.btkv) out.push(tint({ text: ' (KJS BTKV)', bold: true }));
  if (residents) out.push({ text: ` - ${residents}`, bold: true });
  for (const tag of printedTags(patient.tags)) out.push({ text: ` [${tag.label}]`, bold: true, color: MARK_COLORS[tag.color].docx });
  return out;
}

/**
 * A KJS patient filed under another DPJP (13.10, Avi: the same patient in two
 * DPJP boxes): a short grey reference to where the full line is.
 */
export function kjsReferenceRuns(patient: FloorPatient, number: number): Styled[] {
  const place = patient.room ? `${patient.room}${patient.bed ? ` Bed ${patient.bed}` : ''}/` : '';
  return [{ text: `${number}. ${place}${patient.name} → ${dpjpCodeOf(patient)}`, color: GREY }];
}

// ── package ────────────────────────────────────────────────────────────────

function styles(size: number): string {
  return (
    `${HEAD}<w:styles xmlns:w="${W_NS}"><w:docDefaults><w:rPrDefault><w:rPr>` +
    `<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>` +
    `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/><w:lang w:val="id-ID" w:eastAsia="id-ID" w:bidi="ar-SA"/>` +
    `</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>` +
    `<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblCellMar>` +
    `<w:top w:w="28" w:type="dxa"/><w:left w:w="85" w:type="dxa"/><w:bottom w:w="28" w:type="dxa"/><w:right w:w="85" w:type="dxa"/>` +
    `</w:tblCellMar></w:tblPr></w:style></w:styles>`
  );
}

const CONTENT_TYPES =
  `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
  `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
  `<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>` +
  `</Types>`;

const ROOT_RELS =
  `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
  `</Relationships>`;

const DOCUMENT_RELS =
  `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
  `<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>` +
  `</Relationships>`;

function footer(content: string): string {
  return `${HEAD}<w:ftr xmlns:w="${W_NS}" xmlns:r="${R_NS}">${content}</w:ftr>`;
}

function documentXml(body: string, margins: { top: number; side: number; bottom: number }, columns = 1): string {
  return (
    `${HEAD}<w:document xmlns:w="${W_NS}" xmlns:r="${R_NS}"><w:body>${body}` +
    `<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/>` +
    `<w:pgSz w:w="${PAGE.width}" w:h="${PAGE.height}"/>` +
    `<w:pgMar w:top="${margins.top}" w:right="${margins.side}" w:bottom="${margins.bottom}" w:left="${margins.side}" w:header="400" w:footer="400" w:gutter="0"/>` +
    (columns > 1 ? `<w:cols w:num="${columns}" w:space="425"/>` : '') +
    `</w:sectPr></w:body></w:document>`
  );
}

function pack(document: string, footerXml: string, size: number): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  return storeZip(
    [
      { name: '[Content_Types].xml', xml: CONTENT_TYPES },
      { name: '_rels/.rels', xml: ROOT_RELS },
      { name: 'word/document.xml', xml: document },
      { name: 'word/_rels/document.xml.rels', xml: DOCUMENT_RELS },
      { name: 'word/styles.xml', xml: styles(size) },
      { name: 'word/footer1.xml', xml: footerXml },
    ].map((part) => ({ name: part.name, data: enc.encode(part.xml) })),
  );
}

// ── LIST ───────────────────────────────────────────────────────────────────

/** The List Pasien message (from `buildFloorList`) as the 3-column printout. */
export function listDocumentXml(text: string): string {
  const body = text
    .split('\n')
    .map((line) => (line.trim() ? para(fromRuns(inlineRuns(line))) : '<w:p/>'))
    .join('');
  return documentXml(body, { top: 1000, side: 1000, bottom: 900 }, 3);
}

export function buildListDocx(text: string): Uint8Array<ArrayBuffer> {
  const pageNumber = `<w:p><w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p>`;
  return pack(listDocumentXml(text), footer(pageNumber), 15);
}

// ── DENAH ──────────────────────────────────────────────────────────────────

const BORDERS =
  '<w:tblBorders>' +
  ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((side) => `<w:${side} w:val="single" w:sz="6" w:space="0" w:color="000000"/>`).join('') +
  '</w:tblBorders>';

interface Cell {
  width: number;
  content: string;
  span?: number;
  vMerge?: 'restart' | 'continue';
  fill?: string;
  vCenter?: boolean;
}

function cellXml(cell: Cell): string {
  const tcPr =
    `<w:tcW w:w="${cell.width}" w:type="dxa"/>` +
    (cell.span && cell.span > 1 ? `<w:gridSpan w:val="${cell.span}"/>` : '') +
    (cell.vMerge ? `<w:vMerge${cell.vMerge === 'restart' ? ' w:val="restart"' : ''}/>` : '') +
    (cell.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${cell.fill}"/>` : '') +
    (cell.vCenter ? '<w:vAlign w:val="center"/>' : '');
  // A cell must hold at least one paragraph.
  return `<w:tc><w:tcPr>${tcPr}</w:tcPr>${cell.content || '<w:p/>'}</w:tc>`;
}

function tableXml(grid: readonly number[], rows: readonly (readonly Cell[])[]): string {
  const width = grid.reduce((a, b) => a + b, 0);
  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${width}" w:type="dxa"/>${BORDERS}<w:tblLayout w:type="fixed"/></w:tblPr>` +
    `<w:tblGrid>${grid.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>` +
    rows.map((row) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${row.map(cellXml).join('')}</w:tr>`).join('') +
    `</w:tbl>`
  );
}

function roomContent(slot: DenahRoomSlot, patients: readonly FloorPatient[]): string {
  const { beds, loose } = placeBeds(slot, patients);
  return (
    para([{ text: `KAMAR ${slot.room}`, bold: true }], { center: true }) +
    (slot.subtitle ? para([{ text: slot.subtitle, bold: true }], { center: true }) : '') +
    beds.map((p, i) => (p ? para(patientRuns(p, { number: i + 1, place: false })) : para([{ text: `${i + 1}.` }]))).join('') +
    loose.map((p) => para(patientRuns(p, { place: false }))).join('')
  );
}

const TEXT_WIDTH = PAGE.width - 2 * 720;

function floorTable(plan: WardPlan, ward: string, inRoom: (room: string) => FloorPatient[]): string {
  // L | centre (two grid columns, so 420/421 can split the centre) | R.
  const sideWidth = Math.round(TEXT_WIDTH * 0.39);
  const half = Math.round((TEXT_WIDTH - 2 * sideWidth) / 2);
  const grid = [sideWidth, half, TEXT_WIDTH - 2 * sideWidth - half, sideWidth];
  const layout = planLayout(plan);

  const rows: Cell[][] = [];
  const header = plan.header;
  if (header.length > 0) {
    rows.push([
      { width: grid[0]! + grid[1]!, span: 2, content: header[0] ? roomContent(header[0], inRoom(header[0].room)) : '' },
      { width: grid[2]! + grid[3]!, span: 2, content: header[1] ? roomContent(header[1], inRoom(header[1].room)) : '' },
    ]);
  }

  /** The cell of one column at row i: its start (restart if it spans), a continuation, or empty. */
  const at = (cells: readonly RoomCell[], i: number, width: number, span = 1): Cell => {
    const cell = cells.find((c) => i >= c.row && i < c.row + c.span);
    if (!cell) return { width, span, content: '' };
    if (cell.row === i) {
      return { width, span, content: roomContent(cell.slot, inRoom(cell.slot.room)), ...(cell.span > 1 ? { vMerge: 'restart' as const } : {}) };
    }
    return { width, span, content: '', vMerge: 'continue' };
  };

  for (let i = 0; i < layout.rows; i += 1) {
    const centreWidth = grid[1]! + grid[2]!;
    const mark = layout.landmark;
    let centre: Cell;
    if (mark && i >= mark.row && i < mark.row + mark.span) {
      centre =
        i === mark.row
          ? {
              width: centreWidth,
              span: 2,
              fill: ORANGE_FILL,
              vCenter: true,
              ...(mark.span > 1 ? { vMerge: 'restart' as const } : {}),
              content: para([{ text: mark.label, bold: true }], { center: true }) + para([{ text: ward.toUpperCase(), bold: true }], { center: true }),
            }
          : { width: centreWidth, span: 2, content: '', vMerge: 'continue' };
    } else centre = at(layout.centre, i, centreWidth, 2);
    rows.push([at(layout.left, i, grid[0]!), centre, at(layout.right, i, grid[3]!)]);
  }
  return tableXml(grid, rows);
}

function dpjpTables(sorted: readonly FloorPatient[]): string {
  const extra = [...new Set(sorted.map((p) => p.dpjpId).filter((id): id is string => !!id))].filter(
    (id) => !(LIST_DPJP_ORDER as readonly string[]).includes(id) && !isPediatri(id),
  );
  const order = [...LIST_DPJP_ORDER, ...extra, ...PEDIATRI_DPJP_IDS];
  const third = Math.floor(TEXT_WIDTH / 3);
  const grid = [third, third, TEXT_WIDTH - 2 * third];
  const out: string[] = [];
  for (let i = 0; i < order.length; i += 3) {
    const ids = order.slice(i, i + 3);
    while (ids.length < 3) ids.push('');
    const head = ids.map((id, k) => ({ width: grid[k]!, content: id ? para([{ text: dpjpTitle(id), bold: true }], { center: true }) : '' }));
    const body = ids.map((id, k) => {
      if (!id) return { width: grid[k]!, content: '' };
      const own = sorted.filter((p) => p.dpjpId === id);
      const kjs = sorted.filter((p) => p.kjsDpjpIds.includes(id));
      const content =
        (own.length > 0 ? own.map((p, n) => para(patientRuns(p, { number: n + 1 }))).join('') : para([{ text: '1.' }])) +
        (kjs.length > 0
          ? para([{ text: 'KJS:', bold: true }]) +
            // Full line only when this box is the patient's only one (utama of another department).
            kjs.map((p, n) => para(p.dpjpId ? kjsReferenceRuns(p, n + 1) : patientRuns(p, { number: n + 1 }))).join('')
          : '');
      return { width: grid[k]!, content };
    });
    out.push(tableXml(grid, [head, body]), '<w:p/>');
  }
  return out.join('');
}

/** The residents' page: three juniors to a row, name on top, then each patient's line. */
function residentTables(juniors: ReadonlyArray<readonly [string, readonly FloorPatient[]]>, held: ReadonlySet<string>): string {
  const third = Math.floor(TEXT_WIDTH / 3);
  const grid = [third, third, TEXT_WIDTH - 2 * third];
  const rows: Cell[][] = [];
  for (let i = 0; i < juniors.length; i += 3) {
    const group = juniors.slice(i, i + 3);
    rows.push(
      grid.map((width, k) => {
        const entry = group[k];
        if (!entry) return { width, content: '' };
        const [name, list] = entry;
        // Numbered (13.9): how many each holds is read at a glance.
        const title = held.has(name) ? `${name} (${list.length}, tidak di-FU)` : `${name} (${list.length})`;
        return { width, content: para([{ text: title, bold: true }]) + list.map((p, n) => para(patientRuns(p, { number: n + 1 }))).join('') };
      }),
    );
  }
  return rows.length > 0 ? `${tableXml(grid, rows)}<w:p/>` : '';
}

export interface DenahDocInput {
  ward: string;
  date: string;
  plan: WardPlan | null;
  patients: readonly FloorPatient[];
}

export function denahDocumentXml(input: DenahDocInput): string {
  const sorted = [...input.patients].sort(byRoute(input.ward));
  const known = new Set(input.plan ? planRooms(input.plan).map((s) => s.room) : []);
  const inRoom = (room: string): FloorPatient[] => sorted.filter((p) => p.room === room);
  const strays = sorted.filter((p) => !known.has(p.room));
  const title = `DENAH PASIEN ${input.ward.replace(/^PJT\s+/i, '').toUpperCase()} (${formatDmy(input.date)})`;

  const parts: string[] = [para([{ text: title, bold: true }])];
  if (input.plan) parts.push(floorTable(input.plan, input.ward, inRoom), '<w:p/>');
  if (strays.length > 0) {
    parts.push(para([{ text: input.plan ? 'Di luar denah:' : `Pasien ${input.ward}:`, bold: true }]));
    strays.forEach((p, n) => parts.push(para(patientRuns(p, { number: n + 1 }))));
    parts.push('<w:p/>');
  }
  parts.push(dpjpTables(sorted));

  // Page 2: residents — a table of three columns, one cell per junior (13.7,
  // Avi: "a table, not a list", as the Residen cards in the app), with the
  // hand-filled blocks under it.
  const { chiefs, juniors, divisions } = residentGroups(sorted);
  const page2: string[] = chiefs.map(([name, n]) => para([{ text: `dr. ${name}  ${n}` }]));
  page2.push(residentTables([...juniors, ...divisions], new Set(divisions.map(([name]) => name))), para([{ text: 'Operkan ke Tmn Lain:', bold: true }]), '<w:p/>', '<w:p/>', para([{ text: '=====' }]), para([{ text: 'Ganti Chief:', bold: true }]));
  // Page 2 starts on a new page: the break goes on its first paragraph (the
  // chiefs line), or on an empty one before the table.
  const BREAK = '<w:p><w:pPr><w:pageBreakBefore/></w:pPr>';
  if (chiefs.length > 0) page2[0] = page2[0]!.replace('<w:p>', BREAK);
  else page2.unshift(`${BREAK}</w:p>`);
  parts.push(...page2);

  return documentXml(parts.join(''), { top: 288, side: 720, bottom: 720 });
}

export function buildDenahDocx(input: DenahDocInput): Uint8Array<ArrayBuffer> {
  // The floor's tags on this sheet, in their Word colours.
  const marks = [...new Map(input.patients.flatMap((p) => printedTags(p.tags)).map((t) => [t.label, t])).values()];
  const legend = para([
    { text: 'Merah', color: RED },
    { text: ' H-1 – ' },
    { text: 'Hijau', color: GREEN },
    { text: marks.length > 0 ? ' Pulang Hari ini' : ' Pulang Hari ini.' },
    ...marks.flatMap((m): Styled[] => [{ text: ' – ' }, { text: m.label, color: MARK_COLORS[m.color].docx }]),
    ...(marks.length > 0 ? [{ text: '.' }] : []),
  ]);
  return pack(denahDocumentXml(input), footer(legend), 15);
}

/** "List Pasien PJT Lantai 4 2026-10-12.docx", safe for Windows. */
export function floorFileName(kind: 'List Pasien' | 'Denah', ward: string, date: string): string {
  return `${kind} ${ward} ${date}.docx`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ');
}
