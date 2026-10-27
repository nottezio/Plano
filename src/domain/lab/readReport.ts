import type { ClinicalDate } from '@/domain/types';
import { headingDate, readLabMeta, toDate } from './labMeta';
import { labHeading } from './parseLab';

/**
 * The SIMGOS reports that are not labs: radiology (thorax, CT), echo, and the
 * procedure reports (angiografi, EP study, ablasi, PPM).
 *
 * They used to be refused ("bukan hasil laboratorium") and retyped by hand. The
 * note never carries the whole report, only the part the ward reads aloud, and
 * it is the same part every time, so that is what is lifted, in the shape the
 * notes already use (checked against Avi's export, 2026-10-27):
 *
 *   radiology   KESAN PEMERIKSAAN lines          `*Foto Thorax PJT (04-09-2026)*`
 *   echo        the Conclusion lines              `*Echocardiography Full Study (…)*`
 *   procedure   findings (CA vessels, PPM device), `Kesimpulan :` and `Saran :`
 *
 * Same rule as the lab reformatter: words are COPIED, never rewritten. The only
 * edits are layout (a wrapped bullet is joined, a lone bullet glyph becomes
 * `- `). A report whose section is not found returns null, so the sheet says
 * so instead of inserting a heading over nothing.
 */

export interface ReportBlock {
  /** Heading words without the date: `Foto Thorax PJT`, `Laporan CA Diagnostik`. */
  title: string;
  /** The date printed on the report, or null (the sheet then uses the note's). */
  date: ClinicalDate | null;
  lines: string[];
}

/** Page furniture repeated on every page of a multi-page report. */
const NOISE =
  /^(MR\.\s?24|RS WAHIDIN|LAPORAN\b|HASIL PEMERIKSAAN RADIOLOGI|Nama\s*:|Tanggal Lahir|No\. RM|No\. Registrasi|Sex \/)/i;
/** Where a report's body ends: the signature block. */
const SIGNATURE = /^(\d{1,2}-\d{1,2}-\d{4}$|tanda tangan|makassar,)/i;

const SYMBOL = /^[^\p{L}\p{N}(]+/u;

/**
 * Report lines as note lines. A line starting with a symbol (`-`, `•`, the
 * private-use glyph a PDF font leaves) is a bullet; a line that is only a symbol
 * makes the NEXT line one; a plain line right after a bullet is its wrapped end.
 */
function tidy(raw: readonly string[]): string[] {
  const out: string[] = [];
  let pending = false;
  for (const line of raw) {
    if (!/[\p{L}\p{N}]/u.test(line)) {
      pending = true;
      continue;
    }
    const bullet = pending || SYMBOL.test(line);
    const text = line.replace(SYMBOL, '').trim();
    pending = false;
    const last = out.length - 1;
    if (!bullet && last >= 0 && out[last]!.startsWith('- ')) out[last] += ` ${text}`;
    else out.push(bullet ? `- ${text}` : text);
  }
  return out;
}

/**
 * Lines after `lines[from]` up to (not including) the first that `stops`.
 *
 * A page header between the marker and its first line is skipped; one after the
 * body has started ends it, because what follows a repeated header (its
 * subtitle, `3D NON AF`) is page furniture too.
 */
function until(lines: readonly string[], from: number, stops: RegExp): string[] {
  const body: string[] = [];
  for (const line of lines.slice(from + 1)) {
    if (stops.test(line)) break;
    if (NOISE.test(line)) {
      if (body.length > 0) break;
      continue;
    }
    body.push(line);
  }
  return body;
}

function dateAfter(lines: readonly string[], marker: RegExp): ClinicalDate | null {
  const at = lines.findIndex((line) => marker.test(line));
  const match = /(\d{1,2})-(\d{1,2})-(\d{4})/.exec(lines[at + 1] ?? '');
  return at >= 0 && match ? toDate(match[1]!, match[2]!, match[3]!) : null;
}

function radiology(lines: readonly string[], text: string): ReportBlock | null {
  const at = lines.findIndex((line) => /^kesan pemeriksaan/i.test(line));
  if (at < 0) return null;
  const inline = lines[at]!.replace(/^kesan pemeriksaan\s*:?\s*/i, '');
  const body = tidy([...(inline ? [inline] : []), ...until(lines, at, /^(usul pemeriksaan|makassar,)/i)]);
  if (body.length === 0) return null;

  // `Nama Tindakan : CT Scan Non Kontras Otak`, or the procedure line that the
  // layout puts beside it (`Radiografi Thorax 1 proyeksi`).
  const named = /nama tindakan[ \t]*:[ \t]*(\S.*)$/im.exec(text)?.[1];
  const head = lines.slice(0, 14);
  let title = (named ?? head.find((line) => /^(radiografi|foto|ct\b|mri|usg)/i.test(line)) ?? 'Radiologi')
    .replace(/^radiografi\s+/i, 'Foto ')
    .replace(/\s+\d+\s+proyeksi.*$/i, '');
  // The layout can cut a parenthesis across lines: keep only what is closed.
  if (title.split('(').length > title.split(')').length) title = title.slice(0, title.lastIndexOf('(')).trim();
  const meta = readLabMeta(text);
  if (meta.unit && /^foto\b/i.test(title) && !title.includes(meta.unit)) title = `${title} ${meta.unit}`;
  return { title: title.trim(), date: meta.date, lines: body };
}

function echo(lines: readonly string[], text: string): ReportBlock | null {
  const at = lines.findIndex((line) => /^conclusion/i.test(line));
  if (at < 0) return null;
  const inline = lines[at]!.replace(/^conclusion\s*:?\s*/i, '');
  const body = [...(inline ? [inline] : []), ...until(lines, at, SIGNATURE)];
  if (body.length === 0) return null;
  const title = /hemodinam/i.test(text)
    ? 'Echo Hemodinamik'
    : /standar/i.test(text)
      ? 'Echocardiography Full Study'
      : 'Echocardiography';
  return { title, date: dateAfter(lines, /^tanggal tindakan/i), lines: body };
}

const KNOWN_TITLES: ReadonlyArray<readonly [RegExp, string]> = [
  [/angiografi\s+diagnostik/i, 'Laporan CA Diagnostik'],
  [/^electro|^elektro/i, 'Laporan EP Study'],
  [/radiofrequency|ablation|ablasi/i, 'Laporan Hasil Radioablasi'],
];
const ACRONYMS = new Set(['PPM', 'ILR', 'EP', 'CA', 'TTE', 'TEE', 'PCI', 'PTCA', 'ICD', 'CRT', 'AF', 'PPM/ILR']);

function procedureTitle(printed: string): string {
  const known = KNOWN_TITLES.find(([pattern]) => pattern.test(printed));
  if (known) return known[1];
  const words = printed.split(/\s+/).map((word) =>
    ACRONYMS.has(word) ? word : word.charAt(0) + word.slice(1).toLowerCase(),
  );
  return `Laporan ${words.join(' ')}`;
}

/** `Left Main : …` and the dominance line under "…dengan hasil :". */
function findings(lines: readonly string[]): string[] {
  const at = lines.findIndex((line) => /hasil\s*:\s*$/i.test(line));
  if (at < 0) return [];
  return until(lines, at, /^\d+\.(\s|$)/).map((line) => (line.startsWith('-') ? line : `- ${line}`));
}

/** PPM: the generator, the leads and the programmed mode. */
const DEVICE = /^(merek|sadapan|ventricle lead|atri(?:um|al) lead|pengaturan)\b[^:]{0,40}:\s*\S/i;
const SECTION_END = new RegExp(`^(saran\\b|${SIGNATURE.source})`, 'i');

function procedure(lines: readonly string[]): ReportBlock | null {
  const printed = lines
    .map((line) => /^laporan\s+(?!operasi\b)(.+)$/i.exec(line)?.[1])
    .find(Boolean);
  const at = lines.findIndex((line) => /^kesimpulan/i.test(line));
  if (!printed || at < 0) return null;

  const inline = lines[at]!.replace(/^kesimpulan\s*:?\s*/i, '');
  const items = tidy(until(lines, at, SECTION_END));
  if (!inline && items.length === 0) return null;
  const saran = /^saran\s*:?\s*(.*)$/i.exec(lines.find((line) => /^saran\b/i.test(line)) ?? '')?.[1];

  const out = [
    ...findings(lines),
    ...lines.filter((line) => DEVICE.test(line)),
    ...(inline ? [`Kesimpulan : ${inline}`, ...items] : ['Kesimpulan :', ...items]),
    ...(saran ? [`Saran : ${saran}`] : []),
  ];
  return { title: procedureTitle(printed), date: dateAfter(lines, /^tanggal tindakan/i), lines: out };
}

export function readReport(text: string): ReportBlock | null {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (/hasil\s+pemeriksaan\s+radiologi/i.test(text)) return radiology(lines, text);
  if (/^laporan\s+(ekokardiografi|echocardiograph)/im.test(text)) return echo(lines, text);
  if (/^laporan operasi\s*$/im.test(text)) return procedure(lines);
  return null;
}

/** The block as it goes into the note, headed like the lab block. */
export function reportBlockText(report: ReportBlock, noteDate: ClinicalDate): string {
  return [labHeading(headingDate(report.date ?? noteDate), report.title), ...report.lines].join('\n');
}
