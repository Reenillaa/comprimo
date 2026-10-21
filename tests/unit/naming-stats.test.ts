import { describe, expect, it } from 'vitest';
import { outputName, uniqueNames } from '../../src/engine/naming';
import { formatBytes, savings, totals } from '../../src/engine/stats';

describe('outputName', () => {
  it('conserva nombre y extensión si el formato no cambia', () => {
    expect(outputName('Foto.JPEG', 'jpeg')).toBe('Foto.JPEG');
    expect(outputName('a.jpg', 'jpeg')).toBe('a.jpg');
    expect(outputName('logo.png', 'png')).toBe('logo.png');
  });
  it('cambia la extensión al convertir', () => {
    expect(outputName('logo.png', 'webp')).toBe('logo.webp');
    expect(outputName('foto.jpeg', 'avif')).toBe('foto.avif');
    expect(outputName('x.webp', 'jxl')).toBe('x.jxl');
    expect(outputName('x.png', 'jpeg')).toBe('x.jpg');
  });
  it('archivo con extensión engañosa: usa la real', () => {
    expect(outputName('dibujo.jpg', 'png')).toBe('dibujo.png');
  });
  it('sin extensión o con puntos en el nombre', () => {
    expect(outputName('captura', 'png')).toBe('captura.png');
    expect(outputName('v1.2.final.png', 'webp')).toBe('v1.2.final.webp');
  });
  it('limpia separadores de ruta', () => {
    expect(outputName('../evil/x.png', 'png')).toBe('.._evil_x.png');
  });
});

describe('uniqueNames', () => {
  it('desambigua sin distinguir mayúsculas', () => {
    expect(uniqueNames(['a.png', 'A.png', 'a.png', 'b'])).toEqual(['a.png', 'A (2).png', 'a (3).png', 'b']);
  });
});

describe('savings/totals', () => {
  it('porcentaje real con un decimal', () => {
    expect(savings(1000, 333)).toEqual({ bytes: 667, percent: 66.7 });
  });
  it('resultado mayor → porcentaje negativo', () => {
    expect(savings(100, 120)).toEqual({ bytes: -20, percent: -20 });
  });
  it('original 0 no divide por cero', () => {
    expect(savings(0, 10)).toEqual({ bytes: 0, percent: 0 });
  });
  it('totales del lote', () => {
    expect(totals([{ original: 1000, result: 500 }, { original: 3000, result: 1000 }])).toEqual({
      original: 4000,
      result: 1500,
      bytes: 2500,
      percent: 62.5,
    });
  });
  it('formatBytes', () => {
    expect(formatBytes(999)).toBe('999 B');
    expect(formatBytes(1500)).toBe('1,5 kB');
    expect(formatBytes(2_340_000)).toBe('2,3 MB');
  });
});

describe('withSuffix', () => {
  it('inserta antes de la extensión y limpia caracteres no válidos', async () => {
    const { withSuffix } = await import('../../src/engine/naming');
    expect(withSuffix('foto.jpg', '_web')).toBe('foto_web.jpg');
    expect(withSuffix('foto', '-x')).toBe('foto-x');
    expect(withSuffix('a.b.png', '')).toBe('a.b.png');
    expect(withSuffix('a.png', '/../x')).toBe('a..x.png');
  });
});
