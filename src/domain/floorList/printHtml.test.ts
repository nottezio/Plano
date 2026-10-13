import { describe, expect, it } from 'vitest';

import { denahListHtml, patientHtml } from './printHtml';
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

  it('the page: title, DPJP boxes, residents on a new page, then the list; text escaped', () => {
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
});
