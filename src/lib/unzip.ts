/**
 * Read the text files out of a .zip (12.8): a WhatsApp "Export chat" arrives
 * as a zip holding `_chat.txt` (iOS) or `WhatsApp Chat with … .txt` (Android).
 *
 * Only what that needs: the central directory, stored (0) and deflate (8)
 * entries, inflated with the browser's own `DecompressionStream`. No
 * dependency; `lib/zip.ts` is the writer.
 */

export interface ZipText {
  name: string;
  text: string;
}

const u16 = (v: DataView, at: number): number => v.getUint16(at, true);
const u32 = (v: DataView, at: number): number => v.getUint32(at, true);

async function inflate(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Every `.txt` / `.md` in the archive (or the files `wanted` matches), decoded as UTF-8. */
export async function zipTexts(buffer: ArrayBuffer, wanted: RegExp = /\.(txt|md)$/i): Promise<ZipText[]> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  // End of central directory: signature 0x06054b50, searched from the end (comment ≤ 64 KB).
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i -= 1) {
    if (u32(view, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error('Bukan file zip.');
  const count = u16(view, eocd + 10);
  let at = u32(view, eocd + 16);
  const decoder = new TextDecoder('utf-8');
  const out: ZipText[] = [];
  for (let n = 0; n < count; n += 1) {
    if (u32(view, at) !== 0x02014b50) break;
    const method = u16(view, at + 10);
    const size = u32(view, at + 20);
    const nameLength = u16(view, at + 28);
    const extraLength = u16(view, at + 30);
    const commentLength = u16(view, at + 32);
    const local = u32(view, at + 42);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + extraLength + commentLength;
    if (!wanted.test(name) || name.startsWith('__MACOSX')) continue;
    const start = local + 30 + u16(view, local + 26) + u16(view, local + 28);
    const raw = bytes.slice(start, start + size);
    const data = method === 0 ? raw : method === 8 ? await inflate(raw) : null;
    if (data) out.push({ name, text: decoder.decode(data) });
  }
  return out;
}

/** The chat text of an export: the `.txt` (preferred) or the first text file. */
export async function chatFromZip(buffer: ArrayBuffer): Promise<string> {
  const texts = await zipTexts(buffer);
  const chat = texts.find((t) => /\.txt$/i.test(t.name)) ?? texts[0];
  if (!chat) throw new Error('Tidak ada file teks di dalam zip.');
  return chat.text;
}

/** The body of a Word file (.docx): `word/document.xml` (13.12, the nurses' handover sheet). */
export async function docxDocumentXml(buffer: ArrayBuffer): Promise<string> {
  const [doc] = await zipTexts(buffer, /^word\/document\.xml$/);
  if (!doc) throw new Error('Bukan file Word (.docx).');
  return doc.text;
}
