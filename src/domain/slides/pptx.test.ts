// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { Deck, DeckPhoto, DeckSlide } from './deck';
import { GEOMETRY } from './geometry';
import { buildPptx, isSectionLabel, photoRect, pptxParts } from './pptx';

// Synthetic content only. Bytes are a placeholder; the writer never decodes images.
const photo: DeckPhoto = { imageId: 'img1', bytes: new Uint8Array([1, 2, 3]), mime: 'image/jpeg', widthPx: 1600, heightPx: 1200 };

const soap = (col2: string): DeckSlide => ({
  kind: 'soap',
  id: 'soap-2026-10-07',
  date: '2026-10-07',
  identitas: '07-10-2026\n\nPJT Lt. 4 409',
  col2,
  col3: 'Diagnosis:\n- Contoh diagnosis\nTerapi:\n- *Obat A* 1x1',
  fontPt: 10.5,
});

const deck: Deck = {
  slides: [
    { kind: 'title', id: 'title', heading: ['Tn. Contoh / 54 tahun / RM 1234567', 'PJT Lantai 4 Kamar 409'], subtitle: 'DPJP Utama dan Tindakan : Prof. Contoh' },
    soap('S :\n- Keluhan contoh\nO :\nTensi : 120/80 mmHg'),
    { kind: 'images', id: 'img-a', title: 'EKG PJT Lt. 4 07-10-2026', layout: 'one', photos: [photo] },
    { kind: 'lab', id: 'lab', title: 'Laboratorium PJT', dates: ['02-10-2026', '05-10-2026'], rows: [{ label: 'Hb (g/dL)', cells: ['14.2', '13.9'] }] },
    { kind: 'closing', id: 'closing' },
  ],
};

const decoder = new TextDecoder();
function slideXml(d: Deck, n: number): string {
  const part = pptxParts(d).find((p) => p.name === `ppt/slides/slide${n}.xml`);
  if (!part) throw new Error(`no slide ${n}`);
  return decoder.decode(part.data);
}

describe('pptx writer', () => {
  it('every XML part parses', () => {
    for (const p of pptxParts(deck)) {
      if (!/\.(xml|rels)$/.test(p.name)) continue;
      const doc = new DOMParser().parseFromString(decoder.decode(p.data), 'application/xml');
      expect(doc.querySelector('parsererror'), p.name).toBeNull();
    }
  });

  it('is byte-identical for the same deck', () => {
    expect(buildPptx(deck)).toEqual(buildPptx(deck));
  });

  it('writes one slide part per deck slide', () => {
    expect(pptxParts(deck).filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p.name))).toHaveLength(5);
  });

  it('soap table uses the measured column widths', () => {
    expect(slideXml(deck, 2)).toContain(`<a:gridCol w="${GEOMETRY.soapCols[0]}"/>`);
  });

  it('photo is contain-fitted in its frame', () => {
    const frame = GEOMETRY.photos.one[0]!;
    const r = photoRect({ ...photo, widthPx: 1000, heightPx: 1000 }, frame);
    expect(r.w).toBe(r.h);
    expect(r.y).toBe(frame.y);
    expect(r.x + r.w / 2).toBeCloseTo(frame.x + frame.w / 2, -1);
  });

  it('a moved photo keeps its stored rect, even off-slide', () => {
    const moved: Deck = {
      slides: [{ kind: 'images', id: 'm', title: 'Foto', layout: 'one', photos: [{ ...photo, rect: { x: -500_000, y: 6_000_000, w: 4_000_000, h: 3_000_000 } }] }],
    };
    expect(slideXml(moved, 1)).toContain('<a:off x="-500000" y="6000000"/>');
  });

  it('title box is drawn after the pictures', () => {
    const xml = slideXml(deck, 3);
    expect(xml.indexOf('<p:pic>')).toBeGreaterThan(-1);
    expect(xml.lastIndexOf('<p:pic>')).toBeLessThan(xml.indexOf('name="Title"'));
  });

  it('a title with no lines still writes a paragraph (an empty txBody is invalid)', () => {
    const xml = slideXml({ slides: [{ kind: 'title', id: 'title', heading: [], subtitle: '' }] }, 1);
    const bodies = xml.match(/<p:txBody>[\s\S]*?<\/p:txBody>/g) ?? [];
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) expect(body).toContain('<a:p>');
  });

  it('bolds only the main SOAP headings, not sub-labels like Faktor Risiko', () => {
    for (const line of ['S :', 'O:', 'Diagnosis:', 'Terapi:', 'Plan', 'Plan:', 'A :', 'P:']) expect(isSectionLabel(line), line).toBe(true);
    for (const line of ['Faktor Risiko Kardiovaskular :', 'Premedikasi pra-tindakan:', 'EKG PJT Lt. 4 (12-11-2026)']) {
      expect(isSectionLabel(line), line).toBe(false);
    }
  });

  it('a text slide uses its font size and centres its paragraphs on request', () => {
    const text = (align: 'l' | 'ctr'): Deck => ({
      slides: [{ kind: 'text', id: 't', title: 'USG', body: '- Fatty liver', fontPt: 28, align, rect: GEOMETRY.textOnly }],
    });
    const centred = (d: Deck) => (slideXml(d, 1).match(/algn="ctr"/g) ?? []).length;
    expect(slideXml(text('l'), 1)).toContain('sz="2800"');
    // The boxed title is always centred (1); the body adds one more only when centred.
    expect(centred(text('l'))).toBe(1);
    expect(centred(text('ctr'))).toBe(2);
  });

  it('a tall deck writes a 4:3 slide size and a taller SOAP body row', () => {
    const part = (d: Deck, name: string) => decoder.decode(pptxParts(d).find((p) => p.name === name)!.data);
    expect(part(deck, 'ppt/presentation.xml')).toContain('cy="6858000"');
    const tall: Deck = { ...deck, tall: true };
    expect(part(tall, 'ppt/presentation.xml')).toContain('cy="9144000"');
    expect(part(tall, 'ppt/slides/slide2.xml')).toContain(`<a:tr h="${9_144_000 - GEOMETRY.soapHeaderH}">`);
  });

  it('a free-text box is written where the resident put it', () => {
    const moved: Deck = {
      slides: [{ kind: 'text', id: 't', title: 'USG', body: 'x', fontPt: 14, align: 'l', rect: { x: 1_000_000, y: 1_500_000, w: 3_000_000, h: 1_200_000 } }],
    };
    expect(slideXml(moved, 1)).toContain('<a:off x="1000000" y="1500000"/><a:ext cx="3000000" cy="1200000"/>');
  });

  it('escapes note text', () => {
    expect(slideXml({ slides: [soap('a < b & c')] }, 1)).toContain('a &lt; b &amp; c');
  });

  it('turns *bold* markers into bold runs', () => {
    expect(slideXml(deck, 2)).toMatch(/<a:rPr[^>]*b="1"[^>]*>(?:(?!<\/a:r>).)*<a:t>Obat A<\/a:t>/s);
  });

  it('references every image it stores', () => {
    const names = pptxParts(deck).map((p) => p.name);
    expect(names).toContain('ppt/media/image1.jpeg');
    const rels = decoder.decode(pptxParts(deck).find((p) => p.name === 'ppt/slides/_rels/slide3.xml.rels')!.data);
    expect(rels).toContain('../media/image1.jpeg');
  });
});
