import type { ImageFormat } from './types';

/**
 * Codec surface used by the pipeline. The browser worker and the Node test harness provide
 * their own implementations (different WASM loading), so the engine stays environment-agnostic.
 */
export interface Codecs {
  /** Best-fidelity decode (browser: converts ICC profiles to sRGB). `oriented` tells whether the
   * decoder already applied the EXIF orientation; if not, the pipeline does it. */
  decode(format: ImageFormat, bytes: ArrayBuffer): Promise<{ image: ImageData; oriented: boolean }>;
  /** Deterministic WASM decode, used to measure what an encoded candidate really looks like. */
  decodeExact(format: ImageFormat, bytes: ArrayBuffer): Promise<ImageData>;
  jpeg(img: ImageData, opts: Record<string, unknown>): Promise<ArrayBuffer>;
  webp(img: ImageData, opts: Record<string, unknown>): Promise<ArrayBuffer>;
  avif(img: ImageData, opts: Record<string, unknown>): Promise<ArrayBuffer>;
  jxl(img: ImageData, opts: Record<string, unknown>): Promise<ArrayBuffer>;
  /** Lossless PNG encode + optimisation (OxiPNG reduces to a palette when ≤256 colours). */
  png(img: ImageData, opts: { level: number }): Promise<ArrayBuffer>;
  resize(img: ImageData, width: number, height: number): Promise<ImageData>;
}

export function makeImage(data: Uint8ClampedArray, width: number, height: number): ImageData {
  return new ImageData(data as Uint8ClampedArray<ArrayBuffer>, width, height);
}

export function crop(img: ImageData, x: number, y: number, w: number, h: number): ImageData {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let row = 0; row < h; row++) {
    const src = ((y + row) * img.width + x) * 4;
    out.set(img.data.subarray(src, src + w * 4), row * w * 4);
  }
  return makeImage(out, w, h);
}

export function parseHexColor(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return [255, 255, 255];
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Composite over a solid colour and make fully opaque (needed for JPEG). */
export function flatten(img: ImageData, hex: string): ImageData {
  const [br, bg, bb] = parseHexColor(hex);
  const d = img.data;
  const out = new Uint8ClampedArray(d.length);
  for (let p = 0; p < d.length; p += 4) {
    const a = d[p + 3] / 255;
    out[p] = Math.round(d[p] * a + br * (1 - a));
    out[p + 1] = Math.round(d[p + 1] * a + bg * (1 - a));
    out[p + 2] = Math.round(d[p + 2] * a + bb * (1 - a));
    out[p + 3] = 255;
  }
  return makeImage(out, img.width, img.height);
}

/**
 * Representative sample for quality search: up to four full-resolution tiles from different
 * regions, stitched together. Full-resolution (not downscaled) so compression artefacts
 * behave as they will in the final image.
 */
export function sampleTiles(img: ImageData, tile = 512): ImageData {
  if (img.width * img.height <= tile * tile * 4.4) return img;
  const tw = Math.min(tile, Math.floor(img.width / 2)) & ~15 || Math.min(tile, img.width);
  const th = Math.min(tile, Math.floor(img.height / 2)) & ~15 || Math.min(tile, img.height);
  const out = new Uint8ClampedArray(tw * 2 * th * 2 * 4);
  const centres = [
    [0.3, 0.3],
    [0.7, 0.3],
    [0.3, 0.7],
    [0.7, 0.7],
  ];
  centres.forEach(([cx, cy], i) => {
    const sx = Math.max(0, Math.min(img.width - tw, Math.round(img.width * cx - tw / 2)));
    const sy = Math.max(0, Math.min(img.height - th, Math.round(img.height * cy - th / 2)));
    const ox = (i % 2) * tw;
    const oy = Math.floor(i / 2) * th;
    for (let row = 0; row < th; row++) {
      const src = ((sy + row) * img.width + sx) * 4;
      out.set(img.data.subarray(src, src + tw * 4), ((oy + row) * tw * 2 + ox) * 4);
    }
  });
  return makeImage(out, tw * 2, th * 2);
}

/** Apply an EXIF orientation (1–8) to the pixels so the result displays upright without metadata. */
export function orient(img: ImageData, o: number): ImageData {
  if (o < 2 || o > 8) return img;
  const { width: w, height: h } = img;
  const swap = o >= 5;
  const ow = swap ? h : w;
  const oh = swap ? w : h;
  const src = new Uint32Array(img.data.buffer, img.data.byteOffset, w * h);
  const out = new Uint8ClampedArray(ow * oh * 4);
  const dst = new Uint32Array(out.buffer);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let dx: number, dy: number;
      switch (o) {
        case 2: dx = w - 1 - x; dy = y; break;
        case 3: dx = w - 1 - x; dy = h - 1 - y; break;
        case 4: dx = x; dy = h - 1 - y; break;
        case 5: dx = y; dy = x; break;
        case 6: dx = h - 1 - y; dy = x; break;
        case 7: dx = h - 1 - y; dy = w - 1 - x; break;
        default: dx = y; dy = w - 1 - x; break; // 8
      }
      dst[dy * ow + dx] = src[y * w + x];
    }
  }
  return makeImage(out, ow, oh);
}
