import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Codecs } from '../../src/engine/codecs';
import { extractExif, readIfd0Tags, EXIF_TAGS } from '../../src/engine/exif';
import { similarity } from '../../src/engine/metrics';
import { processImage } from '../../src/engine/pipeline';
import { sniff } from '../../src/engine/sniff';
import { DEFAULT_OPTIONS, ProcessingError, type ProcessOptions } from '../../src/engine/types';
import { nodeCodecs } from '../helpers/node-codecs';

const fx = (n: string) => new Uint8Array(readFileSync(`tests/fixtures/${n}`));
const opts = (o: Partial<ProcessOptions> = {}): ProcessOptions => ({ ...DEFAULT_OPTIONS, ...o });

let codecs: Codecs;
beforeAll(async () => {
  codecs = await nodeCodecs();
});

/** Decode with libvips (independent of the WASM codecs under test). */
async function vips(bytes: Uint8Array) {
  const { data, info } = await sharp(Buffer.from(bytes)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
}
const SHARP_FORMAT = { jpeg: 'jpeg', png: 'png', webp: 'webp', avif: 'heif' } as const;

describe('compresión en el formato original', () => {
  it.each([
    ['photo-large.jpg', 'jpeg'],
    ['photo-noise.jpg', 'jpeg'],
    ['photo.png', 'png'],
    ['flat-graphic.png', 'png'],
    ['alpha.png', 'png'],
    ['photo.webp', 'webp'],
    ['alpha.webp', 'webp'],
    ['photo.avif', 'avif'],
  ] as const)('%s: salida %s válida, no mayor y fiel', async (file, format) => {
    const input = fx(file);
    const r = await processImage(input, opts(), codecs);
    expect(r.format).toBe(format);
    expect(sniff(r.bytes).kind).toBe(format);
    expect(r.bytes.length).toBeLessThanOrEqual(input.length);
    const meta = await sharp(Buffer.from(r.bytes)).metadata();
    expect(meta.format).toBe(SHARP_FORMAT[format]);
    const [a, b] = await Promise.all([vips(input), vips(r.bytes)]);
    expect([b.width, b.height]).toEqual([a.width, a.height]);
    // Independent check of fidelity on libvips-decoded pixels.
    expect(similarity(a, b)).toBeGreaterThan(0.95);
    if (!r.usedOriginal) expect(r.ssim).toBeGreaterThan(0.95);
  });

  it('las fotos y gráficos típicos se reducen de verdad', async () => {
    for (const f of ['photo-large.jpg', 'photo.png', 'flat-graphic.png', 'photo.webp', 'photo.avif']) {
      const input = fx(f);
      const r = await processImage(input, opts(), codecs);
      expect(r.bytes.length, f).toBeLessThan(input.length * 0.7);
    }
  });

  it('JPEG ya muy comprimido: conserva el original y lo dice', async () => {
    const input = fx('already-small.jpg');
    const r = await processImage(input, opts(), codecs);
    expect(r.usedOriginal).toBe(true);
    expect(r.bytes).toEqual(input);
    expect(r.warnings.join()).toMatch(/conserva el archivo original/);
  });

  it('con keepOriginalIfLarger desactivado entrega el recomprimido y avisa si crece', async () => {
    const input = fx('already-small.jpg');
    const r = await processImage(input, opts({ keepOriginalIfLarger: false }), codecs);
    expect(r.usedOriginal).toBe(false);
    if (r.bytes.length > input.length) expect(r.larger).toBe(true);
  });
});

describe('transparencia', () => {
  it('PNG con alfa: los píxeles transparentes siguen transparentes', async () => {
    const input = fx('alpha.png');
    const r = await processImage(input, opts({ profile: 'transparency' }), codecs);
    const [a, b] = await Promise.all([vips(input), vips(r.bytes)]);
    let checked = 0;
    for (let p = 3; p < a.data.length; p += 4) {
      if (a.data[p] === 0) {
        expect(b.data[p]).toBe(0);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('PNG → WebP conserva el alfa', async () => {
    const r = await processImage(fx('alpha.png'), opts({ output: 'webp' }), codecs);
    expect(sniff(r.bytes).kind).toBe('webp');
    expect((await sharp(Buffer.from(r.bytes)).metadata()).hasAlpha).toBe(true);
  });

  it('PNG transparente → JPEG rellena con el color de fondo y avisa', async () => {
    const r = await processImage(fx('alpha.png'), opts({ output: 'jpeg', background: '#ff0000' }), codecs);
    expect(sniff(r.bytes).kind).toBe('jpeg');
    expect(r.warnings.join()).toMatch(/transparencia/);
    const b = await vips(r.bytes);
    // top-left corner was fully transparent → now (close to) red
    expect(b.data[0]).toBeGreaterThan(230);
    expect(b.data[1]).toBeLessThan(30);
    expect(b.data[2]).toBeLessThan(30);
  });
});

describe('conversión de formato', () => {
  it.each(['webp', 'avif', 'jxl', 'png', 'jpeg'] as const)('JPEG → %s', async (to) => {
    const r = await processImage(fx('photo-exif.jpg'), opts({ output: to }), codecs);
    expect(r.format).toBe(to);
    expect(sniff(r.bytes).kind).toBe(to);
    const back = await codecs.decodeExact(to, r.bytes.slice().buffer);
    expect(back.width * back.height).toBe(r.width * r.height);
  });

  it('JXL resultante lo decodifica libjxl', async () => {
    const r = await processImage(fx('photo.png'), opts({ output: 'jxl' }), codecs);
    const img = await codecs.decodeExact('jxl', r.bytes.slice().buffer);
    expect([img.width, img.height]).toEqual([451, 300]);
  });

  it('modo automático elige el candidato más pequeño', async () => {
    const r = await processImage(fx('photo.png'), opts({ output: 'auto' }), codecs);
    expect(r.candidates!.length).toBe(3);
    const min = Math.min(...r.candidates!.map((c) => c.size));
    expect(r.bytes.length).toBe(min);
    expect(r.candidates!.map((c) => c.format).sort()).toEqual(['avif', 'jpeg', 'webp']);
  });

  it('automático con alfa nunca propone JPEG', async () => {
    const r = await processImage(fx('alpha.webp'), opts({ output: 'auto' }), codecs);
    expect(r.candidates!.map((c) => c.format)).not.toContain('jpeg');
  });
});

describe('redimensionado', () => {
  it('fit 200×200 desde 600×400 → 200×133', async () => {
    const r = await processImage(fx('photo.webp'), opts({ resize: { mode: 'fit', width: 200, height: 200 } }), codecs);
    const m = await sharp(Buffer.from(r.bytes)).metadata();
    expect([m.width, m.height]).toEqual([200, 133]);
  });
  it('cover 100×100 da tamaño exacto', async () => {
    const r = await processImage(fx('photo.png'), opts({ resize: { mode: 'cover', width: 100, height: 100 } }), codecs);
    const m = await sharp(Buffer.from(r.bytes)).metadata();
    expect([m.width, m.height]).toEqual([100, 100]);
  });
  it('porcentaje 25 % de 3072×2304', async () => {
    const r = await processImage(fx('photo-large.jpg'), opts({ resize: { mode: 'percent', percent: 25 } }), codecs);
    expect([r.width, r.height]).toEqual([768, 576]);
  });
  it('scale por alto conserva proporción', async () => {
    const r = await processImage(fx('alpha.png'), opts({ resize: { mode: 'scale', height: 100 } }), codecs);
    expect([r.width, r.height]).toEqual([150, 100]);
  });
});

describe('calidad manual', () => {
  it('q40 pesa menos que q90 (JPEG)', async () => {
    const lo = await processImage(fx('photo.png'), opts({ output: 'jpeg', quality: 40 }), codecs);
    const hi = await processImage(fx('photo.png'), opts({ output: 'jpeg', quality: 90 }), codecs);
    expect(lo.quality).toBe(40);
    expect(hi.quality).toBe(90);
    expect(lo.bytes.length).toBeLessThan(hi.bytes.length);
  });
  it('PNG con calidad ≥95 es sin pérdida', async () => {
    const r = await processImage(fx('photo.png'), opts({ quality: 98 }), codecs);
    expect(r.lossless).toBe(true);
    const [a, b] = await Promise.all([vips(fx('photo.png')), vips(r.bytes)]);
    expect(Buffer.from(b.data).equals(Buffer.from(a.data))).toBe(true);
  });
});

describe('metadatos', () => {
  it('por defecto se eliminan', async () => {
    const r = await processImage(fx('photo-exif.jpg'), opts(), codecs);
    expect(extractExif(r.bytes)).toBeNull();
  });
  it('conservar: copyright y fecha sí, GPS no, Orientation=1', async () => {
    const r = await processImage(fx('photo-exif.jpg'), opts({ metadata: { keep: true, keepLocation: false } }), codecs);
    const tags = readIfd0Tags(extractExif(r.bytes)!);
    expect(tags.get(EXIF_TAGS.COPYRIGHT)).toBe('Comprimo test CC0');
    expect(tags.get(EXIF_TAGS.ORIENTATION)).toBe(1);
    expect(tags.has(EXIF_TAGS.GPS)).toBe(false);
    const m = await sharp(Buffer.from(r.bytes)).metadata();
    expect(m.format).toBe('jpeg');
  });
  it('conservar con ubicación mantiene el GPS', async () => {
    const r = await processImage(fx('photo-exif.jpg'), opts({ metadata: { keep: true, keepLocation: true } }), codecs);
    expect(readIfd0Tags(extractExif(r.bytes)!).has(EXIF_TAGS.GPS)).toBe(true);
  });
  it('a otro formato: avisa de que se pierden', async () => {
    const r = await processImage(fx('photo-exif.jpg'), opts({ output: 'webp', metadata: { keep: true, keepLocation: false } }), codecs);
    expect(r.warnings.join()).toMatch(/solo se conservan de JPEG a JPEG/);
  });
});

describe('errores', () => {
  const fails = async (file: string, code: string) => {
    await expect(processImage(fx(file), opts(), codecs)).rejects.toSatisfy(
      (e: unknown) => e instanceof ProcessingError && e.code === code,
    );
  };
  it('texto con extensión .jpg → unsupported', () => fails('fake.jpg', 'unsupported'));
  it('JPEG truncado → corrupt', () => fails('truncated.jpg', 'corrupt'));
  it('APNG → animated', () => fails('animated.png', 'animated'));
  it('PNG con extensión .jpg se procesa como PNG', async () => {
    const r = await processImage(fx('mislabeled.jpg'), opts(), codecs);
    expect(r.format).toBe('png');
  });
  it('imagen de 1×1', async () => {
    const r = await processImage(fx('tiny.png'), opts(), codecs);
    expect([r.width, r.height]).toEqual([1, 1]);
  });
  it('opciones de redimensionado inválidas → invalid-options', async () => {
    await expect(processImage(fx('photo.png'), opts({ resize: { mode: 'cover', width: 10 } }), codecs)).rejects.toSatisfy(
      (e: unknown) => e instanceof ProcessingError && e.code === 'invalid-options',
    );
  });
  it('imagen > 100 MP declarada en la cabecera → too-large (sin decodificar)', async () => {
    const png = fx('tiny.png').slice();
    const dv = new DataView(png.buffer);
    dv.setUint32(16, 20000);
    dv.setUint32(20, 20000);
    await expect(processImage(png, opts(), codecs)).rejects.toSatisfy(
      (e: unknown) => e instanceof ProcessingError && e.code === 'too-large',
    );
  });
});

describe('orientación EXIF', () => {
  it('Orientation=6 se aplica a los píxeles y coincide con libvips autoOrient', async () => {
    const input = fx('photo-exif.jpg');
    const r = await processImage(input, opts(), codecs);
    expect([r.width, r.height]).toEqual([300, 451]);
    const { data, info } = await sharp(Buffer.from(input)).autoOrient().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const ref = { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
    expect(similarity(ref, await vips(r.bytes))).toBeGreaterThan(0.95);
  });
});

describe('miniatura', () => {
  it('devuelve una vista previa WebP de ≤512 px cuando se pide', async () => {
    const r = await processImage(fx('photo-large.jpg'), opts(), codecs, { thumbnail: 512 });
    expect(sniff(r.thumbnail!).kind).toBe('webp');
    const m = await sharp(Buffer.from(r.thumbnail!)).metadata();
    expect(Math.max(m.width!, m.height!)).toBe(512);
  });
  it('sin pedirla no se genera', async () => {
    const r = await processImage(fx('tiny.png'), opts(), codecs);
    expect(r.thumbnail).toBeUndefined();
  });
});

describe('avisos de metadatos sin ruido', () => {
  it('un PNG sin EXIF no avisa aunque "conservar EXIF" esté activo', async () => {
    const r = await processImage(fx('photo.png'), opts({ metadata: { keep: true, keepLocation: false } }), codecs);
    expect(r.warnings.join()).not.toMatch(/metadatos/);
  });
});
