import { EXTENSION, type ImageFormat } from './types';

const KNOWN_EXT = /\.(jpe?g|jfif|png|apng|webp|avif|jxl)$/i;

const SAME_FORMAT_EXT: Record<ImageFormat, RegExp> = {
  jpeg: /\.(jpe?g|jfif)$/i,
  png: /\.png$/i,
  webp: /\.webp$/i,
  avif: /\.avif$/i,
  jxl: /\.jxl$/i,
};

/**
 * Output file name: keeps the base name, and keeps the original extension (including its case)
 * only when it already matches the real output format. Otherwise the extension is replaced.
 */
export function outputName(original: string, format: ImageFormat): string {
  const clean = original.replace(/[\\/]/g, '_').trim() || 'imagen';
  if (SAME_FORMAT_EXT[format].test(clean)) return clean;
  const base = clean.replace(KNOWN_EXT, '');
  return `${base}.${EXTENSION[format]}`;
}

/** Make names unique (case-insensitive) for ZIP entries: "a.png", "a (2).png", … */
export function uniqueNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    let candidate = name;
    let n = 2;
    while (used.has(candidate.toLowerCase())) {
      const dot = name.lastIndexOf('.');
      candidate = dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`;
      n++;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  });
}
