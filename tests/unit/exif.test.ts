import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EXIF_TAGS, extractExif, insertApp1, jpegSegments, readIfd0Tags, rewriteExif } from '../../src/engine/exif';

const jpeg = new Uint8Array(readFileSync('tests/fixtures/photo-exif.jpg'));

describe('EXIF', () => {
  it('extrae el APP1 Exif con las etiquetas esperadas', () => {
    const app1 = extractExif(jpeg)!;
    expect(app1).not.toBeNull();
    const tags = readIfd0Tags(app1);
    expect(tags.get(EXIF_TAGS.ORIENTATION)).toBe(6);
    expect(tags.get(EXIF_TAGS.COPYRIGHT)).toBe('Comprimo test CC0');
    expect(tags.has(EXIF_TAGS.GPS)).toBe(true);
  });

  it('reescribe: Orientation=1, sin GPS, conserva copyright y fecha', () => {
    const { exif, removedGps, hadOrientation } = rewriteExif(extractExif(jpeg)!, false);
    expect(removedGps).toBe(true);
    expect(hadOrientation).toBe(true);
    const tags = readIfd0Tags(exif);
    expect(tags.get(EXIF_TAGS.ORIENTATION)).toBe(1);
    expect(tags.has(EXIF_TAGS.GPS)).toBe(false);
    expect(tags.get(EXIF_TAGS.COPYRIGHT)).toBe('Comprimo test CC0');
    expect(tags.get(EXIF_TAGS.DATETIME)).toBe('2024:01:02 03:04:05');
  });

  it('keepLocation conserva el puntero GPS', () => {
    const { exif, removedGps } = rewriteExif(extractExif(jpeg)!, true);
    expect(removedGps).toBe(false);
    expect(readIfd0Tags(exif).has(EXIF_TAGS.GPS)).toBe(true);
  });

  it('inserta el APP1 tras SOI/APP0 y el JPEG sigue siendo válido', () => {
    const bare = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, 0xff, 0xda, 0x00, 0x02, 0xff, 0xd9]);
    const out = insertApp1(bare, extractExif(jpeg)!);
    const segs = jpegSegments(out);
    expect(segs.map((s) => s.marker)).toEqual([0xe0, 0xe1, 0xda]);
    expect(extractExif(out)).toEqual(extractExif(jpeg));
  });

  it('un JPEG sin EXIF devuelve null', () => {
    const bare = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, 0xff, 0xd9]);
    expect(extractExif(bare)).toBeNull();
  });
});
