import { describe, expect, it } from 'vitest';
import '../helpers/node-codecs'; // ImageData polyfill
import { countColors, hasTransparency, similarity } from '../../src/engine/metrics';
import { quantize } from '../../src/engine/quantize';
import { crop, flatten, makeImage, parseHexColor, sampleTiles } from '../../src/engine/codecs';

function gradient(w: number, h: number, alpha = false) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      d[p] = (x * 255) / w;
      d[p + 1] = (y * 255) / h;
      d[p + 2] = ((x + y) * 127) / (w + h);
      d[p + 3] = alpha ? (x * 255) / w : 255;
    }
  return makeImage(d, w, h);
}

describe('similarity', () => {
  it('idénticas = 1', () => {
    const g = gradient(64, 64);
    expect(similarity(g, g)).toBeCloseTo(1, 6);
  });
  it('baja con ruido y es monótona', () => {
    const g = gradient(64, 64);
    const noisy = (amp: number) => {
      const d = new Uint8ClampedArray(g.data);
      let s = 1;
      for (let i = 0; i < d.length; i++) if (i % 4 !== 3) d[i] += ((s = (s * 48271) % 2147483647) % (2 * amp)) - amp;
      return makeImage(d, 64, 64);
    };
    const a = similarity(g, noisy(5));
    const b = similarity(g, noisy(40));
    expect(a).toBeLessThan(1);
    expect(b).toBeLessThan(a);
  });
  it('tiene en cuenta el alfa', () => {
    const g = gradient(32, 32, true);
    const opaque = makeImage(new Uint8ClampedArray(g.data).map((v, i) => (i % 4 === 3 ? 255 : v)), 32, 32);
    expect(hasTransparency(g)).toBe(true);
    expect(similarity(g, opaque)).toBeLessThan(0.9);
  });
  it('tamaños distintos → error', () => {
    expect(() => similarity(gradient(8, 8), gradient(9, 8))).toThrow();
  });
});

describe('quantize', () => {
  it('limita la paleta y conserva el tamaño', () => {
    const g = gradient(128, 96, true);
    for (const colors of [256, 64, 16]) {
      const q = quantize(g, { colors, dither: true });
      expect(q.width).toBe(128);
      expect(countColors(q, 1000)).toBeLessThanOrEqual(colors);
    }
  });
  it('sin dithering, una imagen con pocos colores queda exacta', () => {
    const d = new Uint8ClampedArray(16 * 16 * 4);
    for (let i = 0; i < 256; i++) d.set(i < 128 ? [255, 0, 0, 255] : [0, 0, 255, 128], i * 4);
    const img = makeImage(d, 16, 16);
    expect(Array.from(quantize(img, { colors: 8, dither: false }).data)).toEqual(Array.from(d));
  });
  it('los píxeles totalmente transparentes siguen transparentes', () => {
    const g = gradient(64, 64, true);
    const q = quantize(g, { colors: 32, dither: true });
    for (let p = 3; p < g.data.length; p += 4) if (g.data[p] === 0) expect(q.data[p]).toBe(0);
  });
});

describe('utilidades de imagen', () => {
  it('flatten compone sobre el color y deja opaco', () => {
    const img = makeImage(new Uint8ClampedArray([0, 0, 0, 0, 255, 0, 0, 128]), 2, 1);
    const f = flatten(img, '#ffffff');
    expect(Array.from(f.data)).toEqual([255, 255, 255, 255, 255, 127, 127, 255]);
  });
  it('parseHexColor', () => {
    expect(parseHexColor('#0f0')).toEqual([0, 255, 0]);
    expect(parseHexColor('nope')).toEqual([255, 255, 255]);
  });
  it('crop', () => {
    const c = crop(gradient(10, 10), 2, 3, 4, 5);
    expect([c.width, c.height]).toEqual([4, 5]);
  });
  it('sampleTiles no toca imágenes pequeñas y reduce las grandes', () => {
    const small = gradient(100, 100);
    expect(sampleTiles(small)).toBe(small);
    const big = gradient(3000, 2000);
    const s = sampleTiles(big, 512);
    expect([s.width, s.height]).toEqual([1024, 1024]);
  });
  it('countColors corta en el límite', () => {
    expect(countColors(gradient(64, 64), 10)).toBe(11);
  });
});

describe('orient (EXIF 1–8)', () => {
  // 3×2 image with distinct pixel ids in the red channel
  const base = () => makeImage(new Uint8ClampedArray([1, 0, 0, 255, 2, 0, 0, 255, 3, 0, 0, 255, 4, 0, 0, 255, 5, 0, 0, 255, 6, 0, 0, 255]), 3, 2);
  const ids = (img: ImageData) => Array.from(img.data).filter((_, i) => i % 4 === 0);
  it.each([
    [1, 3, 2, [1, 2, 3, 4, 5, 6]],
    [2, 3, 2, [3, 2, 1, 6, 5, 4]],
    [3, 3, 2, [6, 5, 4, 3, 2, 1]],
    [4, 3, 2, [4, 5, 6, 1, 2, 3]],
    [5, 2, 3, [1, 4, 2, 5, 3, 6]],
    [6, 2, 3, [4, 1, 5, 2, 6, 3]],
    [7, 2, 3, [6, 3, 5, 2, 4, 1]],
    [8, 2, 3, [3, 6, 2, 5, 1, 4]],
  ])('orientación %i', async (o, w, h, expected) => {
    const { orient } = await import('../../src/engine/codecs');
    const r = orient(base(), o);
    expect([r.width, r.height]).toEqual([w, h]);
    expect(ids(r)).toEqual(expected);
  });
});
