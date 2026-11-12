import { storeZip } from '@/lib/zip';
import { escapeXml, inlineRuns, type Run } from '@/domain/format/soapDocx';
import type { Deck, DeckPhoto, DeckSlide } from './deck';
import { FONT, GEOMETRY, PALETTE_B, SLIDE_W, geometryFor, slideHeight, type Rect } from './geometry';

/**
 * Slide MZ → .pptx, written by hand.
 *
 * Same reasoning as the Word export (`soapDocx.ts`): a presentation is a ZIP of
 * small XML parts, and a PPTX library would sit in the offline precache for one
 * screen. Every shape is placed absolutely (no placeholders), so a slide looks
 * the same whichever master or theme a viewer substitutes, and the positions are
 * exactly the measured ones in `geometry.ts`.
 *
 * Deterministic: same deck, same bytes (fixed timestamps, stable ids), which is
 * what makes the output testable.
 */

export const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/** Line under a boxed title, as in the reference theme (2.25 pt). */
const BOX_LINE_EMU = 28_575;
const ACCENT_BAR_EMU = 38_100;
const GRID_LINE_EMU = 9_525;

// ---------------------------------------------------------------------------
// Geometry helpers

/** Fit a photo inside its frame (contain, centred), unless the resident placed it. */
export function photoRect(photo: DeckPhoto, frame: Rect): Rect {
  if (photo.rect) return photo.rect;
  if (photo.widthPx <= 0 || photo.heightPx <= 0) return frame;
  const scale = Math.min(frame.w / photo.widthPx, frame.h / photo.heightPx);
  const w = Math.round(photo.widthPx * scale);
  const h = Math.round(photo.heightPx * scale);
  return { x: frame.x + Math.round((frame.w - w) / 2), y: frame.y + Math.round((frame.h - h) / 2), w, h };
}

const off = (r: Rect): string => `<a:off x="${r.x}" y="${r.y}"/><a:ext cx="${r.w}" cy="${r.h}"/>`;
const solid = (hex: string): string => `<a:solidFill><a:srgbClr val="${hex}"/></a:solidFill>`;
const pt100 = (pt: number): number => Math.round(pt * 100);

// ---------------------------------------------------------------------------
// Text

interface TextStyle {
  pt: number;
  color: string;
  bold?: boolean;
  caps?: boolean;
  align?: 'l' | 'ctr';
}

function runXml(run: Run, style: TextStyle): string {
  const attrs = [
    'lang="id-ID"',
    `sz="${pt100(style.pt)}"`,
    style.bold || run.bold ? 'b="1"' : '',
    run.italic ? 'i="1"' : '',
    run.strike ? 'strike="sngStrike"' : '',
    style.caps ? 'cap="all"' : '',
    'dirty="0"',
  ].filter(Boolean);
  return (
    `<a:r><a:rPr ${attrs.join(' ')}>${solid(style.color)}` +
    `<a:latin typeface="${FONT}"/><a:cs typeface="${FONT}"/></a:rPr>` +
    `<a:t>${escapeXml(run.text)}</a:t></a:r>`
  );
}

function paragraphXml(runs: readonly Run[], style: TextStyle): string {
  const pPr = style.align === 'ctr' ? '<a:pPr algn="ctr"/>' : '';
  const end = `<a:endParaRPr lang="id-ID" sz="${pt100(style.pt)}" dirty="0"/>`;
  const content = runs.filter((run) => run.text.length > 0).map((run) => runXml(run, style)).join('');
  return `<a:p>${pPr}${content}${end}</a:p>`;
}

/**
 * A main SOAP heading on its own line (`S :`, `O:`, `Diagnosis:`, `Terapi:`, `Plan`): drawn bold in
 * the section colour. Sub-labels (`Faktor Risiko Kardiovaskular :`) stay plain (owner, 2026-11-13).
 */
export function isSectionLabel(line: string): boolean {
  return /^[*_\s]*(?:S|O|A|P|Assessment|Diagnosis|Diagnosa|Terapi|Plan|Planning)\s*:?[*_\s]*$/i.test(line);
}

/** A note's lines as paragraphs: markers become formatting, nothing is reworded. */
function noteParagraphs(text: string, pt: number, align: 'l' | 'ctr' = 'l'): string {
  return text
    .split('\n')
    .map((line) =>
      isSectionLabel(line)
        ? paragraphXml([{ text: line }], { pt, color: PALETTE_B.sec, bold: true, align })
        : paragraphXml(inlineRuns(line), { pt, color: PALETTE_B.ink, align }),
    )
    .join('');
}

function plainParagraphs(lines: readonly string[], style: TextStyle): string {
  // A txBody must hold at least one paragraph.
  return (lines.length ? lines : ['']).map((line) => paragraphXml([{ text: line }], style)).join('');
}

function txBody(paragraphs: string, anchor: 't' | 'ctr', autofit = false): string {
  return (
    `<p:txBody><a:bodyPr wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720" anchor="${anchor}" rtlCol="0">` +
    `${autofit ? '<a:normAutofit/>' : '<a:noAutofit/>'}</a:bodyPr><a:lstStyle/>${paragraphs}</p:txBody>`
  );
}

// ---------------------------------------------------------------------------
// Shapes

class Ids {
  private next = 2;
  take(): number {
    const id = this.next;
    this.next += 1;
    return id;
  }
}

function shape(
  ids: Ids,
  name: string,
  rect: Rect,
  opts: { fill?: string; line?: { hex: string; w: number }; body?: string },
): string {
  const fill = opts.fill ? solid(opts.fill) : '<a:noFill/>';
  const line = opts.line ? `<a:ln w="${opts.line.w}">${solid(opts.line.hex)}</a:ln>` : '<a:ln><a:noFill/></a:ln>';
  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${ids.take()}" name="${escapeXml(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm>${off(rect)}</a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fill}${line}</p:spPr>` +
    `${opts.body ?? txBody('<a:p><a:endParaRPr lang="id-ID" dirty="0"/></a:p>', 'ctr')}</p:sp>`
  );
}

/** The framed caps title of the reference theme, with Palette B's short accent bar under it. */
function boxedTitle(ids: Ids, rect: Rect, lines: readonly string[], pt: number, bold = false): string {
  const body = txBody(plainParagraphs(lines, { pt, color: PALETTE_B.ink, caps: true, bold, align: 'ctr' }), 'ctr', true);
  const barW = Math.round(rect.w * 0.22);
  const bar: Rect = {
    x: rect.x + Math.round((rect.w - barW) / 2),
    y: rect.y + rect.h - Math.round(ACCENT_BAR_EMU / 2),
    w: barW,
    h: ACCENT_BAR_EMU,
  };
  return (
    shape(ids, 'Title', rect, { fill: PALETTE_B.boxFill, line: { hex: PALETTE_B.boxLine, w: BOX_LINE_EMU }, body }) +
    shape(ids, 'Accent', bar, { fill: PALETTE_B.accent })
  );
}

function picture(ids: Ids, relId: string, rect: Rect): string {
  const id = ids.take();
  return (
    `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Picture ${id}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>` +
    `<p:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
    `<p:spPr><a:xfrm>${off(rect)}</a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
    '<a:effectLst><a:outerShdw blurRad="76200" dist="25400" dir="5400000" algn="t" rotWithShape="0">' +
    '<a:srgbClr val="000000"><a:alpha val="18000"/></a:srgbClr></a:outerShdw></a:effectLst></p:spPr></p:pic>'
  );
}

interface Cell {
  paragraphs: string;
  fill: string;
}

function cellXml(cell: Cell, anchor: 't' | 'ctr' = 't'): string {
  const border = (tag: string): string => `<a:${tag} w="${GRID_LINE_EMU}">${solid(PALETTE_B.grid)}</a:${tag}>`;
  return (
    `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>${cell.paragraphs}</a:txBody>` +
    `<a:tcPr marL="91440" marR="91440" marT="45720" marB="45720" anchor="${anchor}">` +
    `${border('lnL')}${border('lnR')}${border('lnT')}${border('lnB')}${solid(cell.fill)}</a:tcPr></a:tc>`
  );
}

function table(
  ids: Ids,
  name: string,
  rect: Rect,
  columns: readonly number[],
  rows: ReadonlyArray<{ h: number; cells: readonly string[] }>,
): string {
  const grid = columns.map((w) => `<a:gridCol w="${w}"/>`).join('');
  const body = rows.map((row) => `<a:tr h="${row.h}">${row.cells.join('')}</a:tr>`).join('');
  return (
    `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${ids.take()}" name="${name}"/>` +
    '<p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>' +
    `<p:xfrm>${off(rect)}</p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">` +
    `<a:tbl><a:tblPr firstRow="1" bandRow="1"/><a:tblGrid>${grid}</a:tblGrid>${body}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`
  );
}

const headerCell = (text: string, pt: number): string =>
  cellXml({ paragraphs: paragraphXml([{ text }], { pt, color: 'FFFFFF', align: 'ctr' }), fill: PALETTE_B.head }, 'ctr');

// ---------------------------------------------------------------------------
// Slides

interface Media {
  name: string;
  data: Uint8Array;
}

interface BuiltSlide {
  xml: string;
  /** Relationship id → target (relative to ppt/slides/). rId1 is always the layout. */
  rels: Array<{ id: string; type: string; target: string }>;
}

const gradientBg =
  `<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:srgbClr val="${PALETTE_B.titleBgFrom}"/></a:gs>` +
  `<a:gs pos="100000"><a:srgbClr val="${PALETTE_B.titleBgTo}"/></a:gs></a:gsLst><a:lin ang="2700000" scaled="0"/></a:gradFill>`;

function slideXml(background: string, shapes: string): string {
  return (
    `${XML_HEAD}<p:sld xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld>` +
    `<p:bg><p:bgPr>${background}<a:effectLst/></p:bgPr></p:bg><p:spTree>` +
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
    `${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
  );
}

const LAYOUT_REL = { id: 'rId1', type: `${REL}/slideLayout`, target: '../slideLayouts/slideLayout1.xml' };

function buildSlide(slide: DeckSlide, media: Media[], geo: typeof GEOMETRY, slideH: number): BuiltSlide {
  const ids = new Ids();
  const rels: BuiltSlide['rels'] = [LAYOUT_REL];
  const plainBg = solid(PALETTE_B.bg);

  switch (slide.kind) {
    case 'title': {
      const sub = shape(ids, 'Subtitle', geo.titleSub, {
        body: txBody(plainParagraphs([slide.subtitle], { pt: 18, color: PALETTE_B.subInk, align: 'ctr' }), 't', true),
      });
      return { xml: slideXml(gradientBg, boxedTitle(ids, geo.titleBox, slide.heading, 32, true) + sub), rels };
    }

    case 'soap': {
      const [c1, c2, c3] = geo.soapCols;
      const header = {
        h: geo.soapHeaderH,
        cells: [headerCell('Identitas', 18), headerCell('Anamnesis dan Pemeriksaan Fisik', 18), headerCell('Diagnosis dan Terapi', 18)],
      };
      const identitas = plainParagraphs(slide.identitas.split('\n'), { pt: slide.fontPt, color: PALETTE_B.ink });
      const body = {
        h: slideH - geo.soapHeaderH,
        cells: [
          cellXml({ paragraphs: identitas, fill: PALETTE_B.idCol }),
          cellXml({ paragraphs: noteParagraphs(slide.col2, slide.fontPt), fill: PALETTE_B.body }),
          cellXml({ paragraphs: noteParagraphs(slide.col3, slide.fontPt), fill: PALETTE_B.body2 }),
        ],
      };
      return { xml: slideXml(plainBg, table(ids, 'SOAP', geo.soapTable, [c1, c2, c3], [header, body])), rels };
    }

    case 'images': {
      const frames = geo.photos[slide.layout];
      let shapes = '';
      slide.photos.forEach((photo, index) => {
        const frame = frames[Math.min(index, frames.length - 1)]!;
        const ext = photo.mime === 'image/png' ? 'png' : 'jpeg';
        const name = `image${media.length + 1}.${ext}`;
        media.push({ name, data: photo.bytes });
        const relId = `rId${rels.length + 1}`;
        rels.push({ id: relId, type: `${REL}/image`, target: `../media/${name}` });
        shapes += picture(ids, relId, photoRect(photo, frame));
      });
      if (slide.layout === 'photoText') {
        shapes += shape(ids, 'Text', geo.photoTextBox, {
          fill: PALETTE_B.body,
          line: { hex: PALETTE_B.grid, w: GRID_LINE_EMU },
          body: txBody(noteParagraphs(slide.text ?? '', 12), 't', true),
        });
      }
      return { xml: slideXml(plainBg, shapes + boxedTitle(ids, geo.pageTitle, [slide.title], 24)), rels };
    }

    case 'text': {
      const box = shape(ids, 'Text', slide.rect, {
        fill: PALETTE_B.body,
        line: { hex: PALETTE_B.grid, w: GRID_LINE_EMU },
        // The size is already fitted (or chosen), so no PowerPoint autofit on top of it.
        body: txBody(noteParagraphs(slide.body, slide.fontPt, slide.align), 't'),
      });
      return { xml: slideXml(plainBg, box + boxedTitle(ids, geo.pageTitle, [slide.title], 24)), rels };
    }

    case 'lab': {
      const rect = geo.labTable;
      const first = Math.round(rect.w * geo.labFirstColShare);
      const n = Math.max(1, slide.dates.length);
      const rest = rect.w - first;
      const columns = [first, ...Array.from({ length: n }, (_, i) => Math.floor(rest / n) + (i < rest % n ? 1 : 0))];
      const headerH = Math.round(rect.h * 0.176);
      const rowH = Math.round((rect.h - headerH) / Math.max(1, slide.rows.length));
      const header = { h: headerH, cells: [headerCell('Pemeriksaan', 14), ...slide.dates.map((d) => headerCell(d, 14))] };
      const rows = slide.rows.map((row, index) => {
        const fill = index % 2 === 0 ? PALETTE_B.body : PALETTE_B.body2;
        const label = cellXml({ paragraphs: paragraphXml([{ text: row.label }], { pt: 14, color: PALETTE_B.ink }), fill }, 'ctr');
        const cells = row.cells.map((value) =>
          cellXml({ paragraphs: paragraphXml([{ text: value }], { pt: 14, color: PALETTE_B.ink, align: 'ctr' }), fill }, 'ctr'),
        );
        return { h: rowH, cells: [label, ...cells] };
      });
      const shapes = table(ids, 'Lab', rect, columns, [header, ...rows]) + boxedTitle(ids, geo.pageTitle, [slide.title], 24);
      return { xml: slideXml(plainBg, shapes), rels };
    }

    case 'closing':
      return { xml: slideXml(plainBg, boxedTitle(ids, geo.closingBox, ['Terima kasih'], 32)), rels };
  }
}

// ---------------------------------------------------------------------------
// Package parts

function relsXml(rels: ReadonlyArray<{ id: string; type: string; target: string }>): string {
  const body = rels.map((r) => `<Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"/>`).join('');
  return `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${body}</Relationships>`;
}

const EMPTY_TREE =
  '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
  '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree>';

const MASTER_XML =
  `${XML_HEAD}<p:sldMaster xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld>` +
  `<p:bg><p:bgPr>${solid(PALETTE_B.bg)}<a:effectLst/></p:bgPr></p:bg>${EMPTY_TREE}</p:cSld>` +
  '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
  '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>' +
  '<p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="3200"><a:latin typeface="+mj-lt"/></a:defRPr></a:lvl1pPr></p:titleStyle>' +
  '<p:bodyStyle><a:lvl1pPr><a:defRPr sz="1800"><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr></p:bodyStyle>' +
  '<p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>';

const LAYOUT_XML =
  `${XML_HEAD}<p:sldLayout xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}" type="blank" preserve="1">` +
  `<p:cSld name="Blank">${EMPTY_TREE}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;

function themeXml(): string {
  const c = (tag: string, hex: string): string => `<a:${tag}><a:srgbClr val="${hex}"/></a:${tag}>`;
  const font = `<a:latin typeface="${FONT}"/><a:ea typeface=""/><a:cs typeface=""/>`;
  const phFill = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
  const three = (s: string): string => s + s + s;
  return (
    `${XML_HEAD}<a:theme xmlns:a="${NS_A}" name="Slide MZ"><a:themeElements><a:clrScheme name="Slide MZ">` +
    c('dk1', PALETTE_B.ink) + c('lt1', 'FFFFFF') + c('dk2', PALETTE_B.boxLine) + c('lt2', PALETTE_B.bg) +
    c('accent1', PALETTE_B.accent) + c('accent2', PALETTE_B.head) + c('accent3', PALETTE_B.titleBgFrom) +
    c('accent4', PALETTE_B.titleBgTo) + c('accent5', PALETTE_B.sec) + c('accent6', PALETTE_B.grid) +
    c('hlink', PALETTE_B.head) + c('folHlink', PALETTE_B.sec) +
    `</a:clrScheme><a:fontScheme name="Slide MZ"><a:majorFont>${font}</a:majorFont><a:minorFont>${font}</a:minorFont></a:fontScheme>` +
    `<a:fmtScheme name="Slide MZ"><a:fillStyleLst>${three(phFill)}</a:fillStyleLst>` +
    `<a:lnStyleLst>${three(`<a:ln w="9525">${phFill}</a:ln>`)}</a:lnStyleLst>` +
    `<a:effectStyleLst>${three('<a:effectStyle><a:effectLst/></a:effectStyle>')}</a:effectStyleLst>` +
    `<a:bgFillStyleLst>${three(phFill)}</a:bgFillStyleLst></a:fmtScheme></a:themeElements>` +
    '<a:objectDefaults/><a:extraClrSchemeLst/></a:theme>'
  );
}

function presentationXml(count: number, slideH: number): string {
  const ids = Array.from({ length: count }, (_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 3}"/>`).join('');
  return (
    `${XML_HEAD}<p:presentation xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}" saveSubsetFonts="1">` +
    '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
    `<p:sldIdLst>${ids}</p:sldIdLst><p:sldSz cx="${SLIDE_W}" cy="${slideH}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`
  );
}

function contentTypesXml(count: number): string {
  const slides = Array.from(
    { length: count },
    (_, i) =>
      `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
  ).join('');
  return (
    `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/>' +
    '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
    '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
    '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>' +
    '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
    `${slides}</Types>`
  );
}

const CORE_XML =
  `${XML_HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
  'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
  '<dc:title>Slide MZ</dc:title><dc:creator>Plano</dc:creator>' +
  '<dcterms:created xsi:type="dcterms:W3CDTF">2026-01-01T00:00:00Z</dcterms:created>' +
  '<dcterms:modified xsi:type="dcterms:W3CDTF">2026-01-01T00:00:00Z</dcterms:modified></cp:coreProperties>';

const appXml = (count: number): string =>
  `${XML_HEAD}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">` +
  `<Application>Plano</Application><Slides>${count}</Slides></Properties>`;

export function pptxParts(deck: Deck): Array<{ name: string; data: Uint8Array }> {
  const encoder = new TextEncoder();
  const text = (name: string, xml: string): { name: string; data: Uint8Array } => ({ name, data: encoder.encode(xml) });
  const media: Media[] = [];
  const tall = Boolean(deck.tall);
  const geo = geometryFor(tall);
  const slideH = slideHeight(tall);
  const built = deck.slides.map((slide) => buildSlide(slide, media, geo, slideH));
  const count = built.length;

  const presentationRels = [
    { id: 'rId1', type: `${REL}/slideMaster`, target: 'slideMasters/slideMaster1.xml' },
    { id: 'rId2', type: `${REL}/theme`, target: 'theme/theme1.xml' },
    ...built.map((_, i) => ({ id: `rId${i + 3}`, type: `${REL}/slide`, target: `slides/slide${i + 1}.xml` })),
  ];

  return [
    text('[Content_Types].xml', contentTypesXml(count)),
    text(
      '_rels/.rels',
      relsXml([
        { id: 'rId1', type: `${REL}/officeDocument`, target: 'ppt/presentation.xml' },
        { id: 'rId2', type: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', target: 'docProps/core.xml' },
        { id: 'rId3', type: `${REL}/extended-properties`, target: 'docProps/app.xml' },
      ]),
    ),
    text('docProps/core.xml', CORE_XML),
    text('docProps/app.xml', appXml(count)),
    text('ppt/presentation.xml', presentationXml(count, slideH)),
    text('ppt/_rels/presentation.xml.rels', relsXml(presentationRels)),
    text('ppt/theme/theme1.xml', themeXml()),
    text('ppt/slideMasters/slideMaster1.xml', MASTER_XML),
    text(
      'ppt/slideMasters/_rels/slideMaster1.xml.rels',
      relsXml([
        { id: 'rId1', type: `${REL}/slideLayout`, target: '../slideLayouts/slideLayout1.xml' },
        { id: 'rId2', type: `${REL}/theme`, target: '../theme/theme1.xml' },
      ]),
    ),
    text('ppt/slideLayouts/slideLayout1.xml', LAYOUT_XML),
    text(
      'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
      relsXml([{ id: 'rId1', type: `${REL}/slideMaster`, target: '../slideMasters/slideMaster1.xml' }]),
    ),
    ...built.flatMap((slide, i) => [
      text(`ppt/slides/slide${i + 1}.xml`, slide.xml),
      text(`ppt/slides/_rels/slide${i + 1}.xml.rels`, relsXml(slide.rels)),
    ]),
    ...media.map((m) => ({ name: `ppt/media/${m.name}`, data: m.data })),
  ];
}

export function buildPptx(deck: Deck): Uint8Array<ArrayBuffer> {
  return storeZip(pptxParts(deck));
}
