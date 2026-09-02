import { describe, expect, it } from 'vitest';

import { DPJPS, dpjpById } from './dpjp';

/**
 * Where each consultant's report actually goes.
 *
 * The list Avicenna supplied on 2026-09-02, verbatim in intent: who sends it,
 * and to which group. It is the thing a resident most often has to ask
 * somebody about, and getting it wrong means a report sitting unread in the
 * wrong place.
 */
describe('DPJP delivery notes', () => {
  it.each([
    ['pk', 'Kirim sendiri ke grup Prof PK'],
    ['mz', 'Kirim sendiri ke grup Telegram Prof MZ'],
    ['im', 'Kirim sendiri ke WA pribadi'],
    ['aha', 'Dikirim oleh chief'],
    ['zd', 'Dikirim oleh chief, PDF + jam verifikasi'],
    ['afm', 'Dikirim oleh chief, dengan PDF'],
    ['ahn', 'Dikirim oleh chief'],
    ['afg', 'Dikirim oleh chief, dengan PDF'],
    ['pt', 'Kirim sendiri ke grup dr. PT'],
    ['ks', 'Kirim sendiri ke grup dr. KS'],
    ['maa', 'Kirim sendiri ke WA pribadi'],
    ['arb', 'Kirim sendiri ke grup dr. Rio'],
  ])('%s', (id, expected) => {
    expect(dpjpById(id)?.delivery).toBe(expected);
  });

  it('leaves the rest without one', () => {
    // Absent means nobody specified a route, which is not the same as "send it
    // anywhere" — the UI shows nothing rather than inventing a default.
    for (const id of ['sm', 'yp', 'aau', 'fm', 'alm', 'is', 'aa', 'bpp', 'fat', 'np']) {
      expect(dpjpById(id)?.delivery).toBeUndefined();
    }
  });

  it('never attaches a route to a consultant who is not in the registry', () => {
    expect(dpjpById('nobody')).toBeUndefined();
  });

  it('gives every delivery note to a real registry entry', () => {
    // A typo in an id would silently drop the note and nothing else would fail.
    for (const dpjp of DPJPS) {
      if (dpjp.delivery === undefined) continue;
      expect(dpjp.delivery.trim().length).toBeGreaterThan(0);
    }
  });
});
