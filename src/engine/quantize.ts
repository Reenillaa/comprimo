import { makeImage } from './codecs';

export interface QuantizeOptions {
  colors: number;
  dither: boolean;
}

/**
 * Palette quantizer for RGBA (written for this project, MIT):
 *   1. weighted colour histogram (sampled for big images),
 *   2. median cut in premultiplied-alpha space (so invisible colour differences are free),
 *   3. a few k-means (Lloyd) refinement passes,
 *   4. remap with optional damped Floyd–Steinberg dithering.
 * Output is RGBA restricted to ≤ `colors` distinct values; OxiPNG stores it as indexed PNG + tRNS.
 */
export function quantize(img: ImageData, opts: QuantizeOptions): ImageData {
  const palette = buildPalette(img, Math.max(2, Math.min(256, opts.colors)));
  return remap(img, palette, opts.dither);
}

type Vec = [number, number, number, number];

/** Premultiplied components scaled to 0..255; alpha weighted a bit higher (edges matter). */
function toVec(r: number, g: number, b: number, a: number): Vec {
  const f = a / 255;
  return [r * f, g * f, b * f, a];
}

interface Entry {
  v: Vec;
  w: number;
}

function histogram(img: ImageData): Entry[] {
  const d = img.data;
  const n = img.width * img.height;
  const step = Math.max(1, Math.floor(n / 400_000));
  const map = new Map<number, Entry>();
  for (let i = 0; i < n; i += step) {
    const p = i * 4;
    const a = d[p + 3];
    // Fully transparent pixels are all the same visible colour.
    const key = a === 0 ? 0 : ((d[p] << 24) | (d[p + 1] << 16) | (d[p + 2] << 8) | a) >>> 0;
    const e = map.get(key);
    if (e) e.w++;
    else map.set(key, { v: a === 0 ? [0, 0, 0, 0] : toVec(d[p], d[p + 1], d[p + 2], a), w: 1 });
  }
  return [...map.values()];
}

interface Box {
  items: Entry[];
  score: number;
  axis: number;
}

function analyse(items: Entry[]): Box {
  let w = 0;
  const mean = [0, 0, 0, 0];
  for (const e of items) {
    w += e.w;
    for (let c = 0; c < 4; c++) mean[c] += e.v[c] * e.w;
  }
  for (let c = 0; c < 4; c++) mean[c] /= w || 1;
  const varc = [0, 0, 0, 0];
  for (const e of items) for (let c = 0; c < 4; c++) varc[c] += (e.v[c] - mean[c]) ** 2 * e.w;
  let axis = 0;
  for (let c = 1; c < 4; c++) if (varc[c] > varc[axis]) axis = c;
  return { items, score: items.length > 1 ? varc[0] + varc[1] + varc[2] + varc[3] : 0, axis };
}

function centroid(items: Entry[]): Vec {
  let w = 0;
  const m: Vec = [0, 0, 0, 0];
  for (const e of items) {
    w += e.w;
    for (let c = 0; c < 4; c++) m[c] += e.v[c] * e.w;
  }
  return m.map((x) => x / (w || 1)) as Vec;
}

function buildPalette(img: ImageData, colors: number): Vec[] {
  const all = histogram(img);
  if (all.length <= colors) return all.map((e) => e.v);
  // Fully transparent pixels get a dedicated entry, so they can never pick up a visible colour.
  const hist = all.filter((e) => e.v[3] > 0);
  const reserved: Vec[] = hist.length < all.length ? [[0, 0, 0, 0]] : [];
  colors -= reserved.length;

  // Median cut: split the box with the largest total squared error at its weighted median.
  const boxes: Box[] = [analyse(hist)];
  while (boxes.length < colors) {
    let bi = -1;
    for (let i = 0; i < boxes.length; i++) if (boxes[i].score > 0 && (bi < 0 || boxes[i].score > boxes[bi].score)) bi = i;
    if (bi < 0) break;
    const box = boxes[bi];
    const ax = box.axis;
    box.items.sort((a, b) => a.v[ax] - b.v[ax]);
    const total = box.items.reduce((s, e) => s + e.w, 0);
    let acc = 0;
    let cut = 1;
    for (let i = 0; i < box.items.length - 1; i++) {
      acc += box.items[i].w;
      if (acc >= total / 2) {
        cut = i + 1;
        break;
      }
    }
    boxes.splice(bi, 1, analyse(box.items.slice(0, cut)), analyse(box.items.slice(cut)));
  }
  const pal = boxes.map((b) => centroid(b.items));
  const fixed = pal.length;

  // Lloyd refinement on (a sample of) the histogram.
  const sample = hist.length > 60_000 ? hist.filter((_, i) => i % Math.ceil(hist.length / 60_000) === 0) : hist;
  for (let iter = 0; iter < 3; iter++) {
    const sums = pal.map(() => [0, 0, 0, 0, 0]);
    for (const e of sample) {
      const k = nearest(pal, e.v[0], e.v[1], e.v[2], e.v[3]);
      const s = sums[k];
      for (let c = 0; c < 4; c++) s[c] += e.v[c] * e.w;
      s[4] += e.w;
    }
    for (let k = 0; k < pal.length; k++) {
      const s = sums[k];
      if (s[4] > 0) pal[k] = [s[0] / s[4], s[1] / s[4], s[2] / s[4], s[3] / s[4]];
    }
  }
  return fixed ? [...pal, ...reserved] : reserved;
}

function nearest(pal: Vec[], r: number, g: number, b: number, a: number): number {
  let best = 0;
  let bd = Infinity;
  for (let k = 0; k < pal.length; k++) {
    const p = pal[k];
    const dr = p[0] - r, dg = p[1] - g, db = p[2] - b, da = p[3] - a;
    const dist = dr * dr + dg * dg + db * db + 1.5 * da * da;
    if (dist < bd) {
      bd = dist;
      best = k;
    }
  }
  return best;
}

function remap(img: ImageData, pal: Vec[], dither: boolean): ImageData {
  const { width: w, height: h, data: d } = img;
  // Un-premultiplied, rounded palette colours (what actually gets stored).
  const rgba = pal.map(([r, g, b, a]) => {
    const A = Math.round(Math.max(0, Math.min(255, a)));
    if (A === 0) return [0, 0, 0, 0];
    const f = 255 / a;
    return [r * f, g * f, b * f].map((x) => Math.round(Math.max(0, Math.min(255, x)))).concat(A);
  });
  const stored: Vec[] = rgba.map(([r, g, b, a]) => toVec(r, g, b, a));
  const out = new Uint8ClampedArray(d.length);
  const cache = new Map<number, number>();
  const lookup = (r: number, g: number, b: number, a: number, exact: boolean) => {
    // Cache by 5-bit cell when dithering (approximate), exact colour otherwise.
    const key = exact
      ? ((Math.round(r) << 24) | (Math.round(g) << 16) | (Math.round(b) << 8) | Math.round(a)) >>> 0
      : ((Math.round(r) >> 3) << 15) | ((Math.round(g) >> 3) << 10) | ((Math.round(b) >> 3) << 5) | (Math.round(a) >> 3);
    let k = cache.get(key);
    if (k === undefined) {
      k = nearest(stored, r, g, b, a);
      cache.set(key, k);
    }
    return k;
  };

  if (!dither) {
    for (let p = 0; p < d.length; p += 4) {
      const a = d[p + 3];
      const v = toVec(d[p], d[p + 1], d[p + 2], a);
      const k = a === 0 ? lookup(0, 0, 0, 0, true) : lookup(v[0], v[1], v[2], v[3], true);
      out.set(rgba[k], p);
    }
    return makeImage(out, w, h);
  }

  // Damped Floyd–Steinberg in premultiplied space, serpentine scan.
  const DAMP = 0.8;
  let errCur = new Float32Array((w + 2) * 4);
  let errNext = new Float32Array((w + 2) * 4);
  for (let y = 0; y < h; y++) {
    const ltr = (y & 1) === 0;
    for (let i = 0; i < w; i++) {
      const x = ltr ? i : w - 1 - i;
      const p = (y * w + x) * 4;
      const srcA = d[p + 3];
      const v = toVec(d[p], d[p + 1], d[p + 2], srcA);
      const e = (x + 1) * 4;
      const t: Vec = [0, 0, 0, 0];
      if (srcA !== 0) {
        for (let c = 0; c < 4; c++) t[c] = Math.max(0, Math.min(255, v[c] + errCur[e + c]));
        // Opaque stays opaque: alpha error only spreads across semi-transparent pixels.
        if (srcA === 255) t[3] = 255;
        else t[3] = Math.max(1, t[3]);
        for (let c = 0; c < 3; c++) t[c] = Math.min(t[c], t[3]); // stay a valid premultiplied colour
      }
      const k = srcA === 0 ? lookup(0, 0, 0, 0, true) : lookup(t[0], t[1], t[2], t[3], false);
      out.set(rgba[k], p);
      const s = stored[k];
      const dir = ltr ? 1 : -1;
      for (let c = 0; c < 4; c++) {
        const err = (t[c] - s[c]) * DAMP;
        errCur[e + dir * 4 + c] += (err * 7) / 16;
        errNext[e - dir * 4 + c] += (err * 3) / 16;
        errNext[e + c] += (err * 5) / 16;
        errNext[e + dir * 4 + c] += err / 16;
      }
    }
    [errCur, errNext] = [errNext, errCur];
    errNext.fill(0);
  }
  return makeImage(out, w, h);
}
