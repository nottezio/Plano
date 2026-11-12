import { describe, expect, it } from 'vitest';
import { storeZip } from '@/lib/zip';
import type { Deck } from './deck';
import { emptyDeckState } from './deckState';
import { guessImageKind, importToState, readPptx } from './importPptx';
import { buildPptx } from './pptx';

// Synthetic decks only: one from our own writer, the rest hand-made Parcel-style XML.
const photo = { imageId: 'a', bytes: new Uint8Array([9, 9]), mime: 'image/jpeg' as const, widthPx: 4, heightPx: 3 };
const SYNTH_DECK: Deck = {
  slides: [
    { kind: 'title', id: 'title', heading: ['Tn. Contoh / RM 1'], subtitle: 'DPJP Utama dan Tindakan : Prof. Contoh' },
    { kind: 'soap', id: 's', date: '2026-10-05', identitas: '05-10-2026\n\nPJT Lt. 4', col2: 'S :\n- Baik', col3: 'Diagnosis:\n- Contoh', fontPt: 10.5 },
    { kind: 'images', id: 'i', title: 'EKG PJT Lt. 4 05-10-2026', layout: 'one', photos: [photo] },
    { kind: 'lab', id: 'lab', title: 'Laboratorium PJT', dates: ['02-10-2026'], rows: [{ label: 'Hb (g/dL)', cells: ['14.2'] }] },
    { kind: 'closing', id: 'closing' },
  ],
};

const enc = new TextEncoder();
const buf = (bytes: Uint8Array): ArrayBuffer => bytes.slice().buffer;

/** A minimal hand-made deck: slides given as XML bodies, in `order` (indices into `slides`). */
function handDeck(opts: { cx?: number; cy?: number; slides: Array<{ xml: string; rels?: string }>; order?: number[]; media?: Record<string, Uint8Array> }): ArrayBuffer {
  const order = opts.order ?? opts.slides.map((_, i) => i);
  const parts = [
    {
      name: 'ppt/presentation.xml',
      data: enc.encode(
        `<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst>${order.map((n, i) => `<p:sldId id="${256 + i}" r:id="rId${n + 10}"/>`).join('')}</p:sldIdLst><p:sldSz cx="${opts.cx ?? 12192000}" cy="${opts.cy ?? 6858000}"/></p:presentation>`,
      ),
    },
    {
      name: 'ppt/_rels/presentation.xml.rels',
      data: enc.encode(`<Relationships>${opts.slides.map((_, n) => `<Relationship Id="rId${n + 10}" Type="slide" Target="slides/slide${n + 1}.xml"/>`).join('')}</Relationships>`),
    },
    ...opts.slides.flatMap((s, n) => [
      { name: `ppt/slides/slide${n + 1}.xml`, data: enc.encode(s.xml) },
      { name: `ppt/slides/_rels/slide${n + 1}.xml.rels`, data: enc.encode(`<Relationships>${s.rels ?? ''}</Relationships>`) },
    ]),
    ...Object.entries(opts.media ?? {}).map(([name, data]) => ({ name: `ppt/media/${name}`, data })),
  ];
  return buf(storeZip(parts));
}

const sp = (text: string, title = false) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="2" name="x"/><p:nvPr>${title ? '<p:ph type="title"/>' : ''}</p:nvPr></p:nvSpPr><p:txBody>${text
    .split('\n')
    .map((t) => `<a:p><a:r><a:t>${t}</a:t></a:r></a:p>`)
    .join('')}</p:txBody></p:sp>`;
const tc = (t: string) => `<a:tc><a:txBody><a:p><a:r><a:t>${t}</a:t></a:r></a:p></a:txBody></a:tc>`;
const tbl = (rows: string[][]) => `<a:tbl>${rows.map((r) => `<a:tr h="1">${r.map(tc).join('')}</a:tr>`).join('')}</a:tbl>`;
const pic = (rid: string) => `<p:pic><p:blipFill><a:blip r:embed="${rid}"/></p:blipFill></p:pic>`;

const PARCEL_MIN = handDeck({
  slides: [
    { xml: sp('NY. CONTOH / RM 1\nPJT LANTAI 4') },
    { xml: tbl([['Identitas', 'Anamnesis', 'Diagnosis'], ['5-10-2026\nPJT Lt. 4', 'S :\n- Baik', 'Diagnosis:\n- Contoh']]) },
  ],
});

const kinds = (r: { slides: Array<{ kind: string }> }) => r.slides.map((s) => s.kind);

describe('readPptx', () => {
  it('round-trips a Plano deck', async () => {
    const r = await readPptx(buf(buildPptx(SYNTH_DECK)));
    expect(kinds(r)).toEqual(['title', 'soap', 'images', 'lab', 'closing']);
    expect(r.aspect).toBe('16:9');
    const lab = r.slides.find((s) => s.kind === 'lab');
    expect(lab?.kind === 'lab' && lab.grid.rows[0]?.cells['2026-10-02']).toBe('14.2');
  });

  it('reads the SOAP date from the Identitas cell, one-digit day included', async () => {
    const soap = (await readPptx(PARCEL_MIN)).slides.find((s) => s.kind === 'soap');
    expect(soap).toMatchObject({ kind: 'soap', date: '2026-10-05', col2: 'S :\n- Baik' });
  });

  it('reads a date typed with spaces around the dash', async () => {
    const r = await readPptx(handDeck({ slides: [{ xml: sp('x') }, { xml: tbl([['Identitas', 'A', 'B'], ['21- 09-2026 PJT', 'S :', 'Dx:']]) }] }));
    expect(r.slides[1]).toMatchObject({ kind: 'soap', date: '2026-09-21' });
  });

  it('a table that is neither SOAP nor lab is unknown, not an error', async () => {
    const r = await readPptx(handDeck({ slides: [{ xml: sp('Judul') }, { xml: sp('Hasil', true) + tbl([['Obat', 'Dosis'], ['A', '1x1']]) }] }));
    expect(kinds(r)).toEqual(['title', 'unknown']);
  });

  it('EMF picture is skipped and counted; JPEG kept', async () => {
    const r = await readPptx(
      handDeck({
        slides: [
          { xml: sp('Judul') },
          {
            xml: sp('Laporan CAG 22-09-2026', true) + pic('rId2') + pic('rId3'),
            rels: '<Relationship Id="rId2" Target="../media/image1.emf"/><Relationship Id="rId3" Target="../media/image2.jpeg"/>',
          },
        ],
        media: { 'image1.emf': new Uint8Array([1]), 'image2.jpeg': new Uint8Array([2]) },
      }),
    );
    expect(r.skippedPictures).toBe(1);
    expect(r.slides[1]).toMatchObject({ kind: 'images', imageKind: 'laporan', date: '2026-09-22' });
  });

  it('4:3 deck reports its aspect', async () => {
    expect((await readPptx(handDeck({ cx: 9144000, cy: 6858000, slides: [{ xml: sp('x') }] }))).aspect).toBe('4:3');
  });

  it('slide order follows sldIdLst, not file names', async () => {
    const r = await readPptx(handDeck({ slides: [{ xml: sp('Terima kasih', true) }, { xml: sp('Judul') }], order: [1, 0] }));
    expect(kinds(r)).toEqual(['title', 'closing']);
  });

  it('a file that is not a presentation is refused', async () => {
    await expect(readPptx(buf(storeZip([{ name: 'a.txt', data: enc.encode('x') }])))).rejects.toThrow(/PowerPoint/);
  });
});

describe('guessImageKind', () => {
  it('maps captions to kinds', () => {
    expect(guessImageKind('EKG PJT Lt. 4 (07-10-2026)')).toBe('ekg');
    expect(guessImageKind('Chest X-Ray 10-11-2026')).toBe('thorax');
    expect(guessImageKind('Laporan Implantasi ppm')).toBe('laporan');
    expect(guessImageKind('Luka post ppm (12-11-2026)')).toBe('luka');
    expect(guessImageKind('Luka operasi')).toBe('luka');
    expect(guessImageKind('Laboratorium PJT')).toBe('labFoto');
    expect(guessImageKind('Foto pasien')).toBe('lainnya');
  });
});

describe('importToState', () => {
  it('puts picked SOAP days, photos, lab and text into the deck state', async () => {
    const r = await readPptx(buf(buildPptx(SYNTH_DECK)));
    const { state, photos } = importToState(r, [1, 2, 3], emptyDeckState('p1'));
    expect(state.importedDays['2026-10-05']).toEqual({ col2: 'S :\n- Baik', col3: 'Diagnosis:\n- Contoh' });
    expect(state.imageSlides).toHaveLength(1);
    expect(state.imageSlides[0]).toMatchObject({ kind: 'ekg', layout: 'one', imageIds: [photos[0]!.imageId] });
    expect(state.importedLab?.dates).toEqual(['2026-10-02']);
  });

  it('two SOAP slides with the same date are both kept', async () => {
    const twice = handDeck({
      slides: [
        { xml: sp('x') },
        { xml: tbl([['Identitas', 'A', 'B'], ['05-10-2026', 'S :\n- pagi', 'Dx:']]) },
        { xml: tbl([['Identitas', 'A', 'B'], ['05-10-2026', 'S :\n- sore', 'Dx:']]) },
      ],
    });
    const { state } = importToState(await readPptx(twice), [1, 2], emptyDeckState('p1'));
    expect(Object.values(state.importedDays).map((d) => d.col2)).toEqual(['S :\n- pagi', 'S :\n- sore']);
  });

  it('imported photo ids differ between patients (one store holds every patient)', async () => {
    const r = await readPptx(buf(buildPptx(SYNTH_DECK)));
    const a = importToState(r, [2], emptyDeckState('pA')).photos[0]!.imageId;
    const b = importToState(r, [2], emptyDeckState('pB')).photos[0]!.imageId;
    expect(a).not.toBe(b);
  });

  it('unpicked slides are left out', async () => {
    const r = await readPptx(buf(buildPptx(SYNTH_DECK)));
    expect(importToState(r, [1], emptyDeckState('p1')).photos).toHaveLength(0);
  });
});
