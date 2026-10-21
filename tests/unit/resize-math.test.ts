import { describe, expect, it } from 'vitest';
import { planResize } from '../../src/engine/resize-math';

describe('planResize', () => {
  it('none → null', () => expect(planResize(100, 100, { mode: 'none' })).toBeNull());

  it('scale por ancho mantiene proporción', () => {
    expect(planResize(4000, 3000, { mode: 'scale', width: 1000 })).toMatchObject({ width: 1000, height: 750 });
  });
  it('scale por alto', () => {
    expect(planResize(4000, 3000, { mode: 'scale', height: 300 })).toMatchObject({ width: 400, height: 300 });
  });
  it('scale exige solo una dimensión', () => {
    expect(() => planResize(10, 10, { mode: 'scale', width: 5, height: 5 })).toThrow();
    expect(() => planResize(10, 10, { mode: 'scale' })).toThrow();
  });

  it('fit encaja en la caja', () => {
    expect(planResize(4000, 3000, { mode: 'fit', width: 800, height: 800 })).toMatchObject({ width: 800, height: 600 });
    expect(planResize(3000, 4000, { mode: 'fit', width: 800, height: 800 })).toMatchObject({ width: 600, height: 800 });
  });
  it('fit con solo ancho máximo', () => {
    expect(planResize(2000, 1000, { mode: 'fit', width: 500 })).toMatchObject({ width: 500, height: 250 });
  });

  it('nunca amplía', () => {
    expect(planResize(400, 300, { mode: 'fit', width: 800, height: 800 })).toBeNull();
    expect(planResize(400, 300, { mode: 'scale', width: 1000 })).toBeNull();
    expect(planResize(400, 300, { mode: 'percent', percent: 150 })).toBeNull();
  });

  it('percent redondea y nunca baja de 1 px', () => {
    expect(planResize(1001, 601, { mode: 'percent', percent: 50 })).toMatchObject({ width: 501, height: 301 });
    expect(planResize(3, 3, { mode: 'percent', percent: 1 })).toMatchObject({ width: 1, height: 1 });
  });

  it('cover escala y recorta al centro con tamaño exacto', () => {
    const p = planResize(4000, 3000, { mode: 'cover', width: 500, height: 500 })!;
    expect(p).toMatchObject({ scaleWidth: 667, scaleHeight: 500, width: 500, height: 500 });
    expect(p.crop).toEqual({ x: 83, y: 0, width: 500, height: 500 });
  });
  it('cover requiere ambas dimensiones', () => {
    expect(() => planResize(10, 10, { mode: 'cover', width: 5 })).toThrow();
  });
});
