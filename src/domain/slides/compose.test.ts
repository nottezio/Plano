import { describe, expect, it } from 'vitest';
import type { DeckPhoto } from './deck';
import { composeDeck, orderIds, soapSourceHash, titleLines, type DeckPatient } from './compose';
import { GEOMETRY } from './geometry';
import { defaultCaption, emptyDeckState, layoutForCount, type DeckState, type ImageSlideState } from './deckState';

// Synthetic patient and notes only.
const patient: DeckPatient = { name: 'Contoh', sex: 'L', age: 54, mrn: '1234567', ward: 'PJT Lt. 4', room: '409' };
const day = (date: string, extra = ''): { date: string; body: string } => ({
  date,
  body: `S :\n- Keluhan ${date}\nO :\nTD 120/80${extra}\nDiagnosis:\n- Contoh`,
});
const LAB = '\n\n*Laboratorium PJT (02-10-2026)*\nHGB 14.2';
const photo = (id: string): DeckPhoto => ({ imageId: id, bytes: new Uint8Array([1]), mime: 'image/jpeg', widthPx: 10, heightPx: 10 });
const imageSlide = (id: string, kind: ImageSlideState['kind'], date: string): ImageSlideState => ({
  id, kind, title: `${kind} ${date}`, date, layout: 'one', imageIds: [`${id}-p`], rects: {},
});

function base(state: Partial<DeckState> = {}) {
  return {
    patient,
    days: [day('2026-10-03'), day('2026-10-02', LAB)],
    state: { ...emptyDeckState('p1'), imageSlides: [imageSlide('i1', 'ekg', '2026-10-02')], ...state },
    photos: new Map([['i1-p', photo('i1-p')], ['i2-p', photo('i2-p')]]),
  };
}

describe('composeDeck', () => {
  it('orders title, soap oldest first, images, lab, closing', () => {
    const c = composeDeck(base());
    expect(c.deck.slides.map((s) => s.kind)).toEqual(['title', 'soap', 'soap', 'images', 'lab', 'closing']);
    expect(c.deck.slides.filter((s) => s.kind === 'soap').map((s) => (s.kind === 'soap' ? s.date : ''))).toEqual(['2026-10-02', '2026-10-03']);
  });

  it('Plano day wins over the imported day; useOld switches back', () => {
    const importedDays = { '2026-10-02': { col2: 'S :\n- versi lama', col3: 'Diagnosis:\n- lama' } };
    const soapOf = (s: DeckState) => composeDeck(base(s)).deck.slides.find((x) => x.kind === 'soap' && x.date === '2026-10-02');
    expect(soapOf({ ...emptyDeckState('p1'), importedDays })).toMatchObject({ col2: expect.stringContaining('Keluhan 2026-10-02') });
    expect(soapOf({ ...emptyDeckState('p1'), importedDays, soapOverrides: { '2026-10-02': { sourceHash: '', useOld: true } } })).toMatchObject({
      col2: 'S :\n- versi lama',
    });
    expect(composeDeck(base({ importedDays })).meta.find((m) => m.id === 'soap-2026-10-02')?.hasOldVersion).toBe(true);
  });

  it('a second imported slide for the same day (key "date#2") follows the first, dated by its day', () => {
    const c = composeDeck(base({ importedDays: { '2026-09-30': { col2: 'a', col3: '' }, '2026-09-30#2': { col2: 'b', col3: '' } } }));
    expect(c.meta.slice(1, 3).map((m) => m.id)).toEqual(['soap-2026-09-30', 'soap-2026-09-30#2']);
    expect(c.deck.slides[2]).toMatchObject({ kind: 'soap', date: '2026-09-30', identitas: expect.stringMatching(/^30-09-2026/) });
  });

  it('the IGD admission note is the FIRST SOAP slide and is labelled IGD', () => {
    const c = composeDeck({ ...base(), days: [day('2026-10-03'), { date: 'igd', body: 'S :\n- masuk IGD\nDiagnosis:\n- x' }] });
    const soap = c.meta.filter((m) => m.kind === 'soap');
    expect(soap.map((m) => m.id)).toEqual(['soap-igd', 'soap-2026-10-03']);
    expect(soap[0]?.label).toBe('SOAP IGD');
    expect(c.deck.slides.find((s) => s.id === 'soap-igd')).toMatchObject({ identitas: expect.stringMatching(/^IGD/) });
  });

  it('an imported-only day becomes a slide', () => {
    const c = composeDeck(base({ importedDays: { '2026-09-30': { col2: 'S :\n- lama', col3: '' } } }));
    expect(c.meta[1]?.id).toBe('soap-2026-09-30');
  });

  it('an override with an old hash is flagged stale; a current one is not', () => {
    const stale = composeDeck(base({ soapOverrides: { '2026-10-03': { col2: 'edited', sourceHash: 'old' } } }));
    expect(stale.meta.find((m) => m.id === 'soap-2026-10-03')?.staleOverride).toBe(true);
    const current = soapSourceHash('S :\n- Keluhan 2026-10-03\nO :\nTD 120/80', 'Diagnosis:\n- Contoh');
    const fresh = composeDeck(base({ soapOverrides: { '2026-10-03': { col2: 'edited', sourceHash: current } } }));
    expect(fresh.meta.find((m) => m.id === 'soap-2026-10-03')?.staleOverride).toBe(false);
    expect(fresh.deck.slides.find((s) => s.id === 'soap-2026-10-03')).toMatchObject({ col2: 'edited' });
  });

  it('soap meta carries its override key and the hash of its source text; the merged lab grid is exposed', () => {
    const c = composeDeck(base());
    const meta = c.meta.find((m) => m.id === 'soap-2026-10-03');
    expect(meta?.overrideKey).toBe('2026-10-03');
    expect(meta?.sourceHash).toBe(soapSourceHash('S :\n- Keluhan 2026-10-03\nO :\nTD 120/80', 'Diagnosis:\n- Contoh'));
    expect(c.labGrid.dates).toEqual(['2026-10-02']);
  });

  it('a free-text slide fits its text by default and honours a manual size and centring', () => {
    const textSlides = [{ id: 't1', title: 'USG', body: '- Fatty liver' }];
    const textOf = (s: DeckState) => composeDeck(base(s)).deck.slides.find((x) => x.id === 't1');
    expect(textOf({ ...emptyDeckState('p1'), textSlides })).toMatchObject({ kind: 'text', fontPt: 24, align: 'l' });
    expect(textOf({ ...emptyDeckState('p1'), textSlides: [{ ...textSlides[0]!, pt: 40, align: 'center' }] })).toMatchObject({ fontPt: 40, align: 'ctr' });
  });

  it('a free-text box defaults to the reference area; a moved and resized one is kept and fits to its own size', () => {
    const body = Array(18).fill('- baris contoh').join('\n');
    const small = { x: 1_000_000, y: 1_500_000, w: 3_000_000, h: 1_200_000 };
    const textOf = (rect?: typeof small) =>
      composeDeck(base({ textSlides: [{ id: 't1', title: 'x', body, ...(rect ? { rect } : {}) }] })).deck.slides.find((x) => x.id === 't1');
    expect(textOf()).toMatchObject({ rect: GEOMETRY.textOnly });
    expect(textOf(small)).toMatchObject({ rect: small });
    expect((textOf(small) as { fontPt: number }).fontPt).toBeLessThan((textOf() as { fontPt: number }).fontPt);
  });

  it('a manual size that cannot fit flags the slide', () => {
    const body = Array(30).fill('baris').join('\n');
    const c = composeDeck(base({ textSlides: [{ id: 't1', title: 'x', body, pt: 60 }] }));
    expect(c.meta.find((m) => m.id === 't1')?.overflow).toBe(true);
  });

  it('a CPPT slide is a SOAP slide typed by hand, after the note days, dated and sized like one', () => {
    const c = composeDeck(base({ cpptSlides: [{ id: 'cppt-1', date: '2026-10-09', col2: 'S :\n- ketik', col3: 'Diagnosis:\n- x' }] }));
    expect(c.meta.map((m) => m.id).slice(1, 4)).toEqual(['soap-2026-10-02', 'soap-2026-10-03', 'cppt-1']);
    expect(c.deck.slides.find((s) => s.id === 'cppt-1')).toMatchObject({
      kind: 'soap', date: '2026-10-09', col2: 'S :\n- ketik', identitas: expect.stringMatching(/^09-10-2026/),
    });
    expect(c.meta.find((m) => m.id === 'cppt-1')).toMatchObject({ cpptId: 'cppt-1', label: 'CPPT 09-10-2026' });
  });

  it('a tall deck gives a long CPPT room, and the deck says it is tall', () => {
    const col2 = Array.from({ length: 55 }, () => '- baris pendek').join('\n');
    const cppt = [{ id: 'cppt-1', date: '2026-10-09', col2, col3: '' }];
    const flat = composeDeck(base({ cpptSlides: cppt }));
    const tall = composeDeck(base({ cpptSlides: cppt, tall: true }));
    expect(flat.meta.find((m) => m.id === 'cppt-1')?.overflow).toBe(true);
    expect(tall.meta.find((m) => m.id === 'cppt-1')?.overflow).toBe(false);
    expect(tall.deck.tall).toBe(true);
    expect(flat.deck.tall).toBeUndefined();
  });

  it('a hidden slide is in meta but not in the deck', () => {
    const c = composeDeck(base({ hidden: ['soap-2026-10-02'] }));
    expect(c.deck.slides.some((s) => s.id === 'soap-2026-10-02')).toBe(false);
    expect(c.meta.find((m) => m.id === 'soap-2026-10-02')?.hidden).toBe(true);
  });

  it('EKG slides come first, newest first within their group', () => {
    const c = composeDeck(base({
      imageSlides: [imageSlide('a', 'thorax', '2026-10-05'), imageSlide('i1', 'ekg', '2026-10-02'), imageSlide('i2', 'ekg', '2026-10-04')],
    }));
    expect(c.deck.slides.filter((s) => s.kind === 'images').map((s) => s.id)).toEqual(['i2', 'i1']);
  });

  it('no lab blocks and no imported lab: no lab slide', () => {
    expect(composeDeck({ ...base(), days: [day('2026-10-03')] }).deck.slides.some((s) => s.kind === 'lab')).toBe(false);
  });

  it('a saved order keeps its sequence and places tomorrow’s SOAP after the last one', () => {
    expect(orderIds(['title', 'soap-1', 'soap-2', 'soap-3', 'closing'], ['closing', 'soap-2', 'soap-1', 'title'])).toEqual([
      'closing', 'soap-2', 'soap-3', 'soap-1', 'title',
    ]);
  });
});

describe('titleLines', () => {
  it('builds the reference title', () => {
    expect(titleLines(patient).heading).toEqual(['Tn. Contoh / 54 tahun / RM 1234567', 'PJT Lt. 4 Kamar 409']);
    expect(titleLines(patient).subtitle).toMatch(/^DPJP Utama dan Tindakan : Prof\. Dr\. dr\. Muzakkir Amir/);
  });

  it('drops missing fields without stray separators', () => {
    const { heading } = titleLines({ name: 'Contoh' });
    expect(heading).toEqual(['Contoh']);
  });

  it('does not double an honorific already in the name', () => {
    expect(titleLines({ name: 'Ny. Contoh', sex: 'P' }).heading[0]).toBe('Ny. Contoh');
  });
});

describe('deckState helpers', () => {
  it('defaultCaption and layoutForCount', () => {
    expect(defaultCaption('ekg', 'PJT Lt. 4', '2026-11-12')).toBe('EKG PJT Lt. 4 12-11-2026');
    expect(layoutForCount(3)).toBe('three');
    expect(layoutForCount(7)).toBe('four');
  });
});
