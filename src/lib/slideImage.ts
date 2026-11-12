import type { StoredImage } from '@/data/slidesLocal';
import { fitWithin } from '@/domain/boardImages';
import type { DeckPhoto } from '@/domain/slides/deck';
import type { Rect } from '@/domain/slides/geometry';

/**
 * Photos for Slide MZ, re-encoded once on attach.
 *
 * Larger than board images (2000 px, not 1400): a slide is projected or read
 * full-screen, and an EKG strip needs its small squares. Kept on the device
 * only, so there is no 1 MiB Firestore document ceiling to fit under.
 */

export const SLIDE_IMAGE_SIDE = 2000;
const QUALITY = 0.85;

export function slideImageSize(width: number, height: number): { width: number; height: number } {
  return fitWithin(width, height, SLIDE_IMAGE_SIDE);
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Gambar tidak bisa dibaca.'));
    };
    image.src = url;
  });
}

/** JPEG on a white background (a transparent PNG screenshot would turn black in some viewers). */
export async function encodeSlideImage(file: Blob): Promise<{ blob: Blob; widthPx: number; heightPx: number }> {
  const image = await loadImage(file);
  const size = slideImageSize(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Gambar tidak bisa diproses di perangkat ini.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size.width, size.height);
  context.drawImage(image, 0, 0, size.width, size.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((out) => (out ? resolve(out) : reject(new Error('Gagal menyiapkan gambar.'))), 'image/jpeg', QUALITY),
  );
  return { blob, widthPx: size.width, heightPx: size.height };
}

export async function storedToDeckPhoto(image: StoredImage, rect?: Rect): Promise<DeckPhoto> {
  const bytes = new Uint8Array(await image.blob.arrayBuffer());
  return {
    imageId: image.imageId,
    bytes,
    mime: image.blob.type === 'image/png' ? 'image/png' : 'image/jpeg',
    widthPx: image.widthPx,
    heightPx: image.heightPx,
    ...(rect ? { rect } : {}),
  };
}
