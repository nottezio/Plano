import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import { crc32, storeZip } from '@/lib/zip';
import {
  buildSoapDocx,
  documentXml,
  escapeXml,
  headerXml,
  inlineRuns,
  soapDocxFileName,
  soapDocxParts,
  soapParagraphs,
} from './soapDocx';

const INPUT = {
  body: [
    '*Tn. Pasien A / 60 tahun / RM 000123*',
    '',
    '*S:*',
    '- Sesak berkurang',
    '  - tidur 2 bantal',
    '*A:*',
    '1. CHF _NYHA II_ ec HHD',
    '2. HT stage 2',
    '*P:*',
    '- Furosemide 40 mg/12 jam/IV',
    '',
    '',
  ].join('\n'),
  patientName: 'Tn. Pasien A',
  mrn: 'RM 000123',
  location: 'Lantai 5 Kamar 517 Bed 2',
  dayLabel: 'Kamis, 8 Oktober 2026 · Hari rawat ke-4',
};

const { DOMParser } = new JSDOM('').window;
const expectWellFormed = (xml: string): void => {
  const parsed = new DOMParser().parseFromString(xml, 'application/xml');
  expect(parsed.getElementsByTagName('parsererror')).toHaveLength(0);
};

describe('inlineRuns', () => {
  it('turns both bold spellings, italic and strike into formatting', () => {
    expect(inlineRuns('*Tebal* dan **tebal** lalu _miring_ dan ~~coret~~')).toEqual([
      { text: 'Tebal', bold: true },
      { text: ' dan ' },
      { text: 'tebal', bold: true },
      { text: ' lalu ' },
      { text: 'miring', italic: true },
      { text: ' dan ' },
      { text: 'coret', strike: true },
    ]);
  });

  it('nests: bold italic', () => {
    expect(inlineRuns('*_NYHA II_*')).toEqual([{ text: 'NYHA II', bold: true, italic: true }]);
  });

  it('leaves clinical shorthand alone', () => {
    expect(inlineRuns('Ceftriaxone 2*1 g, hari_rawat, TD_N_RR')).toEqual([
      { text: 'Ceftriaxone 2*1 g, hari_rawat, TD_N_RR' },
    ]);
  });

  it('drops a stray private-use character instead of reading it as a marker', () => {
    expect(inlineRuns('ab')).toEqual([{ text: 'ab' }]);
  });
});

describe('soapParagraphs', () => {
  it('reads bullets with levels, keeps the note’s own numbers, drops trailing blanks', () => {
    const paragraphs = soapParagraphs(INPUT.body);
    expect(paragraphs.map((p) => p.kind)).toEqual([
      'text', 'text', 'text', 'bullet', 'bullet', 'text', 'numbered', 'numbered', 'text', 'bullet',
    ]);
    expect(paragraphs[4]).toEqual({ kind: 'bullet', level: 1, runs: [{ text: 'tidur 2 bantal' }] });
    expect(paragraphs[6]).toMatchObject({ kind: 'numbered', level: 0, marker: '1.' });
  });

  it('reads a `* ` line as a bullet, not as bold', () => {
    expect(soapParagraphs('* Cek EKG')).toEqual([{ kind: 'bullet', level: 0, runs: [{ text: 'Cek EKG' }] }]);
  });

  it('removes invisible characters pasted from WhatsApp', () => {
    expect(soapParagraphs('-\u2060 Aspilet')).toEqual([{ kind: 'bullet', level: 0, runs: [{ text: 'Aspilet' }] }]);
  });
});

describe('XML', () => {
  it('escapes what XML must, and removes what it cannot hold', () => {
    expect(escapeXml('K < 3,5 & Na > 145 "x"\u0007')).toBe('K &lt; 3,5 &amp; Na &gt; 145 &quot;x&quot;');
  });

  it('every part is well-formed XML', () => {
    for (const part of soapDocxParts({ ...INPUT, body: `${INPUT.body}\nTD <90 & HR >100\tcatat` })) {
      expectWellFormed(part.xml);
    }
  });

  it('writes formatting and bullets into the document', () => {
    const xml = documentXml(soapParagraphs(INPUT.body));
    expect(xml).toContain('<w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">S:</w:t>');
    expect(xml).toContain('<w:numId w:val="1"/>');
    expect(xml).toContain('<w:i/><w:iCs/></w:rPr><w:t xml:space="preserve">NYHA II</w:t>');
    expect(xml).toContain('<w:pgSz w:w="11906" w:h="16838"/>');
  });

  it('puts whose and which day on every page', () => {
    const xml = headerXml({ ...INPUT, noteLabel: 'Versi dr. A' });
    expect(xml).toContain('Tn. Pasien A');
    expect(xml).toContain(' · RM 000123 · Lantai 5 Kamar 517 Bed 2');
    expect(xml).toContain('Hari rawat ke-4 · Versi dr. A');
  });
});

describe('package', () => {
  it('crc32 matches the standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('is a ZIP whose entries are the parts, stored byte for byte', () => {
    const bytes = buildSoapDocx(INPUT);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const end = bytes.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    const count = view.getUint16(end + 10, true);
    const parts = soapDocxParts(INPUT);
    expect(count).toBe(parts.length);

    const decoder = new TextDecoder();
    let at = 0;
    for (const part of parts) {
      expect(view.getUint32(at, true)).toBe(0x04034b50);
      const size = view.getUint32(at + 18, true);
      const nameLength = view.getUint16(at + 26, true);
      expect(decoder.decode(bytes.subarray(at + 30, at + 30 + nameLength))).toBe(part.name);
      const data = bytes.subarray(at + 30 + nameLength, at + 30 + nameLength + size);
      expect(decoder.decode(data)).toBe(part.xml);
      expect(view.getUint32(at + 14, true)).toBe(crc32(data));
      at += 30 + nameLength + size;
    }
    expect(view.getUint32(at, true)).toBe(0x02014b50);
  });

  it('is deterministic', () => {
    expect(buildSoapDocx(INPUT)).toEqual(buildSoapDocx(INPUT));
  });

  it('an empty archive is still a valid end record', () => {
    expect(storeZip([])).toHaveLength(22);
  });
});

describe('soapDocxFileName', () => {
  it('drops characters Windows refuses', () => {
    expect(soapDocxFileName('Tn. A/B: "C"', '2026-10-08')).toBe('SOAP Tn. A B C 2026-10-08.docx');
    expect(soapDocxFileName('', '2026-10-08', 'Jaga 21.40')).toBe('SOAP Pasien 2026-10-08 Jaga 21.40.docx');
  });
});
