import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Codecs } from '../../src/engine/codecs';
import type { ImageFormat } from '../../src/engine/types';

// Node has no ImageData; the codecs (and OxiPNG's instanceof check) need one.
if (typeof (globalThis as { ImageData?: unknown }).ImageData === 'undefined') {
  class NodeImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    colorSpace = 'srgb';
    constructor(data: Uint8ClampedArray | number, width: number, height?: number) {
      if (typeof data === 'number') {
        this.width = data;
        this.height = width;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      } else {
        this.data = data;
        this.width = width;
        this.height = height ?? data.length / 4 / width;
      }
    }
  }
  (globalThis as { ImageData?: unknown }).ImageData = NodeImageData;
}

const require = createRequire(import.meta.url);
const root = (pkg: string) => dirname(require.resolve(`${pkg}/package.json`));
const wasm = async (pkg: string, rel: string) => WebAssembly.compile(await readFile(join(root(pkg), rel)));

let ready: Promise<Codecs> | undefined;

/** Real WASM codecs (same packages the browser uses), loaded from disk for Node. */
export function nodeCodecs(): Promise<Codecs> {
  ready ??= (async () => {
    const [jpegEnc, jpegDec, webpEnc, webpDec, avifEnc, avifDec, jxlEnc, jxlDec, png, oxipng, resize] = await Promise.all([
      import('@jsquash/jpeg/encode.js'),
      import('@jsquash/jpeg/decode.js'),
      import('@jsquash/webp/encode.js'),
      import('@jsquash/webp/decode.js'),
      import('@jsquash/avif/encode.js'),
      import('@jsquash/avif/decode.js'),
      import('@jsquash/jxl/encode.js'),
      import('@jsquash/jxl/decode.js'),
      import('@jsquash/png/decode.js'),
      import('@jsquash/oxipng/optimise.js'),
      import('@jsquash/resize'),
    ]);
    await jpegEnc.init(await wasm('@jsquash/jpeg', 'codec/enc/mozjpeg_enc.wasm'));
    await jpegDec.init(await wasm('@jsquash/jpeg', 'codec/dec/mozjpeg_dec.wasm'));
    await webpEnc.init(await wasm('@jsquash/webp', 'codec/enc/webp_enc_simd.wasm'));
    await webpDec.init(await wasm('@jsquash/webp', 'codec/dec/webp_dec.wasm'));
    await avifEnc.init(await wasm('@jsquash/avif', 'codec/enc/avif_enc.wasm'));
    await avifDec.init(await wasm('@jsquash/avif', 'codec/dec/avif_dec.wasm'));
    await jxlEnc.init(await wasm('@jsquash/jxl', 'codec/enc/jxl_enc.wasm'));
    await jxlDec.init(await wasm('@jsquash/jxl', 'codec/dec/jxl_dec.wasm'));
    await png.init(await wasm('@jsquash/png', 'codec/pkg/squoosh_png_bg.wasm'));
    await oxipng.init(await wasm('@jsquash/oxipng', 'codec/pkg/squoosh_oxipng_bg.wasm'));
    await resize.initResize(await wasm('@jsquash/resize', 'lib/resize/pkg/squoosh_resize_bg.wasm'));

    const decoders: Record<ImageFormat, (b: ArrayBuffer) => Promise<ImageData>> = {
      jpeg: (b) => jpegDec.default(b),
      png: (b) => png.default(b),
      webp: (b) => webpDec.default(b),
      avif: async (b) => {
        const r = await avifDec.default(b);
        if (!r) throw new Error('AVIF decode failed');
        return r as ImageData;
      },
      jxl: (b) => jxlDec.default(b),
    };
    const codecs: Codecs = {
      decode: async (f, b) => ({ image: await decoders[f](b), oriented: false }),
      decodeExact: (f, b) => decoders[f](b),
      jpeg: (img, o) => jpegEnc.default(img, o),
      webp: (img, o) => webpEnc.default(img, o),
      avif: (img, o) => avifEnc.default(img, o),
      jxl: (img, o) => jxlEnc.default(img, o),
      png: (img, o) => oxipng.default(img, { level: o.level, interlace: false, optimiseAlpha: true }),
      resize: (img, width, height) =>
        resize.default(img, { width, height, method: 'lanczos3', fitMethod: 'stretch', premultiply: true, linearRGB: true }),
    };
    return codecs;
  })();
  return ready;
}
