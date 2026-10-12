import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { chatFromZip, zipTexts } from './unzip';

/** A minimal zip: one entry per file, stored (0) or deflated (8). */
function makeZip(files: Array<{ name: string; text: string; deflate: boolean }>): ArrayBuffer {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = enc.encode(file.name);
    const raw = enc.encode(file.text);
    const data = file.deflate ? new Uint8Array(deflateRawSync(raw)) : raw;
    const local = new Uint8Array(30 + name.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, file.deflate ? 8 : 0, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, file.deflate ? 8 : 0, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const all = new Uint8Array(offset + centralSize + 22);
  let at = 0;
  for (const part of [...locals, ...centrals, end]) {
    all.set(part, at);
    at += part.length;
  }
  return all.buffer;
}

describe('unzip (WhatsApp export)', () => {
  it('reads stored and deflated text entries, skipping media', async () => {
    const zip = makeZip([
      { name: 'IMG-0001.jpg', text: 'not text', deflate: false },
      { name: '_chat.txt', text: '[10/9/26, 6:27:01 AM] dr. A: Halo 🫀 pasien', deflate: true },
      { name: 'notes.md', text: '# x', deflate: false },
    ]);
    const texts = await zipTexts(zip);
    expect(texts.map((t) => t.name)).toEqual(['_chat.txt', 'notes.md']);
    expect(await chatFromZip(zip)).toBe('[10/9/26, 6:27:01 AM] dr. A: Halo 🫀 pasien');
  });

  it('refuses a file that is not a zip', async () => {
    await expect(zipTexts(new TextEncoder().encode('hello').buffer)).rejects.toThrow('Bukan file zip.');
  });
});
