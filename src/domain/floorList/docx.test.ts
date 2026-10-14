import { describe, expect, it } from 'vitest';

import { wardPlan } from '@/domain/denahPlan';
import { placeBeds } from './beds';
import { buildDenahDocx, buildListDocx, denahDocumentXml, floorFileName, kjsReferenceRuns, listDocumentXml, patientRuns } from './docx';
import type { FloorPatient } from './report';

function patient(over: Partial<FloorPatient>): FloorPatient {
  return {
    key: 'rm:1', rm: '1', name: 'Tn. Contoh', identity: 'Tn. Contoh / RM 1111111', room: '417', bed: '4', floor: '4',
    dpjpId: 'ks', kjsDpjpIds: [], btkv: false, body: '', full: '', chief: 'Kepala', junior: 'Muda',
    senderNick: '', sender: '', sentAt: '2026-10-12T07:00', index: 0, discharge: null, ...over,
  };
}

describe('placeBeds', () => {
  it('puts each patient in their bed, fills free slots, keeps the overflow', () => {
    const slot = { room: '417', beds: 2 };
    const a = patient({ key: 'a', bed: '2' });
    const b = patient({ key: 'b', bed: '' });
    const c = patient({ key: 'c', bed: '2' });
    const placed = placeBeds(slot, [a, b, c]);
    expect(placed.beds.map((p) => p?.key)).toEqual(['b', 'a']);
    expect(placed.loose.map((p) => p.key)).toEqual(['c']);
    expect(placeBeds({ room: '409', beds: 1 }, [patient({ bed: '7' })]).beds[0]?.bed).toBe('7');
  });
});

describe('patientRuns', () => {
  it('colours H-1 red and pulang green, residents bold black, pediatri code amber', () => {
    const red = patientRuns(patient({ discharge: 'tomorrow', btkv: true }), { number: 1 });
    expect(red.map((r) => r.text).join('')).toBe('1. 417 Bed 4/KS/Tn. Contoh / RM 1111111 (KJS BTKV) - dr. Muda / dr. Kepala');
    expect(red[0]!.color).toBe('FF0000');
    expect(red.at(-1)).toEqual({ text: ' - dr. Muda / dr. Kepala', bold: true });
    expect(patientRuns(patient({ discharge: 'today' }))[0]!.color).toBe('00B050');
    const pedi = patientRuns(patient({ dpjpId: 'aau' }));
    expect(pedi.find((r) => r.text === 'AAU')?.color).toBe('FFC000');
  });
});

describe('List docx', () => {
  it('landscape, four columns, bold from *…*, emoji kept', () => {
    const xml = listDocumentXml('Tabe dokter *List Pasien*\n🫀 dr. KS : 1 pasien\n\n*1. 417 Bed 4/KS/Tn. A*');
    expect(xml).toContain('<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>');
    expect(xml).toContain('<w:cols w:num="4" w:space="425"/>');
    expect(xml).toContain('<w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">List Pasien</w:t>');
    expect(xml).toContain('🫀 dr. KS : 1 pasien');
    expect(xml).toContain('<w:p/>');
  });

  it('is a zip with the document, styles and footer', () => {
    const bytes = buildListDocx('x');
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]);
    const text = new TextDecoder().decode(bytes);
    for (const part of ['word/document.xml', 'word/styles.xml', 'word/footer1.xml', '[Content_Types].xml']) expect(text).toContain(part);
  });
});

describe('Denah docx', () => {
  const patients = [
    patient({ key: 'a', room: '417', bed: '4', discharge: 'today' }),
    patient({ key: 'b', room: '420', bed: '2', dpjpId: 'zd', kjsDpjpIds: ['mz'] }),
    patient({ key: 'c', room: '599', bed: '', dpjpId: 'zd', junior: '' }),
  ];
  const xml = denahDocumentXml({ ward: 'PJT Lantai 4', date: '2026-10-12', plan: wardPlan('PJT Lantai 4'), patients });

  it('titles the floor and date, draws every room and the nurse station', () => {
    expect(xml).toContain('DENAH PASIEN LANTAI 4 (12/10/2026)');
    for (const room of ['420', '421', '401', '410', '411', '412', '419']) expect(xml).toContain(`KAMAR ${room}`);
    expect(xml).toContain('NURSE STATION');
    expect(xml).toContain('w:fill="FFC000"');
  });

  it('every vertical merge continues one that was started above it', () => {
    const table = xml.slice(xml.indexOf('<w:tbl>'), xml.indexOf('</w:tbl>'));
    const rows = table.split('<w:tr>').slice(1);
    // Per grid column, a "continue" must follow a "restart" or another "continue".
    const open = new Map<number, boolean>();
    for (const row of rows) {
      let col = 0;
      for (const cell of row.split('<w:tc>').slice(1)) {
        const span = Number(/w:gridSpan w:val="(\d+)"/.exec(cell)?.[1] ?? '1');
        if (/<w:vMerge\/>/.test(cell)) expect(open.get(col)).toBe(true);
        open.set(col, /<w:vMerge w:val="restart"\/>/.test(cell) || (/<w:vMerge\/>/.test(cell) && open.get(col) === true));
        col += span;
      }
    }
  });

  it('green for pulang, DPJP tables with KJS, strays listed, residents on page 2 with the hand-filled blocks', () => {
    expect(xml).toContain('w:color w:val="00B050"');
    expect(xml).toContain('Prof. MZ');
    expect(xml).toContain('KJS:');
    expect(xml).toContain('Di luar denah:');
    expect(xml).toContain('<w:pageBreakBefore/>');
    // Residents: a table, one cell per junior with the count (13.7).
    const residents = xml.slice(xml.lastIndexOf('<w:pageBreakBefore/>'));
    expect(residents).toContain('<w:tbl>');
    expect(residents).toContain('Muda (');
    expect(residents).toContain('Tidak ada yang pegang (');
    expect(xml).toContain('Operkan ke Tmn Lain:');
    expect(xml).toContain('Ganti Chief:');
    expect(xml).toContain('dr. Kepala  3');
  });

  it('the footer carries the legend', () => {
    const text = new TextDecoder().decode(buildDenahDocx({ ward: 'PJT Lantai 4', date: '2026-10-12', plan: null, patients }));
    expect(text).toContain('Pulang Hari ini.');
    expect(text).toContain('Pasien PJT Lantai 4:');
  });

  it('a tag prints after the line in its own Word colour (the line keeps red/green) and joins the legend', () => {
    const marked = [{ ...patients[0]!, discharge: 'tomorrow' as const, tags: [{ label: 'Pre-op', color: 'purple' as const }] }];
    const runs = patientRuns(marked[0]!);
    expect(runs.at(-1)).toEqual({ text: ' [Pre-op]', bold: true, color: '7030A0' });
    expect(runs.find((r) => r.text.includes('RM'))?.color).toBe('FF0000');
    const text = new TextDecoder().decode(buildDenahDocx({ ward: 'PJT Lantai 4', date: '2026-10-12', plan: null, patients: marked }));
    expect(text).toContain('Pre-op');
  });

  it('residents are numbered; a division patient gets its own cell and no chief count', () => {
    const held = { ...patients[0]!, key: 'rm:9', junior: '', chief: '', division: 'Aritmia' };
    const out = denahDocumentXml({ ward: 'PJT Lantai 4', date: '2026-10-12', plan: null, patients: [...patients, held] });
    const residents = out.slice(out.lastIndexOf('<w:pageBreakBefore/>'));
    expect(residents).toContain('Divisi Aritmia (1, tidak di-FU)');
    expect(residents).toMatch(/<w:t xml:space="preserve">1\. /);
    expect(residents).toContain('dr. Kepala  3');
  });

  it('a KJS patient filed under another DPJP is a short grey reference in the KJS box', () => {
    expect(kjsReferenceRuns({ ...patients[0]!, room: '420', bed: '2', name: 'Tn. Contoh', dpjpId: 'zd' }, 1)).toEqual([
      { text: '1. 420 Bed 2/Tn. Contoh → ZD', color: '7F7F7F' },
    ]);
  });

  it('handover notes fill the "Operkan" and "Ganti Chief" boxes; holders printed larger (13.14)', () => {
    const noted = [{ ...patients[0]!, room: '420', bed: '2', name: 'Tn. Contoh', operkan: 'Bima', gantiChief: 'dr. Kirana' }];
    const out = denahDocumentXml({ ward: 'PJT Lantai 4', date: '2026-10-12', plan: null, patients: noted });
    expect(out).toContain('1. 420 Bed 2/Tn. Contoh → dr. Bima');
    expect(out).toContain('1. 420 Bed 2/Tn. Contoh → dr. Kirana');
    expect(out).toContain('<w:sz w:val="20"/>');
  });

  it('file names are Windows-safe', () => {
    expect(floorFileName('Denah', 'PJT Lantai 4/5', '2026-10-12')).toBe('Denah PJT Lantai 4 5 2026-10-12.docx');
  });
});
