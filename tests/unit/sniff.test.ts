import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isSupportedKind, sniff, unsupportedMessage } from '../../src/engine/sniff';

const fx = (n: string) => new Uint8Array(readFileSync(`tests/fixtures/${n}`));

describe('sniff (detección por contenido)', () => {
  it.each([
    ['photo-large.jpg', 'jpeg', 3072, 2304],
    ['photo.png', 'png', 451, 300],
    ['alpha.webp', 'webp', 600, 400],
    ['photo.webp', 'webp', 600, 400],
    ['photo.avif', 'avif', undefined, undefined],
  ])('%s → %s', (file, kind, w, h) => {
    const r = sniff(fx(file));
    expect(r.kind).toBe(kind);
    expect(r.animated).toBe(false);
    if (w) expect([r.width, r.height]).toEqual([w, h]);
  });

  it('ignora la extensión: un PNG llamado .jpg es PNG', () => {
    expect(sniff(fx('mislabeled.jpg')).kind).toBe('png');
  });

  it('texto con extensión .jpg es desconocido', () => {
    const r = sniff(fx('fake.jpg'));
    expect(r.kind).toBe('unknown');
    expect(isSupportedKind(r.kind)).toBe(false);
    expect(unsupportedMessage(r.kind)).toMatch(/No es una imagen/);
  });

  it('detecta APNG (chunk acTL) como animado', () => {
    const r = sniff(fx('animated.png'));
    expect(r.kind).toBe('png');
    expect(r.animated).toBe(true);
  });

  it('detecta WebP animado por la bandera VP8X', () => {
    const b = new Uint8Array(30);
    b.set(new TextEncoder().encode('RIFF'), 0);
    b.set(new TextEncoder().encode('WEBPVP8X'), 8);
    b[20] = 0x02;
    expect(sniff(b)).toMatchObject({ kind: 'webp', animated: true });
  });

  it('detecta JPEG XL (codestream) y formatos no admitidos', () => {
    expect(sniff(new Uint8Array([0xff, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).kind).toBe('jxl');
    expect(sniff(new TextEncoder().encode('GIF89a......')).kind).toBe('gif');
    expect(sniff(new TextEncoder().encode('<svg xmlns="x"></svg>')).kind).toBe('svg');
    expect(unsupportedMessage('gif')).toMatch(/GIF no compatible/);
  });

  it('entradas cortas o vacías', () => {
    expect(sniff(new Uint8Array(0)).kind).toBe('unknown');
    expect(sniff(new Uint8Array([0xff, 0xd8])).kind).toBe('unknown');
  });

  it('JPEG truncado sigue identificándose (el error llega al decodificar)', () => {
    expect(sniff(fx('truncated.jpg')).kind).toBe('jpeg');
  });
});

describe('isTruncatedJpeg', () => {
  it('JPEG completo no está truncado; cortado sí', async () => {
    const { isTruncatedJpeg } = await import('../../src/engine/sniff');
    expect(isTruncatedJpeg(fx('photo-large.jpg'))).toBe(false);
    expect(isTruncatedJpeg(fx('photo-exif.jpg'))).toBe(false);
    expect(isTruncatedJpeg(fx('truncated.jpg'))).toBe(true);
    // datos extra tras el EOI (p. ej. vídeo de "motion photo") no cuentan como truncado
    const withTrailer = new Uint8Array([...fx('already-small.jpg'), 1, 2, 3, 4]);
    expect(isTruncatedJpeg(withTrailer)).toBe(false);
  });
});
