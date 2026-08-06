/**
 * SPEC 6.2 — `bodyHash`, "a short hash of body, for cheap change detection".
 *
 * FNV-1a 32-bit: synchronous (the async SubtleCrypto API cannot be called on
 * every keystroke debounce), dependency-free, and adequate because this hash
 * answers "did the text change?" — never "is this text authentic?". It is not
 * used for security and must never be.
 */
export function bodyHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  // Length guards against the rare collision where two edits hash equal.
  return `${hash.toString(16).padStart(8, '0')}-${text.length.toString(36)}`;
}
