/**
 * Sizing for images pasted into board sticky notes. Pure, so it is tested.
 *
 * Every image is re-encoded before it is stored, because each one becomes a
 * Firestore document and a document is capped at 1 MiB — base64 included,
 * which is a third larger than the bytes. The rules refuse anything at or
 * above 900 000 characters; the client aims well under that so a refusal is
 * never the normal path.
 */

/** Longest side, in pixels. Enough to read a lab screenshot; not a photo archive. */
export const MAX_IMAGE_SIDE = 1400;

/** Characters of data URL the client aims under. The rules' hard limit is 900 000. */
export const TARGET_DATA_URL = 700_000;

/** The size to draw at: never enlarged, longest side capped. */
export function fitWithin(
  width: number,
  height: number,
  maxSide: number = MAX_IMAGE_SIDE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide || longest === 0) return { width, height };
  const scale = maxSide / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * JPEG qualities to try, in order, until the result fits.
 *
 * Stepped rather than bisected: four encodes at worst, on one image, when the
 * user drops it — and the first one fits for almost everything a ward pastes.
 */
export const QUALITY_STEPS: readonly number[] = [0.85, 0.72, 0.6, 0.45];
