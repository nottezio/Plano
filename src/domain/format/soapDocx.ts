import { storeZip } from '@/lib/zip';
import { BOLD_RE, ITALIC_RE, SINGLE_BOLD_RE, STRIKE_RE, stripInvisible } from './formatters';

/**
 * Ekspor Word: one day's SOAP as a .docx, for printing (Avi, 2026-10-08).
 *
 * WHAT GOES IN
 *
 * The note exactly as written, line for line — the same rule as Ringkas
 * (`pdfReport.ts`): a selection, never a rewrite. A print that regenerates
 * the note from fields drifts from it the moment one side is corrected. The
 * markers become formatting (`*tebal*`, `_miring_`, `~~coret~~`), `- ` and
 * `* ` lines become real bullets, and numbered lines keep THEIR numbers (a
 * plan that says "lihat no. 3" must still point at 3) with a hanging indent
 * so a wrapped line lines up under its text, not under the number.
 *
 * WHAT IS ADDED
 *
 * Only a running header — name, RM, place, date, hari rawat — and "Halaman
 * x dari y" at the foot. A printed SOAP is a loose sheet the moment it leaves
 * the printer; every page has to say whose it is and which day, or page two
 * of one patient ends up stapled to page one of another. The note's own
 * opening already carries the identity, so the body gets no title block that
 * would only repeat it.
 *
 * WHY WORD AND NOT A PDF
 *
 * Avi asked for Word, and it is the better print source here: what gets
 * printed often needs one more edit (drop the greeting, add a signature
 * line), which a PDF does not allow.
 *
 * HOW
 *
 * Hand-written WordprocessingML in a stored ZIP (`lib/zip`). The `docx`
 * package would do it too, at a few hundred kilobytes in the offline precache
 * for one button; the format needed here is seven small parts.
 */

export interface SoapDocxInput {
  /** The note, as stored (markdown-lite / WhatsApp emphasis). */
  body: string;
  patientName: string;
  /** `RM 123456`, or empty. */
  mrn?: string | undefined;
  /** Ward, room, bed, as `formatLocation` writes it. */
  location?: string | undefined;
  /** `Kamis, 8 Oktober 2026 · Hari rawat ke-4`, as `formatDayHeader` writes it. */
  dayLabel: string;
  /** A jaga note or a version: its name, shown after the day. */
  noteLabel?: string | undefined;
}

// ---------------------------------------------------------------------------
// The note → paragraphs (pure, tested without any XML)

export interface Run {
  text: string;
  bold?: true;
  italic?: true;
  strike?: true;
}

export type Paragraph =
  | { kind: 'text'; runs: Run[] }
  | { kind: 'bullet'; level: number; runs: Run[] }
  /** `marker` is the note's own number, `3.` or `3)`. */
  | { kind: 'numbered'; level: number; marker: string; runs: Run[] };

/*
  Private-use characters standing in for the markers while a line is walked.
  The patterns run as text replacements (the same ones the copy formatters
  use, so a span is bold here exactly when WhatsApp would show it bold), and
  only then is the line read character by character into runs.
*/
const B = '';
const I = '';
const S = '';
const SENTINELS = /[-]/g;

export function inlineRuns(line: string): Run[] {
  const marked = line
    .replace(SENTINELS, '')
    .replace(BOLD_RE, `${B}$1${B}`)
    .replace(STRIKE_RE, `${S}$1${S}`)
    .replace(SINGLE_BOLD_RE, `$1${B}$2${B}`)
    .replace(ITALIC_RE, `$1${I}$2${I}`);

  const runs: Run[] = [];
  let bold = false;
  let italic = false;
  let strike = false;
  let text = '';
  const flush = (): void => {
    if (!text) return;
    runs.push({ text, ...(bold ? { bold: true } : {}), ...(italic ? { italic: true } : {}), ...(strike ? { strike: true } : {}) });
    text = '';
  };
  for (const char of marked) {
    if (char === B || char === I || char === S) {
      flush();
      if (char === B) bold = !bold;
      else if (char === I) italic = !italic;
      else strike = !strike;
    } else {
      text += char;
    }
  }
  flush();
  return runs;
}

/** Two spaces or a tab per level, at most three levels. */
const levelOf = (indent: string): number =>
  Math.min(2, Math.floor(indent.replace(/\t/g, '  ').length / 2));

const BULLET_LINE = /^([ \t]*)[-*•] +(.*)$/;
const NUMBERED_LINE = /^([ \t]*)(\d{1,3}[.)]) +(.*)$/;

export function soapParagraphs(body: string): Paragraph[] {
  const lines = stripInvisible(body.replace(/\r\n?/g, '\n')).split('\n');
  // Trailing blank lines would print as a blank half-page on a short note.
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') lines.pop();

  return lines.map((line): Paragraph => {
    const bullet = BULLET_LINE.exec(line);
    if (bullet) return { kind: 'bullet', level: levelOf(bullet[1]!), runs: inlineRuns(bullet[2]!) };
    const numbered = NUMBERED_LINE.exec(line);
    if (numbered) {
      return { kind: 'numbered', level: levelOf(numbered[1]!), marker: numbered[2]!, runs: inlineRuns(numbered[3]!) };
    }
    return { kind: 'text', runs: inlineRuns(line) };
  });
}

// ---------------------------------------------------------------------------
// Paragraphs → WordprocessingML

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/** Characters XML 1.0 forbids, removed rather than escaped (they cannot be). */
const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

export function escapeXml(text: string): string {
  return text
    .replace(XML_INVALID, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** A4 with 2 cm margins, in twentieths of a point. */
const PAGE = { width: 11906, height: 16838, margin: 1134, headerFooter: 567 };
const TEXT_WIDTH = PAGE.width - 2 * PAGE.margin;
/** Indent per level and the hanging indent for a bullet or number, 0.63 cm. */
const STEP = 357;
/** Numbered lines hang wider, so `10.` still fits before the text. */
const NUMBER_HANG = 454;

function runXml(run: Run, extra = ''): string {
  const props = `${run.bold ? '<w:b/><w:bCs/>' : ''}${run.italic ? '<w:i/><w:iCs/>' : ''}${run.strike ? '<w:strike/>' : ''}${extra}`;
  const rPr = props ? `<w:rPr>${props}</w:rPr>` : '';
  // A tab in the note is a tab in Word, not a character it cannot show.
  return run.text
    .split('\t')
    .map((part, index) => `${index > 0 ? `<w:r>${rPr}<w:tab/></w:r>` : ''}${part ? `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(part)}</w:t></w:r>` : ''}`)
    .join('');
}

function paragraphXml(paragraph: Paragraph): string {
  const runs = paragraph.runs.map((run) => runXml(run)).join('');
  switch (paragraph.kind) {
    case 'text':
      return `<w:p>${runs}</w:p>`;
    case 'bullet':
      return `<w:p><w:pPr><w:numPr><w:ilvl w:val="${paragraph.level}"/><w:numId w:val="1"/></w:numPr></w:pPr>${runs}</w:p>`;
    case 'numbered': {
      const left = STEP * paragraph.level + NUMBER_HANG;
      return `<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="${left}"/></w:tabs><w:ind w:left="${left}" w:hanging="${NUMBER_HANG}"/></w:pPr>${runXml({ text: paragraph.marker })}<w:r><w:tab/></w:r>${runs}</w:p>`;
    }
  }
}

export function documentXml(paragraphs: readonly Paragraph[]): string {
  const body = paragraphs.length > 0 ? paragraphs.map(paragraphXml).join('') : '<w:p/>';
  return (
    `${XML_HEAD}<w:document xmlns:w="${W_NS}" xmlns:r="${R_NS}"><w:body>${body}` +
    `<w:sectPr><w:headerReference w:type="default" r:id="rIdHeader"/><w:footerReference w:type="default" r:id="rIdFooter"/>` +
    `<w:pgSz w:w="${PAGE.width}" w:h="${PAGE.height}"/>` +
    `<w:pgMar w:top="${PAGE.margin}" w:right="${PAGE.margin}" w:bottom="${PAGE.margin}" w:left="${PAGE.margin}" w:header="${PAGE.headerFooter}" w:footer="${PAGE.headerFooter}" w:gutter="0"/>` +
    `</w:sectPr></w:body></w:document>`
  );
}

const SMALL = '<w:color w:val="595959"/><w:sz w:val="17"/><w:szCs w:val="17"/>';

export function headerXml(input: SoapDocxInput): string {
  const who = [input.mrn?.trim(), input.location?.trim()].filter(Boolean).join(' · ');
  const when = [input.dayLabel.trim(), input.noteLabel?.trim()].filter(Boolean).join(' · ');
  return (
    `${XML_HEAD}<w:hdr xmlns:w="${W_NS}" xmlns:r="${R_NS}"><w:p><w:pPr>` +
    `<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="4" w:color="A6A6A6"/></w:pBdr>` +
    `<w:tabs><w:tab w:val="right" w:pos="${TEXT_WIDTH}"/></w:tabs></w:pPr>` +
    runXml({ text: input.patientName.trim() || 'Tanpa nama', bold: true }, SMALL) +
    (who ? runXml({ text: ` · ${who}` }, SMALL) : '') +
    `<w:r><w:rPr>${SMALL}</w:rPr><w:tab/></w:r>` +
    runXml({ text: when }, SMALL) +
    `</w:p></w:hdr>`
  );
}

function field(instruction: string, placeholder: string): string {
  return `<w:fldSimple w:instr=" ${instruction} "><w:r><w:rPr>${SMALL}</w:rPr><w:t>${placeholder}</w:t></w:r></w:fldSimple>`;
}

export function footerXml(): string {
  return (
    `${XML_HEAD}<w:ftr xmlns:w="${W_NS}" xmlns:r="${R_NS}"><w:p><w:pPr><w:jc w:val="center"/></w:pPr>` +
    `${runXml({ text: 'Halaman ' }, SMALL)}${field('PAGE', '1')}${runXml({ text: ' dari ' }, SMALL)}${field('NUMPAGES', '1')}` +
    `</w:p></w:ftr>`
  );
}

/*
  Arial 11 pt, single spacing, no space after paragraphs: the note's own blank
  lines are its spacing, and Word's default 8 pt after every paragraph would
  double a SOAP's length on paper. Language Indonesian, so Word's spelling
  check does not underline every line.
*/
const STYLES =
  `${XML_HEAD}<w:styles xmlns:w="${W_NS}"><w:docDefaults><w:rPrDefault><w:rPr>` +
  `<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>` +
  `<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="id-ID" w:eastAsia="id-ID" w:bidi="ar-SA"/>` +
  `</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
  `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>` +
  `</w:styles>`;

const BULLET_GLYPHS = ['•', '◦', '▪'];

const NUMBERING =
  `${XML_HEAD}<w:numbering xmlns:w="${W_NS}"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>` +
  BULLET_GLYPHS.map(
    (glyph, level) =>
      `<w:lvl w:ilvl="${level}"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="${glyph}"/><w:lvlJc w:val="left"/>` +
      `<w:pPr><w:ind w:left="${STEP * (level + 1)}" w:hanging="${STEP}"/></w:pPr>` +
      `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:hint="default"/></w:rPr></w:lvl>`,
  ).join('') +
  `</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;

const CONTENT_TYPES =
  `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
  `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
  `<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>` +
  `<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>` +
  `<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>` +
  `</Types>`;

const ROOT_RELS =
  `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
  `</Relationships>`;

const DOCUMENT_RELS =
  `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
  `<Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>` +
  `<Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>` +
  `<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>` +
  `</Relationships>`;

/** Every part of the package, as text, in archive order. */
export function soapDocxParts(input: SoapDocxInput): Array<{ name: string; xml: string }> {
  return [
    { name: '[Content_Types].xml', xml: CONTENT_TYPES },
    { name: '_rels/.rels', xml: ROOT_RELS },
    { name: 'word/document.xml', xml: documentXml(soapParagraphs(input.body)) },
    { name: 'word/_rels/document.xml.rels', xml: DOCUMENT_RELS },
    { name: 'word/styles.xml', xml: STYLES },
    { name: 'word/numbering.xml', xml: NUMBERING },
    { name: 'word/header1.xml', xml: headerXml(input) },
    { name: 'word/footer1.xml', xml: footerXml() },
  ];
}

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function buildSoapDocx(input: SoapDocxInput): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  return storeZip(soapDocxParts(input).map((part) => ({ name: part.name, data: encoder.encode(part.xml) })));
}

/**
 * `SOAP Nama Pasien 2026-10-08.docx`. Characters Windows refuses in a file
 * name are dropped, so the download is not renamed to `download.docx`.
 */
export function soapDocxFileName(patientName: string, date: string, noteLabel?: string): string {
  const safe = (text: string): string =>
    text
      .replace(/[\\/:*?"<>|\u0000-\u001F]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const parts = ['SOAP', safe(patientName) || 'Pasien', safe(date), noteLabel ? safe(noteLabel) : ''].filter(Boolean);
  return `${parts.join(' ').slice(0, 120)}.docx`;
}
