import type { ImageFormat } from './types';

export type SniffedKind = ImageFormat | 'gif' | 'bmp' | 'tiff' | 'svg' | 'heic' | 'unknown';

export interface SniffResult {
  kind: SniffedKind;
  animated: boolean;
  width?: number;
  height?: number;
}

const ascii = (b: Uint8Array, start: number, len: number) =>
  String.fromCharCode(...b.subarray(start, start + len));

/** Identify a file by its content (magic bytes), never by its name. */
export function sniff(input: ArrayBuffer | Uint8Array): SniffResult {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (b.length < 12) return { kind: 'unknown', animated: false };

  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: 'jpeg', animated: false, ...jpegSize(b) };
  if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') return sniffPng(b);
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return sniffWebp(b);
  if (ascii(b, 4, 4) === 'ftyp') {
    const brands = ftypBrands(b);
    if (brands.some((x) => x === 'avif' || x === 'avis')) {
      return { kind: 'avif', animated: brands[0] === 'avis' };
    }
    if (brands.some((x) => ['heic', 'heix', 'hevc', 'mif1', 'msf1'].includes(x))) return { kind: 'heic', animated: false };
  }
  // JPEG XL: bare codestream (FF 0A) or ISOBMFF container.
  if (b[0] === 0xff && b[1] === 0x0a) return { kind: 'jxl', animated: false };
  if (ascii(b, 4, 4) === 'JXL ' && b[3] === 0x0c) return { kind: 'jxl', animated: false };
  if (ascii(b, 0, 4) === 'GIF8') return { kind: 'gif', animated: false };
  if (b[0] === 0x42 && b[1] === 0x4d) return { kind: 'bmp', animated: false };
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a) || (b[0] === 0x4d && b[1] === 0x4d && b[3] === 0x2a)) {
    return { kind: 'tiff', animated: false };
  }
  const head = new TextDecoder().decode(b.subarray(0, Math.min(512, b.length))).trimStart().toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return { kind: 'svg', animated: false };
  return { kind: 'unknown', animated: false };
}

function ftypBrands(b: Uint8Array): string[] {
  const size = (b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3];
  const brands = [ascii(b, 8, 4)];
  for (let i = 16; i + 4 <= Math.min(size, b.length); i += 4) brands.push(ascii(b, i, 4));
  return brands;
}

function sniffPng(b: Uint8Array): SniffResult {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const width = b.length >= 24 ? dv.getUint32(16) : undefined;
  const height = b.length >= 24 ? dv.getUint32(20) : undefined;
  // APNG declares an acTL chunk before the first IDAT.
  let animated = false;
  let p = 8;
  while (p + 8 <= b.length) {
    const len = dv.getUint32(p);
    const type = ascii(b, p + 4, 4);
    if (type === 'acTL') animated = true;
    if (type === 'IDAT' || type === 'IEND') break;
    p += 12 + len;
  }
  return { kind: 'png', animated, width, height };
}

function sniffWebp(b: Uint8Array): SniffResult {
  const chunk = ascii(b, 12, 4);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (chunk === 'VP8X' && b.length >= 30) {
    const animated = (b[20] & 0x02) !== 0;
    const width = 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
    const height = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
    return { kind: 'webp', animated, width, height };
  }
  if (chunk === 'VP8 ' && b.length >= 30) {
    return { kind: 'webp', animated: false, width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff };
  }
  if (chunk === 'VP8L' && b.length >= 25) {
    const bits = dv.getUint32(21, true);
    return { kind: 'webp', animated: false, width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return { kind: 'webp', animated: false };
}

function jpegSize(b: Uint8Array): { width?: number; height?: number } {
  let p = 2;
  while (p + 9 < b.length) {
    if (b[p] !== 0xff) return {};
    const marker = b[p + 1];
    if (marker === 0xff) {
      p++;
      continue;
    }
    const len = (b[p + 2] << 8) | b[p + 3];
    // SOF0..SOF15 except DHT (C4), JPG (C8) and DAC (CC)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: (b[p + 5] << 8) | b[p + 6], width: (b[p + 7] << 8) | b[p + 8] };
    }
    if (marker === 0xda) return {};
    p += 2 + len;
  }
  return {};
}

export function isSupportedKind(kind: SniffedKind): kind is ImageFormat {
  return kind === 'jpeg' || kind === 'png' || kind === 'webp' || kind === 'avif' || kind === 'jxl';
}

export function unsupportedMessage(kind: SniffedKind): string {
  const names: Partial<Record<SniffedKind, string>> = {
    gif: 'GIF',
    bmp: 'BMP',
    tiff: 'TIFF',
    svg: 'SVG',
    heic: 'HEIC/HEIF',
  };
  const found = names[kind];
  const list = 'JPEG, PNG, WebP, AVIF o JPEG XL';
  return found
    ? `Formato ${found} no compatible. Usa ${list}.`
    : `No es una imagen reconocible (el contenido no corresponde a ${list}).`;
}

/**
 * A JPEG whose entropy-coded data never reaches an EOI marker is truncated. Decoders "succeed"
 * on such files by painting the missing part grey, so this must be checked explicitly.
 * FF D9 cannot occur inside entropy-coded data (0xFF is byte-stuffed), so any EOI after the
 * first SOS proves the main image is complete; trailing data after it is allowed.
 */
export function isTruncatedJpeg(b: Uint8Array): boolean {
  let p = 2;
  while (p + 4 <= b.length) {
    if (b[p] !== 0xff) return true;
    const marker = b[p + 1];
    if (marker === 0xff) {
      p++;
      continue;
    }
    const len = (b[p + 2] << 8) | b[p + 3];
    if (marker === 0xda) {
      for (let i = p + 2 + len; i + 1 < b.length; i++) if (b[i] === 0xff && b[i + 1] === 0xd9) return false;
      return true;
    }
    p += 2 + len;
  }
  return true;
}
