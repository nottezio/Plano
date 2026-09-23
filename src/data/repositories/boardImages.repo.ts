import { FieldPath, arrayRemove, arrayUnion, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { nanoid } from 'nanoid';

import { boardImageDoc, userDoc } from '../paths';
import { trackWrite } from '../syncStatus';
import { QUALITY_STEPS, TARGET_DATA_URL, fitWithin } from '@/domain/boardImages';

/**
 * Images in board sticky notes. One Firestore document per image; the note
 * holds the ids (`boardNotes.<id>.images`). See `paths.ts` for why not the
 * profile, and `domain/boardImages` for the sizing.
 */

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

/**
 * Re-encode to fit one document.
 *
 * Always JPEG, because it is the only browser encoding whose size can be
 * traded for quality. PNG cannot be made smaller without shrinking the
 * picture, and a screenshot of a lab result that has to be shrunk to fit is a
 * screenshot that can no longer be read. The background is filled white first:
 * JPEG has no transparency, and a transparent PNG would otherwise go black.
 */
async function toFittedDataUrl(file: Blob): Promise<string> {
  const image = await loadImage(file);
  const size = fitWithin(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Gambar tidak bisa diproses di perangkat ini.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size.width, size.height);
  context.drawImage(image, 0, 0, size.width, size.height);

  for (const quality of QUALITY_STEPS) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= TARGET_DATA_URL) return dataUrl;
  }
  throw new Error('Gambar terlalu besar, bahkan setelah dikompres.');
}

/** Store an image and attach it to a note. Returns the image id. */
export async function addImageToNote(uid: string, noteId: string, file: Blob): Promise<string> {
  const dataUrl = await toFittedDataUrl(file);
  const id = nanoid(10);
  // The image first, then the reference: a reference to an image that was
  // never written would leave a broken tile; an image nobody references
  // costs only its own document.
  await trackWrite(
    setDoc(boardImageDoc(uid, id), {
      dataUrl,
      mime: 'image/jpeg',
      noteId,
      createdAt: Date.now(),
    }),
  );
  await trackWrite(
    updateDoc(userDoc(uid), new FieldPath('boardNotes', noteId, 'images'), arrayUnion(id)),
  );
  return id;
}

/** Detach from the note. The image document stays: no client hard-deletes. */
export function removeImageFromNote(uid: string, noteId: string, imageId: string): Promise<void> {
  return trackWrite(
    updateDoc(userDoc(uid), new FieldPath('boardNotes', noteId, 'images'), arrayRemove(imageId)),
  );
}

/**
 * Images never change once written (the rules forbid updates), so one read
 * per session is enough and the cache can never be stale.
 */
const cache = new Map<string, Promise<string | null>>();

export function loadBoardImage(uid: string, imageId: string): Promise<string | null> {
  const key = `${uid}/${imageId}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = getDoc(boardImageDoc(uid, imageId))
      .then((snapshot) => {
        const dataUrl: unknown = snapshot.data()?.['dataUrl'];
        return typeof dataUrl === 'string' ? dataUrl : null;
      })
      .catch((error: unknown) => {
        // A failed read is not cached: the next render may be online.
        cache.delete(key);
        console.error('[sticky] image read failed', error);
        return null;
      });
    cache.set(key, pending);
  }
  return pending;
}

/**
 * Put the image on the clipboard AS AN IMAGE, so it pastes into WhatsApp or a
 * document as a picture rather than as a link or a file path.
 *
 * Converted to PNG first: `image/png` is the one image type every browser's
 * clipboard writer accepts; JPEG is refused by Chrome.
 */
export async function copyImageToClipboard(dataUrl: string): Promise<void> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    throw new Error('Peramban ini tidak bisa menyalin gambar. Klik kanan → Salin gambar.');
  }
  const image = await loadImage(await (await fetch(dataUrl)).blob());
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext('2d')?.drawImage(image, 0, 0);
  const png = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Gagal menyiapkan gambar.'))), 'image/png'),
  );
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}
