import type { Codecs } from './codecs';
import { sampleTiles } from './codecs';
import { countColors, similarity } from './metrics';
import { quantize } from './quantize';
import type { ImageFormat, Profile } from './types';

export interface EncodeContext {
  codecs: Codecs;
  profile: Profile;
  quality: 'auto' | number;
  hasAlpha: boolean;
  /** Reports progress in 0..1 for this encode step. */
  progress: (f: number) => void;
  signal?: { cancelled: boolean };
}

export interface Encoded {
  bytes: Uint8Array;
  format: ImageFormat;
  quality?: number;
  lossless: boolean;
  ssim?: number;
}

/**
 * Minimum similarity each profile accepts. Calibrated on the fixtures in tests/fixtures
 * (see docs/benchmark-results.md). Higher = more faithful, bigger files.
 */
export const TARGETS: Record<Profile, number> = {
  web: 0.98,
  photo: 0.988,
  transparency: 0.982,
  graphics: 0.99,
};

const RANGE: Record<Exclude<ImageFormat, 'png'>, [number, number]> = {
  jpeg: [45, 92],
  webp: [40, 92],
  avif: [25, 85],
  jxl: [35, 92],
};

function lossyOptions(format: Exclude<ImageFormat, 'png'>, q: number, ctx: EncodeContext): Record<string, unknown> {
  switch (format) {
    case 'jpeg':
      return { quality: q };
    case 'webp':
      return { quality: q, method: 4, alpha_quality: 100, use_sharp_yuv: ctx.profile === 'graphics' ? 1 : 0 };
    case 'avif':
      // 4:4:4 for graphics and transparency, where chroma bleeding is very visible.
      return { quality: q, speed: 6, subsample: ctx.profile === 'graphics' || ctx.profile === 'transparency' ? 3 : 1 };
    case 'jxl':
      return { quality: q, effort: 7 };
  }
}

async function encodeLossy(format: Exclude<ImageFormat, 'png'>, img: ImageData, q: number, ctx: EncodeContext) {
  const buf = await ctx.codecs[format](img, lossyOptions(format, q, ctx));
  return new Uint8Array(buf);
}

function checkCancelled(ctx: EncodeContext) {
  if (ctx.signal?.cancelled) throw new DOMException('Cancelado', 'AbortError');
}

/**
 * Smallest quality whose decoded result reaches the profile target on a representative sample,
 * found by binary search, followed by one full-resolution encode (with a safety bump if the
 * whole image scores noticeably lower than the sample did).
 */
async function lossySearch(format: Exclude<ImageFormat, 'png'>, img: ImageData, ctx: EncodeContext): Promise<Encoded> {
  if (ctx.quality !== 'auto') {
    const q = Math.max(1, Math.min(100, Math.round(ctx.quality)));
    const bytes = await encodeLossy(format, img, q, ctx);
    const ssim = similarity(img, await ctx.codecs.decodeExact(format, bytes.slice().buffer));
    ctx.progress(1);
    return { bytes, format, quality: q, lossless: false, ssim };
  }
  const target = TARGETS[ctx.profile];
  const sample = sampleTiles(img, format === 'avif' ? 320 : 512);
  let [lo, hi] = RANGE[format];
  let best = hi;
  const maxIter = 6;
  for (let i = 0; i < maxIter && lo <= hi; i++) {
    checkCancelled(ctx);
    const mid = (lo + hi) >> 1;
    const enc = await encodeLossy(format, sample, mid, ctx);
    const score = similarity(sample, await ctx.codecs.decodeExact(format, enc.slice().buffer));
    if (score >= target) {
      best = mid;
      hi = mid - 1;
    } else lo = mid + 1;
    ctx.progress(((i + 1) / maxIter) * 0.7);
  }
  checkCancelled(ctx);
  let bytes = await encodeLossy(format, img, best, ctx);
  let ssim = similarity(img, await ctx.codecs.decodeExact(format, bytes.slice().buffer));
  ctx.progress(0.9);
  if (ssim < target - 0.01 && best < RANGE[format][1]) {
    best = Math.min(RANGE[format][1], best + 6);
    bytes = await encodeLossy(format, img, best, ctx);
    ssim = similarity(img, await ctx.codecs.decodeExact(format, bytes.slice().buffer));
  }
  ctx.progress(1);
  return { bytes, format, quality: best, lossless: false, ssim };
}

/** Manual quality → palette size for PNG (≥95 means lossless). */
export function pngColorsForQuality(q: number): number | 'lossless' {
  if (q >= 95) return 'lossless';
  if (q >= 80) return 256;
  if (q >= 60) return 128;
  if (q >= 40) return 64;
  if (q >= 20) return 32;
  return 16;
}

async function encodePng(img: ImageData, ctx: EncodeContext): Promise<Encoded> {
  const lossless = async (): Promise<Encoded> => {
    const bytes = new Uint8Array(await ctx.codecs.png(img, { level: 2 }));
    ctx.progress(1);
    return { bytes, format: 'png', lossless: true, ssim: 1 };
  };
  if (countColors(img, 256) <= 256) return lossless();

  const dither = ctx.profile !== 'graphics';
  let colors: number;
  if (ctx.quality !== 'auto') {
    const c = pngColorsForQuality(ctx.quality);
    if (c === 'lossless') return lossless();
    colors = c;
  } else {
    // Try 256 → 128 (→ 64 for graphics) colours on the sample; keep the smallest palette meeting the target.
    const target = TARGETS[ctx.profile];
    const sample = sampleTiles(img, 384);
    const score256 = similarity(sample, quantize(sample, { colors: 256, dither }));
    ctx.progress(0.25);
    if (score256 < target) return lossless();
    colors = 256;
    for (const c of ctx.profile === 'graphics' ? [128, 64] : [128]) {
      checkCancelled(ctx);
      if (similarity(sample, quantize(sample, { colors: c, dither })) < target) break;
      colors = c;
    }
    ctx.progress(0.45);
  }
  checkCancelled(ctx);
  const q = quantize(img, { colors, dither });
  const ssim = similarity(img, q);
  ctx.progress(0.7);
  if (ctx.quality === 'auto' && ssim < TARGETS[ctx.profile] - 0.01) return lossless();
  const bytes = new Uint8Array(await ctx.codecs.png(q, { level: 2 }));
  ctx.progress(1);
  return { bytes, format: 'png', lossless: false, ssim, quality: colors };
}

export async function encodeFormat(format: ImageFormat, img: ImageData, ctx: EncodeContext): Promise<Encoded> {
  if (format === 'png') return encodePng(img, ctx);
  // Flat graphics: lossless WebP is often both smaller and perfect.
  if (format === 'webp' && ctx.quality === 'auto' && countColors(img, 1024) <= 1024) {
    const sub = { ...ctx, progress: (f: number) => ctx.progress(f * 0.5) };
    const lossy = await lossySearch('webp', img, sub);
    const ll = new Uint8Array(await ctx.codecs.webp(img, { lossless: 1, quality: 100, method: 4, exact: 0 }));
    ctx.progress(1);
    return ll.length <= lossy.bytes.length ? { bytes: ll, format: 'webp', lossless: true, ssim: 1 } : lossy;
  }
  return lossySearch(format, img, ctx);
}

/** Candidates for "auto" output: formats every current browser can display. */
export function autoCandidates(hasAlpha: boolean): ImageFormat[] {
  return hasAlpha ? ['png', 'webp', 'avif'] : ['jpeg', 'webp', 'avif'];
}
