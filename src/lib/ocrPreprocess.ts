/**
 * Image preparation for OCR.
 *
 * Tesseract wants tall, high-contrast, black-on-white glyphs. A screenshot of a
 * lab report is the opposite: 8–10 px type, thin strokes, coloured values, grey
 * rules, and often a scaled-down PNG. Handed that directly it returns noise —
 * `Nara pre Tog oT 13550` from a table of forty results.
 *
 * Three steps, each aimed at one of those problems:
 *
 *  1. **Upscale** so glyphs are tall enough to segment. Tesseract's models
 *     expect roughly 30 px of cap height; below ~20 px accuracy collapses,
 *     which is exactly where a screenshot of a report sits.
 *  2. **Grayscale with luminance weights**, not a channel average — red values
 *     on white are the abnormal results, the ones that matter most, and a naive
 *     average washes them out relative to black text.
 *  3. **Binarise** to remove the grey table rules and JPEG mush that Tesseract
 *     otherwise reads as punctuation.
 *
 * None of this makes OCR of a dense table dependable. It moves it from
 * "returns noise" to "returns something worth checking", which is the honest
 * ceiling for this in a browser.
 */

/** Cap height Tesseract is comfortable with, in pixels. */
const TARGET_MIN_WIDTH = 2000;
const MAX_WIDTH = 4000;

/** Above this, a pixel is background. Tuned for printed reports on white. */
const THRESHOLD = 176;

export async function preprocessForOcr(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(
    MAX_WIDTH / bitmap.width,
    Math.max(1, TARGET_MIN_WIDTH / bitmap.width),
  );
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return file;

  // Smoothing on upscale keeps strokes connected; nearest-neighbour would
  // break thin glyphs into fragments the recogniser cannot join.
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const image = context.getImageData(0, 0, width, height);
  const pixels = image.data;

  for (let index = 0; index < pixels.length; index += 4) {
    const luminance =
      0.299 * (pixels[index] ?? 0) +
      0.587 * (pixels[index + 1] ?? 0) +
      0.114 * (pixels[index + 2] ?? 0);
    const value = luminance > THRESHOLD ? 255 : 0;
    pixels[index] = value;
    pixels[index + 1] = value;
    pixels[index + 2] = value;
    pixels[index + 3] = 255;
  }

  context.putImageData(image, 0, 0);

  return new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? file), 'image/png');
  });
}
