import { describe, expect, it } from 'vitest';

import { SEED_CHECKLISTS } from './seeds';

describe('the seeded checklists', () => {
  it('cover the situations from the sheets', () => {
    expect(SEED_CHECKLISTS.map((list) => list.id)).toEqual([
      'poli-tindakan',
      'pindah-cvcu',
      'pindah-igd',
      'pulang-h1',
      'konsul-cabg',
    ]);
  });

  it('give every list and item a unique, stable id', () => {
    // Ids key the ticks, so two items sharing one would tick together.
    expect(new Set(SEED_CHECKLISTS.map((list) => list.id)).size).toBe(SEED_CHECKLISTS.length);
    for (const list of SEED_CHECKLISTS) {
      const ids = list.items.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('has no empty list or empty item', () => {
    for (const list of SEED_CHECKLISTS) {
      expect(list.items.length).toBeGreaterThan(0);
      expect(list.title.trim().length).toBeGreaterThan(0);
      for (const item of list.items) {
        expect(item.label.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('names the procedures the poli list applies to', () => {
    const poli = SEED_CHECKLISTS.find((list) => list.id === 'poli-tindakan');
    // The sheet's own title names three; the context adds the rest.
    const both = `${poli?.title} ${poli?.context}`;
    for (const procedure of ['CA standby', 'PPM', 'EP study', 'advanced PCI', 'staging PCI']) {
      expect(both).toContain(procedure);
    }
  });

  it('keeps the caveats as notes rather than as tickable steps', () => {
    // Turning a caveat into a step changes what ticking means: "Faktor risiko:
    // kalau NIHIL tulis di riwayat" is not something you do once and finish.
    const pulang = SEED_CHECKLISTS.find((list) => list.id === 'pulang-h1');
    expect(pulang?.notes?.join('\n')).toContain('Faktor risiko');
    expect(pulang?.items.map((item) => item.label).join('\n')).not.toContain('Faktor risiko');

    const cabg = SEED_CHECKLISTS.find((list) => list.id === 'konsul-cabg');
    expect(cabg?.notes?.join('\n')).toContain('Lee criteria');
  });

  it('keeps the specifics that make an item actionable', () => {
    const labels = SEED_CHECKLISTS.flatMap((list) => list.items.map((item) => item.label));
    // Each of these carries a detail that a paraphrase would have dropped, and
    // a checklist nobody trusts is one that has been reworded.
    expect(labels.join('\n')).toContain('DPJP utama dan DPJP tindakan');
    expect(labels.join('\n')).toContain('PDF untuk trio, PPT untuk Prof MZ');
    expect(labels.join('\n')).toContain('stop minimal 5 hari sebelum tindakan');

  });
});
