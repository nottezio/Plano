import { describe, expect, it } from 'vitest';

import { denahListHtml, patientHtml, previewHtml } from './printHtml';
import { DEFAULT_PRINT } from './printSettings';
import type { FloorPatient } from './report';

const p = (over: Partial<FloorPatient>): FloorPatient =>
  ({ key: 'rm:1', rm: '1', name: 'Tn. Contoh', identity: 'Tn. Contoh / RM 1', room: '417', bed: '1', dpjpId: 'ks', kjsDpjpIds: [], btkv: false, junior: 'Bima', chief: 'Kepala', discharge: null, ...over }) as FloorPatient;

describe('Denah + List as one printable page (13.12)', () => {
  it('a line: red for H-1, printed tags only, never the SOAP-update mark', () => {
    const html = patientHtml(
      p({ discharge: 'tomorrow', soap: 'baru', tags: [{ label: 'Pre-op', color: 'purple' }, { label: 'Cek SOAP', color: 'grey', print: false }] }),
      { number: 1 },
    );
    expect(html).toContain('color:#ff0000');
    expect(html).toContain('[Pre-op]');
    expect(html).not.toContain('Cek SOAP');
    expect(html).not.toMatch(/SOAP baru/);
    expect(html).toContain('<b>- dr. Bima / dr. Kepala</b>');
  });

  it('the page: title, DPJP boxes, residents, then the list; text escaped', () => {
    const html = denahListHtml({
      ward: 'PJT Lantai 4',
      date: '2026-10-13',
      plan: null,
      patients: [p({}), p({ key: 'rm:2', rm: '2', identity: 'Ny. <Dua>', junior: '', division: 'Aritmia' })],
      listText: '*Judul*\n1. baris',
    });
    expect(html).toContain('DENAH PASIEN LANTAI 4 (13/10/2026)');
    expect(html).toContain('Ny. &lt;Dua&gt;');
    expect(html).toContain('Divisi Aritmia (1, tidak di-FU)');
    expect(html).toContain('<b>Judul</b>');
    expect(html.indexOf('Operkan ke Tmn Lain')).toBeLessThan(html.indexOf('<b>Judul</b>'));
  });

  it('prints the list on a landscape page in four columns, the denah in portrait (2026-10-14)', () => {
    const html = denahListHtml({ ward: 'PJT Lantai 4', date: '2026-10-13', plan: null, patients: [p({})], listText: '1. baris' });
    expect(html).toContain('@page { size: A4; margin: 10mm; }');
    expect(html).toContain('@page listpage { size: A4 landscape;');
    expect(html).toMatch(/\.list \{ page: listpage; columns: 4;[^}]*font-size: 6\.5pt; \}/);
    // Columns fill top to bottom, the last page too (2026-10-14): not balanced across all four.
    expect(html).toContain('column-fill: auto');
    expect(html).toContain('<div class="page list">');
  });

  it('residents follow the DPJP boxes unless the setup asks for a new page (2026-10-16)', () => {
    const input = { ward: 'PJT Lantai 4', date: '2026-10-13', plan: null, patients: [p({})], listText: '1. baris' };
    expect(denahListHtml(input)).toContain('<div class="after" data-residents="">');
    const own = denahListHtml(input, {
      list: { landscape: false, columns: 2, fontPt: 8 },
      denah: { landscape: true, fontPt: 9, residentsNewPage: true, residentsList: false },
    });
    expect(own).toContain('<div class="page" data-residents="">');
    expect(own).toContain('@page { size: A4 landscape; margin: 10mm; }');
    expect(own).toContain('@page listpage { size: A4 portrait;');
    expect(own).toMatch(/\.list \{ page: listpage; columns: 2;[^}]*font-size: 8pt; \}/);
    expect(own).toContain('font-size: 9pt;');
  });

  it('the preview is one text box wide, the list one page tall (2026-10-16)', () => {
    const input = { ward: 'PJT Lantai 4', date: '2026-10-13', plan: null, patients: [p({})], listText: '1. baris' };
    expect(previewHtml('denah', input, DEFAULT_PRINT)).toContain('<div class="sheet" style="width:190mm">');
    // Landscape A4 less 8 mm margins: 281 × 194 mm.
    expect(previewHtml('list', input, DEFAULT_PRINT)).toContain('width:281mm;height:194mm;columns: 4;');
    expect(previewHtml('list', input, DEFAULT_PRINT)).not.toContain('@page');
  });
});

describe('Residen as a list follows the screen (20 Oct 2026)', () => {
  const two = [p({ key: 'a', junior: 'Bima' }), p({ key: 'b', rm: '2', junior: 'Kirana' })];
  const residents = (html: string): string => html.slice(html.indexOf('data-residents'));
  it('boxes: holders three to a row', () => {
    expect(residents(denahListHtml({ ward: 'PJT Lantai 4', date: '2026-10-20', plan: null, patients: two, listText: '' }))).toMatch(
      /<tr><td><div class="holder">Bima[^]*?<td><div class="holder">Kirana/,
    );
  });
  it('list: one holder per row', () => {
    const html = denahListHtml(
      { ward: 'PJT Lantai 4', date: '2026-10-20', plan: null, patients: two, listText: '' },
      { ...DEFAULT_PRINT, denah: { ...DEFAULT_PRINT.denah, residentsList: true } },
    );
    expect(residents(html)).toMatch(/<tr><td><div class="holder">Bima[^]*?<\/td><\/tr><tr><td><div class="holder">Kirana/);
  });
});
