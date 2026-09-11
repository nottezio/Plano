import { describe, expect, it } from 'vitest';

import { DPJPS, describeDelivery, dpjpById } from './dpjp';

/**
 * Where each consultant's report actually goes.
 *
 * The list Avicenna supplied, updated 2026-09-11. It is the thing a resident
 * most often has to ask somebody about, and getting it wrong means a report
 * sitting unread in the wrong place.
 *
 * Asserted on the ROUTE, not on the sentence. The sentence is generated and
 * may be reworded; the route is the fact, and a test that breaks on a comma is
 * a test people learn to update without reading.
 */
describe('DPJP delivery routes', () => {
  describe('via chief — chief forwards to the DPJP and to grup prodi', () => {
    it.each([
      ['afm', true],
      ['zd', true],
      ['afg', true],
    ])('%s expects a PDF', (id, pdf) => {
      expect(dpjpById(id)?.delivery).toMatchObject({ route: 'chief', pdf });
    });

    it('Az Hafid goes through the chief but WITHOUT a PDF', () => {
      // The one exception in this group, and the reason `pdf` is a field
      // rather than being implied by the route.
      expect(dpjpById('ahn')?.delivery).toMatchObject({ route: 'chief', pdf: false });
    });
  });

  describe('sent by the resident, to the consultant’s group', () => {
    it.each([
      ['ks', 'grup dr. Khalid'],
      ['pt', 'grup dr. Pendrik'],
      ['pk', 'grup Prof PK'],
      ['arb', 'grup dr. Rio'],
      ['mz', 'grup Prof MZ'],
    ])('%s goes to %s', (id, channel) => {
      expect(dpjpById(id)?.delivery).toMatchObject({ route: 'group', channel });
    });

    it('Prof MZ carries the slide note, because it changes what you prepare', () => {
      expect(dpjpById('mz')?.delivery?.note).toContain('slide');
    });
  });

  describe('personal WhatsApp only — never a group', () => {
    it.each([['im'], ['maa']])('%s is wapri', (id) => {
      expect(dpjpById(id)?.delivery).toMatchObject({ route: 'dm' });
    });
  });

  it('never claims a PDF for a personal-WhatsApp route', () => {
    // `pdf` is meaningless there; setting it would imply a step that does not
    // exist and cost somebody the time to build one.
    for (const dpjp of DPJPS) {
      if (dpjp.delivery?.route === 'dm') expect(dpjp.delivery.pdf).toBeUndefined();
    }
  });

  it('names a channel for every group route', () => {
    for (const dpjp of DPJPS) {
      if (dpjp.delivery?.route === 'group') expect(dpjp.delivery.channel).toBeTruthy();
    }
  });
});

describe('describeDelivery', () => {
  it('says whether to build a PDF, which is the expensive half of the answer', () => {
    expect(describeDelivery({ route: 'chief', pdf: true })).toContain('PDF ke chief');
    expect(describeDelivery({ route: 'chief', pdf: false })).toContain('tanpa PDF');
  });

  it('says wapri explicitly, so it is not read as "the usual group"', () => {
    expect(describeDelivery({ route: 'dm' })).toContain('bukan ke grup');
  });

  it('appends a consultant-specific note rather than hiding it', () => {
    expect(
      describeDelivery({ route: 'group', channel: 'grup Prof MZ', note: 'ada slide tersendiri' }),
    ).toBe('Kirim sendiri ke grup Prof MZ — ada slide tersendiri');
  });
});
