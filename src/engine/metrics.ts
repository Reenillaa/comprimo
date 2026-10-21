/** Minimal ImageData shape so the engine also runs in Node tests. */
export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const C1 = (0.01 * 255) ** 2;
const C2 = (0.03 * 255) ** 2;

/** Composite over a solid background and convert to Y, Cb, Cr planes. */
function planes(img: Pixels, bg: number): [Float32Array, Float32Array, Float32Array] {
  const n = img.width * img.height;
  const y = new Float32Array(n);
  const cb = new Float32Array(n);
  const cr = new Float32Array(n);
  const d = img.data;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const a = d[p + 3] / 255;
    const r = d[p] * a + bg * (1 - a);
    const g = d[p + 1] * a + bg * (1 - a);
    const b = d[p + 2] * a + bg * (1 - a);
    y[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    cb[i] = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    cr[i] = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  }
  return [y, cb, cr];
}

/** Mean SSIM over 8×8 windows with stride 4. */
function ssimPlane(a: Float32Array, b: Float32Array, w: number, h: number): number {
  const win = Math.min(8, w, h);
  const step = Math.max(1, win >> 1);
  let sum = 0;
  let count = 0;
  const nPix = win * win;
  for (let y0 = 0; y0 + win <= h; y0 += step) {
    for (let x0 = 0; x0 + win <= w; x0 += step) {
      let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
      for (let y = y0; y < y0 + win; y++) {
        let i = y * w + x0;
        for (let x = 0; x < win; x++, i++) {
          const va = a[i];
          const vb = b[i];
          sa += va;
          sb += vb;
          saa += va * va;
          sbb += vb * vb;
          sab += va * vb;
        }
      }
      const ma = sa / nPix;
      const mb = sb / nPix;
      const va = saa / nPix - ma * ma;
      const vb = sbb / nPix - mb * mb;
      const cov = sab / nPix - ma * mb;
      sum += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      count++;
    }
  }
  return count ? sum / count : 1;
}

function hasTransparency(img: Pixels): boolean {
  const d = img.data;
  for (let p = 3; p < d.length; p += 4) if (d[p] !== 255) return true;
  return false;
}

/** 2× box downsample (keeps alpha). */
function half(img: Pixels): Pixels {
  const w = img.width >> 1;
  const h = img.height >> 1;
  const d = img.data;
  const o = new Uint8ClampedArray(w * h * 4);
  const stride = img.width * 4;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = 2 * y * stride + 2 * x * 4;
      const q = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) o[q + c] = (d[i + c] + d[i + 4 + c] + d[i + stride + c] + d[i + stride + 4 + c] + 2) >> 2;
    }
  }
  return { data: o, width: w, height: h };
}

/** Weights for full, ½ and ¼ scale. Coarser scales dominate: fine grain and dithering are
 * barely visible at normal viewing distance, structural damage is. */
const SCALE_WEIGHTS = [0.2, 0.4, 0.4];

/**
 * Multi-scale similarity in 0..1 (SSIM on Y/Cb/Cr at 1×, ½×, ¼×). Used to decide how far
 * each encoder can go. Calibrated in docs/benchmark-results.md.
 */
export function similarity(a: Pixels, b: Pixels): number {
  if (a.width !== b.width || a.height !== b.height) throw new Error('similarity: size mismatch');
  let total = 0;
  let wsum = 0;
  let pa = a;
  let pb = b;
  for (let s = 0; s < SCALE_WEIGHTS.length; s++) {
    if (s > 0) {
      if (pa.width < 16 || pa.height < 16) break;
      pa = half(pa);
      pb = half(pb);
    }
    total += SCALE_WEIGHTS[s] * singleScale(pa, pb);
    wsum += SCALE_WEIGHTS[s];
  }
  return total / wsum;
}

/**
 * SSIM on luma (weight 0.8) and chroma (0.1 each). Images with transparency are compared over
 * both black and white, keeping the worst score, so errors hidden by one background still count.
 */
export function singleScale(a: Pixels, b: Pixels): number {
  if (a.width !== b.width || a.height !== b.height) throw new Error('similarity: size mismatch');
  const backgrounds = hasTransparency(a) || hasTransparency(b) ? [0, 255] : [255];
  let worst = 1;
  for (const bg of backgrounds) {
    const pa = planes(a, bg);
    const pb = planes(b, bg);
    const s =
      0.8 * ssimPlane(pa[0], pb[0], a.width, a.height) +
      0.1 * ssimPlane(pa[1], pb[1], a.width, a.height) +
      0.1 * ssimPlane(pa[2], pb[2], a.width, a.height);
    worst = Math.min(worst, s);
  }
  return worst;
}

export { hasTransparency };

/** Count distinct RGBA colours, stopping early once `limit` is exceeded. */
export function countColors(img: Pixels, limit = 256): number {
  const seen = new Set<number>();
  const u32 = new Uint32Array(img.data.buffer, img.data.byteOffset, img.data.byteLength >> 2);
  for (let i = 0; i < u32.length; i++) {
    seen.add(u32[i]);
    if (seen.size > limit) return seen.size;
  }
  return seen.size;
}
