import type { ShiftNote } from './types';

/**
 * `HH.MM`, not `HH:MM`.
 *
 * A colon is a heading delimiter to the section parser. Shift note text gets
 * pasted into bodies and copied into WhatsApp, and a stamp that turns into a
 * section header the next time it lands in an editor is a trap worth avoiding
 * for the cost of one character.
 */
export function formatShiftTime(at: Date): string {
  const hh = String(at.getHours()).padStart(2, '0');
  const mm = String(at.getMinutes()).padStart(2, '0');
  return `${hh}.${mm}`;
}

/**
 * Ids are generated here rather than by index.
 *
 * The array is never reordered and entries are never spliced out, but an
 * index-based key would still break the moment either happens — and the tick
 * state in the copy sheet is keyed on this. A value that is only stable while
 * nobody touches the list is not a stable value.
 */
export function newShiftNoteId(at: Date, existing: readonly ShiftNote[]): string {
  const base = `jaga-${at.getTime()}`;
  if (!existing.some((note) => note.id === base)) return base;
  // Two taps inside the same millisecond is not realistic, but a colliding id
  // would silently merge two notes into one box.
  let n = 1;
  while (existing.some((note) => note.id === `${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/**
 * Shift notes that should be shown and offered for copy.
 *
 * A cleared note is kept in storage for the revision trail but is not a thing
 * the user is still working on, so it does not occupy a box or a tick.
 */
export function visibleShiftNotes(notes: readonly ShiftNote[] | undefined): ShiftNote[] {
  return (notes ?? []).filter((note) => note.clearedAt === null);
}

/**
 * Whether the shift note section should appear at all.
 *
 * Nothing on screen when there are none. The button to add one lives in the
 * note's own action menu, not in a permanently-visible empty panel: a section
 * header with nothing under it costs a row of a phone screen on every patient
 * to serve the few days that have a jaga complaint.
 */
export function hasShiftNotes(notes: readonly ShiftNote[] | undefined): boolean {
  return visibleShiftNotes(notes).length > 0;
}

/**
 * Render selected shift notes for copy.
 *
 * OPT-IN: the caller passes exactly the ids that were ticked, and passing none
 * yields an empty string. The morning note sent to the chief must not change
 * shape because a shift note was added to the same day hours later.
 *
 * The heading is emphasised so it survives into WhatsApp looking like a
 * heading, and the time goes on the heading line because here it is display
 * text rather than something the parser will read back.
 */
export function renderShiftNotes(
  notes: readonly ShiftNote[] | undefined,
  selectedIds: readonly string[],
): string {
  const selected = new Set(selectedIds);
  const blocks = visibleShiftNotes(notes)
    .filter((note) => selected.has(note.id))
    // An empty box contributes nothing rather than an orphan heading.
    .filter((note) => note.body.trim().length > 0)
    .map((note) => `*SOAP Jaga ${note.time}*\n${note.body.trim()}`);

  return blocks.join('\n\n');
}
