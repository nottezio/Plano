import { formatDmy } from '@/domain/dateDmy';
import { planRooms, type DenahRoomSlot, type WardPlan } from '@/domain/denahPlan';
import { inlineRuns } from '@/domain/format/soapDocx';
import { placeBeds } from './beds';
import { byRoute, dpjpCodeOf, dpjpTitle, isPediatri, LIST_DPJP_ORDER, PEDIATRI_DPJP_IDS } from './build';
import { planLayout, type RoomCell } from './layout';
import { MARK_COLORS, printedTags } from './marks';
import type { FloorPatient } from './report';
import { residentGroups } from './residents';
import { handoverLine } from './docx';

/**
 * Denah + List as ONE printable page (13.12, Avi: "export both as a single
 * PDF"). The browser's own print → "Save as PDF" makes the file: no PDF
 * library, the same on a phone and a laptop. The content is the Word denah's
 * (floor plan, DPJP tables, residents table) followed by the list message in
 * four columns on a landscape page (CSS named page `listpage`, 2026-10-14),
 * filled top to bottom like a newspaper (`column-fill: auto`): the browser
 * otherwise BALANCES the last page, spreading its text evenly over all four
 * columns,
 * as the Word list. Colours as on paper: red H-1, green
 * pulang, amber pediatri code; only tags marked for print. The SOAP-update
 * marks are screen-only and never here.
 */

const esc = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const RED = '#ff0000';
const GREEN = '#00b050';
const AMBER = '#ffc000';
const GREY = '#7f7f7f';
const hex = (docx: string): string => `#${docx.toLowerCase()}`;

export function patientHtml(patient: FloorPatient, options: { number?: number | undefined; place?: boolean } = {}): string {
  const color = patient.discharge === 'tomorrow' ? RED : patient.discharge === 'today' ? GREEN : '';
  const style = color ? ` style="color:${color}"` : '';
  const code = dpjpCodeOf(patient);
  const place = options.place !== false && patient.room ? `${patient.room}${patient.bed ? ` Bed ${patient.bed}` : ''}/` : '';
  const residents = [patient.junior, patient.chief].filter(Boolean).map((n) => `dr. ${n}`).join(' / ');
  const codeHtml = code ? (isPediatri(patient.dpjpId) ? `<span style="color:${AMBER}">${esc(code)}</span>/` : `${esc(code)}/`) : '';
  const tags = printedTags(patient.tags)
    .map((t) => ` <b style="color:${hex(MARK_COLORS[t.color].docx)}">[${esc(t.label)}]</b>`)
    .join('');
  return (
    `<span${style}>${options.number !== undefined ? `${options.number}. ` : ''}${esc(place)}${codeHtml}${esc(patient.identity)}` +
    `${patient.btkv ? ' <b>(KJS BTKV)</b>' : ''}</span>${residents ? ` <b>- ${esc(residents)}</b>` : ''}${tags}`
  );
}

const line = (html: string): string => `<div class="p">${html}</div>`;

function roomHtml(slot: DenahRoomSlot, patients: readonly FloorPatient[]): string {
  const { beds, loose } = placeBeds(slot, patients);
  return (
    `<div class="room">KAMAR ${esc(slot.room)}${slot.subtitle ? `<br>${esc(slot.subtitle)}` : ''}</div>` +
    beds.map((p, i) => line(p ? patientHtml(p, { number: i + 1, place: false }) : `${i + 1}.`)).join('') +
    loose.map((p) => line(patientHtml(p, { place: false }))).join('')
  );
}

function floorHtml(plan: WardPlan, ward: string, inRoom: (room: string) => FloorPatient[]): string {
  const layout = planLayout(plan);
  const header = plan.header
    .map((slot) => `<td colspan="2">${roomHtml(slot, inRoom(slot.room))}</td>`)
    .join('');
  const cell = (cells: readonly RoomCell[], i: number, span = 1): string => {
    const found = cells.find((c) => c.row === i);
    if (found) return `<td${span > 1 ? ` colspan="${span}"` : ''}${found.span > 1 ? ` rowspan="${found.span}"` : ''}>${roomHtml(found.slot, inRoom(found.slot.room))}</td>`;
    // Covered by a room above that spans rows: no cell.
    if (cells.some((c) => i > c.row && i < c.row + c.span)) return '';
    return `<td${span > 1 ? ` colspan="${span}"` : ''}></td>`;
  };
  const rows: string[] = [];
  for (let i = 0; i < layout.rows; i += 1) {
    const mark = layout.landmark;
    let centre: string;
    if (mark && i === mark.row) {
      centre = `<td colspan="2" rowspan="${mark.span}" class="landmark">${esc(mark.label)}<br>${esc(ward.toUpperCase())}</td>`;
    } else if (mark && i > mark.row && i < mark.row + mark.span) centre = '';
    else centre = cell(layout.centre, i, 2);
    rows.push(`<tr>${cell(layout.left, i)}${centre}${cell(layout.right, i)}</tr>`);
  }
  return `<table class="plan"><colgroup><col style="width:39%"><col style="width:11%"><col style="width:11%"><col style="width:39%"></colgroup>${header ? `<tr>${header}</tr>` : ''}${rows.join('')}</table>`;
}

function dpjpHtml(sorted: readonly FloorPatient[]): string {
  const extra = [...new Set(sorted.map((p) => p.dpjpId).filter((id): id is string => !!id))].filter(
    (id) => !(LIST_DPJP_ORDER as readonly string[]).includes(id) && !isPediatri(id),
  );
  const order = [...LIST_DPJP_ORDER, ...extra, ...PEDIATRI_DPJP_IDS];
  const boxes = order.map((id) => {
    const own = sorted.filter((p) => p.dpjpId === id);
    const kjs = sorted.filter((p) => p.kjsDpjpIds.includes(id));
    const body =
      (own.length > 0 ? own.map((p, n) => line(patientHtml(p, { number: n + 1 }))).join('') : line('1.')) +
      (kjs.length > 0
        ? line('<b>KJS:</b>') +
          kjs
            .map((p, n) =>
              line(
                p.dpjpId
                  ? `<span style="color:${GREY}">${n + 1}. ${esc(p.room)}${p.bed ? ` Bed ${esc(p.bed)}` : ''}/${esc(p.name)} → ${esc(dpjpCodeOf(p))}</span>`
                  : patientHtml(p, { number: n + 1 }),
              ),
            )
            .join('')
        : '');
    return `<td><div class="head">${esc(dpjpTitle(id))}</div>${body}</td>`;
  });
  return grid(boxes);
}

/** Cells three to a row. */
function grid(cells: readonly string[]): string {
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 3) {
    const row = cells.slice(i, i + 3);
    while (row.length < 3) row.push('<td></td>');
    rows.push(`<tr>${row.join('')}</tr>`);
  }
  return `<table class="grid">${rows.join('')}</table>`;
}

function residentsHtml(sorted: readonly FloorPatient[]): string {
  const { chiefs, juniors, divisions } = residentGroups(sorted);
  const held = new Set(divisions.map(([name]) => name));
  const cells = [...juniors, ...divisions].map(
    ([name, list]) =>
      `<td><div class="holder">${esc(name)} (${list.length}${held.has(name) ? ', tidak di-FU' : ''})</div>${list.map((p, n) => line(patientHtml(p, { number: n + 1 }))).join('')}</td>`,
  );
  return (
    chiefs.map(([name, n]) => line(`dr. ${esc(name)}&nbsp;&nbsp;${n}`)).join('') +
    grid(cells) +
    handoverHtml(sorted)
  );
}

/** "Operkan ke Tmn Lain" and "Ganti Chief" as two boxes, from the patients' notes (13.14). */
function handoverHtml(sorted: readonly FloorPatient[]): string {
  const box = (title: string, lines: string[]): string =>
    `<td><div class="holder">${title}</div>${lines.map((l) => line(esc(l))).join('')}<div class="gap"></div></td>`;
  const operkan = sorted.filter((p) => p.operkan).map((p, n) => handoverLine(p, p.operkan!, n + 1));
  const ganti = sorted.filter((p) => p.gantiChief).map((p, n) => handoverLine(p, p.gantiChief!, n + 1));
  return `<table class="grid"><tr>${box('Operkan ke Tmn Lain:', operkan)}${box('Ganti Chief:', ganti)}</tr></table>`;
}

function listHtml(text: string): string {
  return text
    .split('\n')
    .map((raw) => (raw.trim() ? line(inlineRuns(raw).map((r) => (r.bold ? `<b>${esc(r.text)}</b>` : esc(r.text))).join('')) : '<div class="blank"></div>'))
    .join('');
}

export interface PrintInput {
  ward: string;
  date: string;
  plan: WardPlan | null;
  patients: readonly FloorPatient[];
  /** The list message as copied. */
  listText: string;
}

export function denahListHtml(input: PrintInput): string {
  const sorted = [...input.patients].sort(byRoute(input.ward));
  const known = new Set(input.plan ? planRooms(input.plan).map((s) => s.room) : []);
  const inRoom = (room: string): FloorPatient[] => sorted.filter((p) => p.room === room);
  const strays = sorted.filter((p) => !known.has(p.room));
  const title = `DENAH PASIEN ${input.ward.replace(/^PJT\s+/i, '').toUpperCase()} (${formatDmy(input.date)})`;
  const legendTags = [...new Map(sorted.flatMap((p) => printedTags(p.tags)).map((t) => [t.label, t])).values()]
    .map((t) => ` – <span style="color:${hex(MARK_COLORS[t.color].docx)}">${esc(t.label)}</span>`)
    .join('');
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(`Denah dan List ${input.ward} ${input.date}`)}</title><style>
@page { size: A4; margin: 10mm; }
@page listpage { size: A4 landscape; margin: 8mm; }
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 7.5pt; color: #000; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1 { font-size: 9pt; margin: 0 0 4px; }
table { border-collapse: collapse; width: 100%; table-layout: fixed; margin-bottom: 6px; }
td { border: 0.75pt solid #000; vertical-align: top; padding: 2px 4px; }
tr { page-break-inside: avoid; break-inside: avoid; }
.room, .head { font-weight: bold; text-align: center; margin-bottom: 2px; }
.holder { font-weight: bold; font-size: 10pt; margin-bottom: 2px; }
.landmark { background: #ffc000; font-weight: bold; text-align: center; vertical-align: middle; }
.p { margin: 0 0 1px; }
.blank { height: 6px; }
.gap { height: 24px; }
.page { break-before: page; page-break-before: always; }
.list { page: listpage; columns: 4; column-gap: 6mm; column-fill: auto; font-size: 6.5pt; }
.legend { margin-top: 4px; }
</style></head><body>
<h1>${esc(title)}</h1>
${input.plan ? floorHtml(input.plan, input.ward, inRoom) : ''}
${strays.length > 0 ? line(`<b>${input.plan ? 'Di luar denah:' : `Pasien ${esc(input.ward)}:`}</b>`) + strays.map((p, n) => line(patientHtml(p, { number: n + 1 }))).join('') : ''}
${dpjpHtml(sorted)}
<div class="legend"><span style="color:${RED}">Merah</span> H-1 – <span style="color:${GREEN}">Hijau</span> Pulang Hari ini${legendTags}.</div>
<div class="page">${residentsHtml(sorted)}</div>
<div class="page list">${listHtml(input.listText)}</div>
</body></html>`;
}
