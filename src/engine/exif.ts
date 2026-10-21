/**
 * Small JPEG metadata toolkit: locate APP1/Exif, rewrite it safely in place and re-insert it.
 * Only IFD0 is edited; all other offsets stay valid because entries are removed without moving data.
 */

export interface JpegSegment {
  marker: number;
  /** Offset of the 0xFF byte. */
  start: number;
  /** Offset just past the segment. */
  end: number;
  /** Payload (after the 2-byte length). */
  payload: Uint8Array;
}

export function jpegSegments(b: Uint8Array): JpegSegment[] {
  if (b[0] !== 0xff || b[1] !== 0xd8) throw new Error('No es un JPEG');
  const out: JpegSegment[] = [];
  let p = 2;
  while (p + 4 <= b.length) {
    if (b[p] !== 0xff) break;
    const marker = b[p + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      p += 2;
      continue;
    }
    const len = (b[p + 2] << 8) | b[p + 3];
    out.push({ marker, start: p, end: p + 2 + len, payload: b.subarray(p + 4, p + 2 + len) });
    if (marker === 0xda) break; // start of scan: entropy-coded data follows
    p += 2 + len;
  }
  return out;
}

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0, 0]; // "Exif\0\0"

export function extractExif(jpeg: Uint8Array): Uint8Array | null {
  for (const s of jpegSegments(jpeg)) {
    if (s.marker === 0xe1 && EXIF_HEADER.every((v, i) => s.payload[i] === v)) return s.payload.slice();
  }
  return null;
}

const TAG_ORIENTATION = 0x0112;
const TAG_GPS = 0x8825;

export interface ExifRewriteResult {
  exif: Uint8Array;
  removedGps: boolean;
  hadOrientation: boolean;
}

/**
 * Normalise an APP1 Exif payload for re-use on already-rotated pixels:
 * Orientation → 1, GPS IFD pointer removed unless keepLocation, IFD1 (thumbnail) unlinked
 * because the embedded thumbnail would no longer match.
 */
export function rewriteExif(app1: Uint8Array, keepLocation: boolean): ExifRewriteResult {
  const exif = app1.slice();
  const t = 6; // TIFF header offset inside the payload
  const dv = new DataView(exif.buffer, exif.byteOffset, exif.byteLength);
  const order = String.fromCharCode(exif[t], exif[t + 1]);
  if (order !== 'II' && order !== 'MM') throw new Error('EXIF con orden de bytes inválido');
  const le = order === 'II';
  if (dv.getUint16(t + 2, le) !== 42) throw new Error('Cabecera TIFF inválida');
  const ifd0 = t + dv.getUint32(t + 4, le);
  let count = dv.getUint16(ifd0, le);
  let removedGps = false;
  let hadOrientation = false;
  for (let i = 0; i < count; i++) {
    const e = ifd0 + 2 + i * 12;
    const tag = dv.getUint16(e, le);
    if (tag === TAG_ORIENTATION) {
      hadOrientation = true;
      dv.setUint16(e + 8, 1, le);
    } else if (tag === TAG_GPS && !keepLocation) {
      // shift the remaining entries left by one
      exif.copyWithin(e, e + 12, ifd0 + 2 + count * 12);
      count--;
      i--;
      removedGps = true;
    }
  }
  dv.setUint16(ifd0, count, le);
  const nextPtr = ifd0 + 2 + count * 12;
  dv.setUint32(nextPtr, 0, le); // unlink IFD1
  if (removedGps) exif.fill(0, nextPtr + 4, nextPtr + 16);
  return { exif, removedGps, hadOrientation };
}

/** Insert an APP1 payload after SOI and any APP0 (JFIF) segment. */
export function insertApp1(jpeg: Uint8Array, payload: Uint8Array): Uint8Array {
  if (payload.length + 2 > 0xffff) throw new Error('EXIF demasiado grande');
  let at = 2;
  const segs = jpegSegments(jpeg);
  if (segs[0]?.marker === 0xe0) at = segs[0].end;
  const seg = new Uint8Array(4 + payload.length);
  seg[0] = 0xff;
  seg[1] = 0xe1;
  seg[2] = (payload.length + 2) >> 8;
  seg[3] = (payload.length + 2) & 0xff;
  seg.set(payload, 4);
  const out = new Uint8Array(jpeg.length + seg.length);
  out.set(jpeg.subarray(0, at), 0);
  out.set(seg, at);
  out.set(jpeg.subarray(at), at + seg.length);
  return out;
}

/** Read a few tags from IFD0 for tests and UI hints. */
export function readIfd0Tags(app1: Uint8Array): Map<number, string | number> {
  const t = 6;
  const dv = new DataView(app1.buffer, app1.byteOffset, app1.byteLength);
  const le = app1[t] === 0x49;
  const ifd0 = t + dv.getUint32(t + 4, le);
  const count = dv.getUint16(ifd0, le);
  const tags = new Map<number, string | number>();
  for (let i = 0; i < count; i++) {
    const e = ifd0 + 2 + i * 12;
    const tag = dv.getUint16(e, le);
    const type = dv.getUint16(e + 2, le);
    const n = dv.getUint32(e + 4, le);
    if (type === 2) {
      const off = n <= 4 ? e + 8 : t + dv.getUint32(e + 8, le);
      tags.set(tag, String.fromCharCode(...app1.subarray(off, off + n)).replace(/\0+$/, ''));
    } else if (type === 3) tags.set(tag, dv.getUint16(e + 8, le));
    else if (type === 4) tags.set(tag, dv.getUint32(e + 8, le));
  }
  return tags;
}

export const EXIF_TAGS = { ORIENTATION: TAG_ORIENTATION, GPS: TAG_GPS, COPYRIGHT: 0x8298, DATETIME: 0x0132 };

/** EXIF orientation of a JPEG (1 when absent or unreadable). */
export function jpegOrientation(jpeg: Uint8Array): number {
  try {
    const app1 = extractExif(jpeg);
    if (!app1) return 1;
    const o = readIfd0Tags(app1).get(TAG_ORIENTATION);
    return typeof o === 'number' && o >= 1 && o <= 8 ? o : 1;
  } catch {
    return 1;
  }
}
