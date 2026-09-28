/**
 * Where a caret belongs after the text around it was replaced from OUTSIDE
 * the editor: the entry finishing loading, another device's edit adopted, a
 * merge.
 *
 * WHY: a controlled <textarea> whose value is set programmatically puts the
 * caret at the END. With the note focused, the next keystroke then lands at
 * the bottom of the page, which is how "I typed and it went to the end" looks
 * from the chair.
 *
 * The change is located as the span between the common prefix and the common
 * suffix of the two strings:
 *  - a caret BEFORE the change keeps its offset;
 *  - a caret AFTER the change moves with the text after it;
 *  - a caret INSIDE the change goes to the end of the new text there, the
 *    least surprising place when the words under it were rewritten.
 */
export function mapOffset(before: string, after: string, offset: number): number {
  if (before === after) return Math.min(offset, after.length);
  const limit = Math.min(before.length, after.length);
  let prefix = 0;
  while (prefix < limit && before.charCodeAt(prefix) === after.charCodeAt(prefix)) prefix++;
  let suffix = 0;
  while (
    suffix < limit - prefix &&
    before.charCodeAt(before.length - 1 - suffix) === after.charCodeAt(after.length - 1 - suffix)
  ) {
    suffix++;
  }
  if (offset <= prefix) return offset;
  if (offset >= before.length - suffix) {
    return Math.min(after.length, offset + (after.length - before.length));
  }
  return after.length - suffix;
}
