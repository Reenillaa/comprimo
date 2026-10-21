import type { Codecs } from '../engine/codecs';
import { MIME, type ImageFormat } from '../engine/types';

// Each codec is imported on first use, so a JPEG-only session never downloads the AVIF encoder.
const lazy = <T>(load: () => Promise<T>) => {
  let p: Promise<T> | undefined;
  return () => (p ??= load());
};

const jpegEnc = lazy(() => import('@jsquash/jpeg/encode.js'));
const jpegDec = lazy(() => import('@jsquash/jpeg/decode.js'));
const webpEnc = lazy(() => import('@jsquash/webp/encode.js'));
const webpDec = lazy(() => import('@jsquash/webp/decode.js'));
const avifEnc = lazy(() => import('@jsquash/avif/encode.js'));
const avifDec = lazy(() => import('@jsquash/avif/decode.js'));
const jxlEnc = lazy(() => import('@jsquash/jxl/encode.js'));
const jxlDec = lazy(() => import('@jsquash/jxl/decode.js'));
const pngDec = lazy(() => import('@jsquash/png/decode.js'));
const oxipng = lazy(() => import('@jsquash/oxipng/optimise.js'));
const resizer = lazy(() => import('@jsquash/resize'));

async function decodeExact(format: ImageFormat, bytes: ArrayBuffer): Promise<ImageData> {
  switch (format) {
    case 'jpeg':
      return (await jpegDec()).default(bytes);
    case 'png':
      return (await pngDec()).default(bytes);
    case 'webp':
      return (await webpDec()).default(bytes);
    case 'avif': {
      const r = await (await avifDec()).default(bytes);
      if (!r) throw new Error('AVIF decode failed');
      return r as ImageData;
    }
    case 'jxl':
      return (await jxlDec()).default(bytes);
  }
}

/**
 * Browser decode for JPEG and AVIF: converts embedded colour profiles to sRGB and applies the
 * EXIF orientation, like the browser shows the image. ('none' is not used: current Chromium
 * treats it as 'from-image'.) PNG/WebP/JXL use the exact WASM decoders, which keep
 * un-premultiplied alpha intact; the pipeline orients those itself.
 */
async function decode(format: ImageFormat, bytes: ArrayBuffer): Promise<{ image: ImageData; oriented: boolean }> {
  if ((format === 'jpeg' || format === 'avif') && typeof createImageBitmap === 'function' && typeof OffscreenCanvas !== 'undefined') {
    try {
      const bmp = await createImageBitmap(new Blob([bytes], { type: MIME[format] }), {
        imageOrientation: 'from-image',
        premultiplyAlpha: 'none',
        colorSpaceConversion: 'default',
      });
      const canvas = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' });
      if (!ctx) throw new Error('No 2D context');
      ctx.drawImage(bmp, 0, 0);
      bmp.close();
      return { image: ctx.getImageData(0, 0, canvas.width, canvas.height), oriented: true };
    } catch {
      // Browser could not decode it (or no OffscreenCanvas): use the WASM decoder.
    }
  }
  return { image: await decodeExact(format, bytes), oriented: false };
}

export const browserCodecs: Codecs = {
  decode,
  decodeExact,
  jpeg: async (img, o) => (await jpegEnc()).default(img, o),
  webp: async (img, o) => (await webpEnc()).default(img, o),
  avif: async (img, o) => (await avifEnc()).default(img, o),
  jxl: async (img, o) => (await jxlEnc()).default(img, o),
  png: async (img, o) => (await oxipng()).default(img, { level: o.level, interlace: false, optimiseAlpha: true }),
  resize: async (img, width, height) =>
    (await resizer()).default(img, { width, height, method: 'lanczos3', fitMethod: 'stretch', premultiply: true, linearRGB: true }),
};
