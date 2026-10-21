import { DEFAULT_OPTIONS, type ProcessOptions } from '../engine/types';

export interface Preset {
  id: string;
  label: string;
  hint: string;
  icon: 'globe' | 'heart' | 'gift' | 'grid' | 'bolt';
  suffix: string;
  options: ProcessOptions;
}

const base = (p: Partial<ProcessOptions>): ProcessOptions => ({
  ...DEFAULT_OPTIONS,
  ...p,
  resize: { ...DEFAULT_OPTIONS.resize, ...p.resize },
  metadata: { ...DEFAULT_OPTIONS.metadata, ...p.metadata },
});

/** Exports a photographer typically needs during or right after a shoot. */
export const PRESETS: Preset[] = [
  {
    id: 'web',
    label: 'Web y portfolio',
    hint: '2560 px, ligera, con tu copyright y sin GPS',
    icon: 'globe',
    suffix: '_web',
    options: base({ profile: 'web', resize: { mode: 'fit', width: 2560, height: 2560 }, metadata: { keep: true, keepLocation: false } }),
  },
  {
    id: 'social',
    label: 'Redes sociales',
    hint: 'JPEG de 2048 px, sin metadatos',
    icon: 'heart',
    suffix: '_rrss',
    options: base({ output: 'jpeg', profile: 'web', resize: { mode: 'fit', width: 2048, height: 2048 } }),
  },
  {
    id: 'client',
    label: 'Entrega al cliente',
    hint: 'Tamaño completo, máxima fidelidad, EXIF sin GPS',
    icon: 'gift',
    suffix: '',
    options: base({ profile: 'photo', metadata: { keep: true, keepLocation: false } }),
  },
  {
    id: 'proof',
    label: 'Galería de pruebas',
    hint: '1600 px para que el cliente elija rápido',
    icon: 'grid',
    suffix: '_prueba',
    options: base({ output: 'jpeg', profile: 'web', resize: { mode: 'fit', width: 1600, height: 1600 } }),
  },
  {
    id: 'max',
    label: 'Máximo ahorro',
    hint: 'Elige el formato más ligero (AVIF/WebP)',
    icon: 'bolt',
    suffix: '',
    options: base({ output: 'auto', profile: 'web' }),
  },
];

/** Structural equality that ignores key order and undefined values. */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  const ka = Object.keys(a).filter((k) => (a as Record<string, unknown>)[k] !== undefined);
  const kb = Object.keys(b).filter((k) => (b as Record<string, unknown>)[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

export function matchPreset(o: ProcessOptions, suffix: string): string | undefined {
  return PRESETS.find((p) => p.suffix === suffix && same(p.options, o))?.id;
}
