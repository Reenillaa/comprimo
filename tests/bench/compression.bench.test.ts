// Reproducible benchmark: `npm run bench` → writes docs/benchmark-data.md
// Compares Comprimo's engine against fixed-quality libvips (sharp) encodes of the SAME inputs.
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { test } from 'vitest';
import { similarity } from '../../src/engine/metrics';
import { processImage } from '../../src/engine/pipeline';
import { DEFAULT_OPTIONS, type Profile } from '../../src/engine/types';
import { nodeCodecs } from '../helpers/node-codecs';

const FILES = ['photo-large.jpg', 'photo-noise.jpg', 'photo-exif.jpg', 'photo.png', 'alpha.png', 'flat-graphic.png', 'photo.webp', 'alpha.webp', 'photo.avif', 'already-small.jpg'];

async function pixels(b: Uint8Array | Buffer) {
  // autoOrient so EXIF-rotated inputs compare with rotated outputs
  const { data, info } = await sharp(Buffer.from(b)).autoOrient().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
}

async function reference(file: string, input: Buffer): Promise<Buffer> {
  const s = sharp(input).autoOrient();
  if (file.endsWith('.jpg')) return s.jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  if (file.endsWith('.png')) return s.png({ palette: true, quality: 80, effort: 7, compressionLevel: 9 }).toBuffer();
  if (file.endsWith('.webp')) return s.webp({ quality: 80, effort: 4 }).toBuffer();
  return s.avif({ quality: 50, effort: 4 }).toBuffer();
}

const kb = (n: number) => (n / 1000).toFixed(1);
const pct = (a: number, b: number) => `${(((a - b) / a) * 100).toFixed(1)} %`;

test('benchmark', async () => {
  const codecs = await nodeCodecs();
  const rows: string[] = [];
  for (const file of FILES) {
    const input = readFileSync(`tests/fixtures/${file}`);
    const src = await pixels(input);
    for (const profile of ['web', 'photo'] as Profile[]) {
      const t0 = performance.now();
      const r = await processImage(new Uint8Array(input), { ...DEFAULT_OPTIONS, profile }, codecs);
      const ms = performance.now() - t0;
      const sim = similarity(src, await pixels(r.bytes));
      rows.push(`| ${file} | Comprimo (${profile}) | ${kb(input.length)} | ${kb(r.bytes.length)} | ${pct(input.length, r.bytes.length)} | ${sim.toFixed(4)} | ${r.usedOriginal ? 'original conservado' : r.lossless ? 'sin pérdida' : r.format === 'png' ? `${r.quality} colores` : `q${r.quality}`} | ${ms.toFixed(0)} |`);
    }
    const t1 = performance.now();
    const ref = await reference(file, input);
    const msRef = performance.now() - t1;
    const simRef = similarity(src, await pixels(ref));
    const refLabel = file.endsWith('.jpg') ? 'libvips mozjpeg q80' : file.endsWith('.png') ? 'libvips paleta q80' : file.endsWith('.webp') ? 'libvips WebP q80' : 'libvips AVIF q50';
    rows.push(`| ${file} | Referencia (${refLabel}) | ${kb(input.length)} | ${kb(ref.length)} | ${pct(input.length, ref.length)} | ${simRef.toFixed(4)} | fija | ${msRef.toFixed(0)} |`);
    rows.push(`| ${file} | TinyJPG/TinyPNG | ${kb(input.length)} | — | — | — | no medido (servicio inaccesible desde el entorno) | — |`);
  }
  const md = [
    '<!-- Generado por `npm run bench`. No editar a mano. -->',
    `Generado: ${new Date().toISOString()} · Node ${process.version} · ${process.platform}/${process.arch} · motor en un solo hilo`,
    '',
    '| Archivo | Codificador | Entrada (kB) | Salida (kB) | Ahorro | Similitud* | Ajuste elegido | Tiempo (ms) |',
    '|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
    '\\* SSIM multiescala de Comprimo calculado sobre píxeles decodificados por **libvips** (decodificador independiente), 1 = idéntico.',
  ].join('\n');
  writeFileSync('docs/benchmark-data.md', md + '\n');
  console.log(md);
}, 900_000);
