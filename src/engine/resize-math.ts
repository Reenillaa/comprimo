import type { ResizeOptions } from './types';

export interface ResizePlan {
  /** Size the whole image is scaled to before an optional crop. */
  scaleWidth: number;
  scaleHeight: number;
  /** Final output size (equal to the scale size unless cropping for 'cover'). */
  width: number;
  height: number;
  crop?: { x: number; y: number; width: number; height: number };
}

const clampDim = (n: number) => Math.max(1, Math.round(n));

/**
 * Compute target dimensions. Never upscales: images smaller than the target keep their size,
 * because enlarging only adds bytes without adding detail.
 */
export function planResize(w: number, h: number, opts: ResizeOptions): ResizePlan | null {
  const same = (): ResizePlan | null => null;
  switch (opts.mode) {
    case 'none':
      return same();
    case 'percent': {
      const pct = opts.percent ?? 100;
      if (!(pct > 0) || pct >= 100) return same();
      const width = clampDim((w * pct) / 100);
      const height = clampDim((h * pct) / 100);
      return { scaleWidth: width, scaleHeight: height, width, height };
    }
    case 'scale': {
      // Exactly one of width/height, proportional.
      if (opts.width && !opts.height) {
        if (opts.width >= w) return same();
        const height = clampDim((h * opts.width) / w);
        return { scaleWidth: opts.width, scaleHeight: height, width: opts.width, height };
      }
      if (opts.height && !opts.width) {
        if (opts.height >= h) return same();
        const width = clampDim((w * opts.height) / h);
        return { scaleWidth: width, scaleHeight: opts.height, width, height: opts.height };
      }
      throw new Error('Escalar requiere ancho o alto (solo uno).');
    }
    case 'fit': {
      const bw = opts.width ?? Infinity;
      const bh = opts.height ?? Infinity;
      if (bw === Infinity && bh === Infinity) throw new Error('Encajar requiere ancho y/o alto máximos.');
      const r = Math.min(bw / w, bh / h);
      if (r >= 1) return same();
      const width = clampDim(w * r);
      const height = clampDim(h * r);
      return { scaleWidth: width, scaleHeight: height, width, height };
    }
    case 'cover': {
      if (!opts.width || !opts.height) throw new Error('Cubrir requiere ancho y alto.');
      const tw = Math.min(opts.width, w);
      const th = Math.min(opts.height, h);
      const r = Math.max(tw / w, th / h);
      const sw = clampDim(w * r);
      const sh = clampDim(h * r);
      if (sw === w && sh === h && tw === w && th === h) return same();
      return {
        scaleWidth: sw,
        scaleHeight: sh,
        width: tw,
        height: th,
        crop: { x: Math.floor((sw - tw) / 2), y: Math.floor((sh - th) / 2), width: tw, height: th },
      };
    }
  }
}
