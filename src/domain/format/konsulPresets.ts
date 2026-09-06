/**
 * The konsul reasons that have a fixed shape.
 *
 * `purpose` was — and still is — free text, deliberately: the list of things a
 * patient gets referred for is not one this app should be deciding, and a
 * closed dropdown would send the resident to another app the first time they
 * needed something not on it.
 *
 * What was wrong was that the SHAPE of the message was a second, separate
 * decision. "Echocardiography full study" is not sent as a letter about one
 * patient; it is one numbered line added to a list several residents share,
 * and that is what `listStyle` produces. So the resident had to know, and
 * remember, that this particular referral needs the checkbox ticked — and the
 * checkbox is silent about it. Getting it wrong sends a letter to a list, or a
 * list entry as a letter, and neither is obviously wrong on screen.
 *
 * A preset ties the two together: choosing the reason chooses the shape,
 * because for these two the shape follows from the reason. `Lainnya` keeps the
 * free-text path intact for everything else, with the checkbox still available
 * there — a preset removes a decision that had one right answer, it does not
 * remove the ability to decide.
 *
 * Only the two Avi named. This list grows from real referrals, not from
 * guesses about what else might be useful.
 */
export interface KonsulPreset {
  id: string;
  /** Shown in the dropdown. */
  label: string;
  /**
   * The words that land in the opening sentence, after "pasien rencana".
   *
   * Held separately from `label` because the dropdown wants something short to
   * read and the sentence wants something a consultant would write.
   */
  purpose: string;
  /** Sent as a numbered entry in a shared list rather than as a letter. */
  listStyle: boolean;
  /** Shown under the dropdown, so the shape it chose is visible, not implied. */
  note: string;
}

/** Selected when the referral is not one of the presets — purpose is typed. */
export const KONSUL_CUSTOM_ID = 'lainnya';

export const KONSUL_PRESETS: readonly KonsulPreset[] = [
  {
    id: '6mwt',
    label: '6MWT',
    // Unchanged from the free-text default this replaces, so that switching to
    // the dropdown does not quietly reword a message already in use.
    purpose: '6MWT',
    listStyle: false,
    note: 'Dikirim sebagai konsul satu pasien. TB dan BB ikut disertakan.',
  },
  {
    id: 'echo-full',
    label: 'Echocardiography full study',
    purpose: 'Echocardiography full study',
    listStyle: true,
    note: 'Dikirim sebagai list pasien bernomor, bukan surat konsul.',
  },
];

export function konsulPresetById(id: string): KonsulPreset | null {
  return KONSUL_PRESETS.find((preset) => preset.id === id) ?? null;
}
