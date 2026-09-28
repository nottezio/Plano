import { describe, expect, it } from 'vitest';

import { checkSoap, readLabs, readVitals } from './soapCheck';

const VITALS = [
  'Tekanan Darah : 121/82 mmHg',
  'Nadi : 86 kali/menit, reguler',
  'Pernapasan : 18 kali/menit',
  'Suhu : 36.6 derajat Celcius',
  'SpO2 : 98 % on room air',
].join('\n');

const kinds = (body: string, previous?: string): string[] =>
  checkSoap({ body, previous }).map((finding) => finding.kind);

describe('readVitals', () => {
  it('reads the block the corpus actually writes', () => {
    expect(readVitals(VITALS)).toEqual({
      'Tekanan darah': '121/82',
      Nadi: '86',
      Pernapasan: '18',
      Suhu: '36.6',
      SpO2: '98',
    });
  });

  it('normalises the decimal comma, which appears in half the notes', () => {
    expect(readVitals('Suhu : 36,8 derajat Celcius')['Suhu']).toBe('36.8');
  });
});

describe('readLabs', () => {
  it('reads Na/K/Cl as three values from one line', () => {
    expect(readLabs('Na/K/Cl 136/3.6/103')).toMatchObject({ Na: 136, K: 3.6, Cl: 103 });
  });

  it('reads the spaced and colonned variant too', () => {
    expect(readLabs('Na/K/Cl : 129/4.3/103')).toMatchObject({ Na: 129, K: 4.3 });
  });

  it('reads haemoglobin under either spelling', () => {
    expect(readLabs('HGB 11.9')['Hb']).toBe(11.9);
    expect(readLabs('Hb: 14.4')['Hb']).toBe(14.4);
  });
});

describe('vitals', () => {
  it('says nothing when the vitals changed', () => {
    const before = 'Tekanan Darah : 130/80\nNadi : 70\nSuhu : 36.5\nSpO2 : 98';
    expect(kinds(VITALS, before)).not.toContain('vitals-unchanged');
  });

  it('flags a block copied forward unedited', () => {
    expect(kinds(VITALS, VITALS)).toContain('vitals-unchanged');
  });

  it('does not flag one repeated vital', () => {
    // A temperature genuinely the same two days running is ordinary; the whole
    // block repeating is a copy nobody edited.
    const before = 'Tekanan Darah : 130/80\nNadi : 70\nPernapasan : 20\nSuhu : 36.6\nSpO2 : 95';
    expect(kinds(VITALS, before)).not.toContain('vitals-unchanged');
  });

  it('flags a note with no vitals at all', () => {
    expect(kinds('A:\n- CHF NYHA III')).toContain('vitals-missing');
  });
});

describe('stale numbers', () => {
  it('flags a diagnosis quoting a potassium the lab has moved past', () => {
    const body = `${VITALS}\nNa/K/Cl 136/3.7/103\nA:\n- Hypokalemia (2.9)`;
    expect(kinds(body)).toContain('diagnosis-value-stale');
  });

  it('accepts the arrow form, where the right-hand number is current', () => {
    // `Hypokalemia (2.9 --> 3.7)` is how a correction in progress is written.
    // Comparing the admission value would flag every improving patient daily.
    const body = `${VITALS}\nNa/K/Cl 136/3.7/103\nA:\n- Hypokalemia (2.9 --> 3.7)`;
    expect(kinds(body)).not.toContain('diagnosis-value-stale');
  });

  it('tolerates a trailing zero rather than calling it a mismatch', () => {
    const body = `${VITALS}\nNa/K/Cl 136/3.60/103\nA:\n- Hypokalemia (3.6)`;
    expect(kinds(body)).not.toContain('diagnosis-value-stale');
  });

  it('flags anemia with no haemoglobin anywhere in the note', () => {
    expect(kinds(`${VITALS}\nA:\n- Anemia normositik normokrom`)).toContain('anemia-without-hb');
  });

  it('is quiet when the haemoglobin is there', () => {
    expect(kinds(`${VITALS}\nHGB 9.1\nA:\n- Anemia`)).not.toContain('anemia-without-hb');
  });
});

describe('plan versus result', () => {
  it('flags a lab still planned after its result is in the note', () => {
    const body = `${VITALS}\nNa/K/Cl 136/3.6/103\nP:\n- Cek elektrolit`;
    expect(kinds(body)).toContain('lab-planned-but-resulted');
  });

  it('leaves a planned lab alone when nothing has resulted', () => {
    expect(kinds(`${VITALS}\nP:\n- Cek darah rutin`)).not.toContain('lab-planned-but-resulted');
  });
});

describe('day counters', () => {
  it('flags a counter that did not move from yesterday', () => {
    const body = `${VITALS}\nA:\n- post PPM H-2`;
    expect(kinds(body, `${VITALS}\nA:\n- post PPM H-2`)).toContain('day-marker');
  });

  it('says nothing once it has been advanced', () => {
    const body = `${VITALS}\nA:\n- post PPM H-3`;
    expect(kinds(body, `${VITALS}\nA:\n- post PPM H-2`)).not.toContain('day-marker');
  });

  it('stays quiet once the banner has been dismissed by hand', () => {
    const note = `${VITALS}\nA:\n- post PPM H-2`;
    const findings = checkSoap({ body: note, previous: note, dayMarkersDismissed: true });
    expect(findings.map((f) => f.kind)).not.toContain('day-marker');
  });
});

describe('an empty note', () => {
  it('produces nothing at all', () => {
    // A blank day is a day not started, not a day with five problems.
    expect(checkSoap({ body: '   ' })).toEqual([]);
  });
});

describe('a second value on the diagnosis line', () => {
  const body = [
    'Tekanan Darah : 121/82',
    'Nadi : 86',
    'Suhu : 36.6',
    'Na/K/Cl 136/3.6/103',
    '*Mohon izin kami assess dengan:*',
    '- Moderate Hyponatremia (131 -> 129 -> 136) Hipoosmolal (265)',
  ].join('\n');

  it('does not mistake the osmolality for the sodium', () => {
    // Reported 12 September: the checker announced "diagnosis menyebut Na 265,
    // lab terbaru 136" about a note that was entirely correct. Reading the
    // last number on the LINE picks up whatever value happens to follow.
    expect(checkSoap({ body }).map((f) => f.kind)).not.toContain('diagnosis-value-stale');
  });

  it('still reads the analyte’s own arrow chain', () => {
    const stale = body.replace('131 -> 129 -> 136', '131 -> 129');
    expect(checkSoap({ body: stale }).map((f) => f.kind)).toContain('diagnosis-value-stale');
  });

  it('is not confused by a trailing note in its own brackets', () => {
    const withNote = 'Na/K/Cl 136/3.6/103\n- Hyponatremia (136) e.c. SIADH (suspek)';
    expect(checkSoap({ body: `Nadi : 80\nSuhu : 36.5\nTekanan Darah : 120/80\n${withNote}` })
      .map((f) => f.kind)).not.toContain('diagnosis-value-stale');
  });
});

describe('a consult that answered but is not in the DPJP list', () => {
  const base = 'Tekanan Darah : 120/80\nNadi : 80\nSuhu : 36.5';

  it('flags a TS block whose service is missing from the header', () => {
    // 49 entries in the 2026-09-11 export are in this state. The DPJP header
    // is who the report is addressed from; a co-managing service missing from
    // it simply does not get the note.
    const body = `${base}\n_DPJP Utama : dr. Aussie_\n\n*TS Pulmo*\nA/ Pneumonia\nP/ Levofloxacin`;
    expect(kinds(body)).toContain('consult-not-in-dpjp');
  });

  it('accepts a header that spells the service differently', () => {
    // `TS Pulmo` in the block, `DPJP Pulmonologi` in the header — the same
    // service, and the two lines rarely agree on the spelling.
    const body = `${base}\n_DPJP Pulmonologi : dr. X_\n\n*TS Pulmo*\nA/ Pneumonia`;
    expect(kinds(body)).not.toContain('consult-not-in-dpjp');
  });

  it('says nothing when there is no consult at all', () => {
    expect(kinds(`${base}\n_DPJP Utama : dr. Aussie_`)).not.toContain('consult-not-in-dpjp');
  });
});

describe('an electrolyte back in range', () => {
  const body = [
    'Tekanan Darah : 120/80',
    'Nadi : 80',
    'Suhu : 36.5',
    'Na/K/Cl 136/4.1/103',
    '- Hypokalemia (2.9 --> 4.1)',
  ].join('\n');

  const RANGES = { K: { low: 3.5, high: 5.1 } };

  it('suggests marking it as perbaikan', () => {
    const findings = checkSoap({ body, ranges: RANGES });
    expect(findings.map((f) => f.kind)).toContain('electrolyte-corrected');
  });

  it('is SILENT with no range supplied', () => {
    // Plano ships no reference ranges. Without one there is no honest way to
    // call a number normal, and guessing would be hardcoding a range by
    // another route.
    expect(checkSoap({ body }).map((f) => f.kind)).not.toContain('electrolyte-corrected');
  });

  it('stops once the line already says perbaikan', () => {
    const done = body.replace('(2.9 --> 4.1)', '(2.9 --> 4.1) perbaikan');
    expect(checkSoap({ body: done, ranges: RANGES }).map((f) => f.kind)).not.toContain(
      'electrolyte-corrected',
    );
  });

  it('stays quiet while the value is still outside the range', () => {
    const low = body.replace('136/4.1/103', '136/3.1/103').replace('--> 4.1', '--> 3.1');
    expect(checkSoap({ body: low, ranges: RANGES }).map((f) => f.kind)).not.toContain(
      'electrolyte-corrected',
    );
  });
});

describe('the day-marker rule’s default state', () => {
  // Guards the wiring bug found on 13 September: the caller was passing
  // `staleMarkers === null` as "dismissed", which is true on essentially every
  // note, so this rule never fired at all. A check that finds nothing looks
  // exactly like a check that is switched off — hence an explicit test that
  // the DEFAULT is "not dismissed".
  const note = 'Tekanan Darah : 120/80\nNadi : 80\nSuhu : 36.5\nA:\n- post PPM H-2';

  it('fires when the flag is simply absent', () => {
    expect(checkSoap({ body: note, previous: note }).map((f) => f.kind)).toContain('day-marker');
  });

  it('fires when the flag is explicitly false', () => {
    expect(
      checkSoap({ body: note, previous: note, dayMarkersDismissed: false }).map((f) => f.kind),
    ).toContain('day-marker');
  });

  it('is suppressed only by an explicit true', () => {
    expect(
      checkSoap({ body: note, previous: note, dayMarkersDismissed: true }).map((f) => f.kind),
    ).not.toContain('day-marker');
  });
});

describe('urine and balance', () => {
  const base = 'Tekanan Darah : 120/80\nNadi : 80\nSuhu : 36.5';
  const yesterday = `${base}\nUrine 1900 cc/24 jam/60 kg=1,3 cc/kgBB/jam\nBalance cairan +250 cc`;

  it('flags a urine line copied forward unchanged', () => {
    // Measured on the 2026-09-11 export: urine repeats in 13 of 41 consecutive
    // pairs, balance in 12 of 30 — roughly a third of the time, against 5 of
    // 94 for the whole vitals block.
    expect(kinds(yesterday, yesterday)).toContain('flow-unchanged');
  });

  it('says nothing once the number changed', () => {
    const today = yesterday.replace('1900 cc', '2100 cc').replace('+250 cc', '+180 cc');
    expect(kinds(today, yesterday)).not.toContain('flow-unchanged');
  });

  it('says nothing when yesterday had none to compare against', () => {
    expect(kinds(yesterday, base)).not.toContain('flow-unchanged');
  });

  it('does not flag an echo or a chest film repeated from yesterday', () => {
    // Identical 80% of the time in the same corpus, and correctly so: the
    // study was not repeated. The test is whether the number is measured
    // every day, not whether it changed.
    const withEcho = `${base}\nEchocardiography (08-09-2026)\n- EF 48.3% (TEICH)`;
    expect(kinds(withEcho, withEcho)).not.toContain('flow-unchanged');
  });
});

/**
 * A complete note in the shape the templates produce, filled in properly.
 * The checker's first duty is to say NOTHING about it: a checker that fires on
 * a good note is one people stop reading.
 */
const GOOD_YESTERDAY = [
  '*S:*',
  '- Sesak berkurang, nyeri dada tidak ada.',
  '- Pasien saat ini hari perawatan ke 4 hari',
  '',
  '*O:*',
  'Compos Mentis GCS (E4V5M6)',
  'Tekanan Darah : 118/76 mmHg',
  'Nadi : 84 kali/menit, reguler',
  'Pernapasan : 20 kali/menit',
  'Suhu : 36.6 derajat Celcius',
  'SpO2 : 97 % on room air',
  '',
  '*A:*',
  '- ADHF ec CAD',
  '',
  '*P:*',
  '- Furosemid 40 mg iv tiap 12 jam',
  '- Cek elektrolit ulang besok',
].join('\n');

const GOOD_TODAY = GOOD_YESTERDAY
  .replace('Sesak berkurang, nyeri dada tidak ada.', 'Sesak tidak ada, bisa tidur telentang.')
  .replace('hari perawatan ke 4', 'hari perawatan ke 5')
  .replace('118/76', '112/70')
  .replace('Nadi : 84', 'Nadi : 78');

describe('a good note', () => {
  it('produces no findings at all', () => {
    expect(checkSoap({ body: GOOD_TODAY, previous: GOOD_YESTERDAY })).toEqual([]);
  });
});

describe('vitals written the ward’s way', () => {
  it('reads TD / N / RR / Saturasi and the one-line form, so no false "Tidak ada TTV"', () => {
    expect(kinds('*O:*\nTD 120/80 mmHg, N 88x/m, RR 20x/m, S 36.5, SpO2 98%')).not.toContain('vitals-missing');
    expect(readVitals('*O/*\nGCS E4V5M6; Tensi : 150/90 mmHg; Nafas : 22 x/m; Saturasi : 95% on room air')).toMatchObject({
      'Tekanan darah': '150/90',
      Pernapasan: '22',
      SpO2: '95',
    });
  });

  it('names the vitals left blank, as carry-forward leaves them', () => {
    const findings = checkSoap({ body: '*O:*\nTekanan Darah :  mmHg\nNadi :  kali/menit, reguler\nSuhu : 36.5 derajat' });
    const blank = findings.find((finding) => finding.kind === 'vitals-blank');
    expect(blank?.message).toBe('TTV belum diisi: Tekanan darah, Nadi.');
    expect(blank?.level).toBe('isi');
    expect(findings.map((finding) => finding.kind)).not.toContain('vitals-missing');
  });

  it('does not take heart sounds or lung findings for vitals', () => {
    expect(readVitals('*O:*\nBJ S1 S2 tunggal\nPulmo: pernapasan vesikuler')).toEqual({});
  });
});

describe('empty sections', () => {
  it('flags an S emptied by carry-forward and never refilled', () => {
    expect(kinds(GOOD_TODAY.replace(/\*S:\*\n- Sesak[^\n]*\n- Pasien[^\n]*/, '*S:*\n- '))).toContain('section-empty');
  });

  it('treats P and Terapi together: one filled is a plan', () => {
    const body = '*S:*\n- sesak\n*O:*\nTD 120/80\n*A:*\n- CHF\n*P:*\n- \nTerapi:\n- Furosemid 40 mg';
    expect(checkSoap({ body }).filter((finding) => finding.kind === 'section-empty')).toEqual([]);
  });
});

describe('copied from yesterday', () => {
  it('flags S identical to yesterday’s', () => {
    const today = GOOD_TODAY.replace('Sesak tidak ada, bisa tidur telentang.', 'Sesak berkurang, nyeri dada tidak ada.').replace('hari perawatan ke 5', 'hari perawatan ke 4');
    const found = checkSoap({ body: today, previous: GOOD_YESTERDAY }).map((finding) => finding.kind);
    expect(found).toContain('subjective-unchanged');
    expect(found).toContain('hari-rawat');
  });

  it('says how the hari perawatan disagrees with yesterday', () => {
    const skipped = GOOD_TODAY.replace('hari perawatan ke 5', 'hari perawatan ke 7');
    const finding = checkSoap({ body: skipped, previous: GOOD_YESTERDAY }).find((f) => f.kind === 'hari-rawat');
    expect(finding?.message).toBe('Hari perawatan ke-7, kemarin ke-4.');
  });
});

describe('template holes', () => {
  it('finds each shape a template leaves unfilled', () => {
    const body = [
      '*S:*',
      '- Pasien saat ini hari perawatan ke  hari,',
      '- ',
      '*O:*',
      'TD 120/80',
      'TB :  cm',
      '_Post Tindakan :  ()_',
      '*A:*',
      '- CHF, EF xx %',
      '*P:*',
      '- Furosemid',
    ].join('\n');
    const messages = checkSoap({ body }).filter((f) => f.kind === 'unfilled' || f.kind === 'placeholder').map((f) => f.message);
    expect(messages).toEqual([
      'Hari perawatan belum diisi.',
      'TB belum diisi.',
      'Ada kurung kosong “()”.',
      'Ada 1 butir “-” kosong.',
      'Masih ada penanda sementara “xx”.',
    ]);
  });

  it('points at the right place, not the first matching text', () => {
    const body = '*S:*\n- sesak\n- \n*O:*\nTD 120/80\n*A:*\n- CHF\n*P:*\n- lasix';
    const bullet = checkSoap({ body }).find((f) => f.kind === 'unfilled');
    expect(body.slice(bullet!.at!, bullet!.at! + 2)).toBe('- ');
    expect(bullet!.at).toBe(body.indexOf('- \n'));
  });
});

describe('plans and duplicates', () => {
  const RESULTED = 'Na/K/Cl 136/3.6/103';

  it('flags a one-off lab plan once the result is in', () => {
    expect(kinds(`*O:*\nTD 120/80\n${RESULTED}\n*P:*\n- Cek elektrolit`)).toContain('lab-planned-but-resulted');
  });

  it('leaves a plan for the NEXT result alone', () => {
    for (const plan of ['- Cek elektrolit ulang besok', '- Cek lab serial', '- Cek elektrolit per 12 jam']) {
      expect(kinds(`*O:*\nTD 120/80\n${RESULTED}\n*P:*\n${plan}`)).not.toContain('lab-planned-but-resulted');
    }
  });

  it('flags the same line pasted twice in one section', () => {
    const body = '*P:*\n- Furosemid 40 mg iv tiap 12 jam\n- Spironolakton 25 mg\n- Furosemid 40 mg iv tiap 12 jam';
    expect(kinds(body)).toContain('duplicate-line');
  });
});

describe('order', () => {
  it('lists what to fill first, then what was copied, then what to check', () => {
    const body = GOOD_TODAY.replace('hari perawatan ke 5', 'hari perawatan ke 4').replace('- Furosemid 40 mg iv tiap 12 jam', '- Furosemid 40 mg iv tiap 12 jam\n- Furosemid 40 mg iv tiap 12 jam\n- ');
    const levels = checkSoap({ body, previous: GOOD_YESTERDAY }).map((finding) => finding.level);
    expect(levels).toEqual([...levels].sort((a, b) => ['isi', 'kemarin', 'cek'].indexOf(a) - ['isi', 'kemarin', 'cek'].indexOf(b)));
    expect(levels[0]).toBe('isi');
  });
});

/**
 * Reported 29 September: "Lab sudah ada hasilnya tapi masih tertulis di Plan"
 * on a patient with no lab plan, and "Tampilkan" jumped to "Planimetry" in
 * the echo. The rule read every line of the note, and its anchor was the bare
 * word `Plan`.
 */
describe('lab planned but resulted — only the plan counts, and it points at the line', () => {
  const NOTE = [
    '*S:*',
    '- Periksa lab di puskesmas 1 minggu lalu, Hb 9',
    '*O:*',
    'TD 110/70',
    '*Echocardiography (27 Sep)*',
    'MS severe, MVA planimetry 0.8 cm2',
    '*Laboratorium (28 Sep)*',
    'Na/K/Cl 136/3.6/103',
    '*A:*',
    '- Severe MS',
    '*P:*',
    '- Rencana PTMC',
  ].join('\n');

  it('is silent when no plan line asks for a lab', () => {
    expect(kinds(NOTE)).not.toContain('lab-planned-but-resulted');
  });

  it('when it fires, quotes and points at the plan line itself', () => {
    const body = NOTE.replace('- Rencana PTMC', '- Rencana PTMC\n- Cek elektrolit');
    const finding = checkSoap({ body }).find((f) => f.kind === 'lab-planned-but-resulted')!;
    expect(finding.message).toBe('Lab sudah ada hasilnya, tapi Plan masih menulis “Cek elektrolit”.');
    expect(body.slice(finding.at!, finding.at! + finding.anchor!.length)).toBe('- Cek elektrolit');
  });

  it('reads the plan’s sub-blocks too (Plan Monitoring, Terapi)', () => {
    const body = NOTE.replace('- Rencana PTMC', '- Rencana PTMC\nPlan Monitoring:\n- Cek DL');
    expect(kinds(body)).toContain('lab-planned-but-resulted');
  });
});

describe('every finding points at its own text', () => {
  it('a stale diagnosis value points at the diagnosis, not the first letter K in the note', () => {
    const body = '*O:*\nTD 120/80, Kesadaran baik\nNa/K/Cl 136/3.9/103\n*A:*\n- Hypokalemia (2.9)\n*P:*\n- KSR';
    const finding = checkSoap({ body }).find((f) => f.kind === 'diagnosis-value-stale')!;
    expect(body.slice(finding.at!).startsWith('Hypokalemia')).toBe(true);
  });

  it('no finding ever anchors on a bare word it did not match', () => {
    const body = GOOD_TODAY.replace('- ADHF ec CAD', '- ADHF ec CAD\n- Anemia ringan').replace('hari perawatan ke 5', 'hari perawatan ke 5\nPlanimetry');
    for (const finding of checkSoap({ body, previous: GOOD_YESTERDAY })) {
      if (finding.anchor === undefined) continue;
      expect(finding.at).toBeDefined();
      expect(body.slice(finding.at!, finding.at! + finding.anchor.length).toLowerCase()).toBe(finding.anchor.toLowerCase());
    }
  });
});
