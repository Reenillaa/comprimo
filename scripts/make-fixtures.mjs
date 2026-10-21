// Generates tests/fixtures from freely licensed scikit-image sample photos (tests/fixtures/sources)
// and synthetic patterns. Run: npm run fixtures
import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const dir = new URL('../tests/fixtures/', import.meta.url).pathname;
const src = (n) => join(dir, 'sources', n);
await mkdir(dir, { recursive: true });

const out = (name, buf) => writeFile(join(dir, name), buf);

// Large photo: 2×2 mosaic of real photos upscaled to 3072×2304 (not a native high-res capture).
const tiles = await Promise.all(
  ['astronaut.png', 'coffee.png', 'chelsea.png', 'rocket.jpg'].map((n) =>
    sharp(src(n)).resize(1536, 1152, { fit: 'cover', kernel: 'lanczos3' }).png().toBuffer(),
  ),
);
const mosaic = await sharp({ create: { width: 3072, height: 2304, channels: 3, background: '#000' } })
  .composite(tiles.map((input, i) => ({ input, left: (i % 2) * 1536, top: Math.floor(i / 2) * 1152 })))
  .png()
  .toBuffer();
await out('photo-large.jpg', await sharp(mosaic).jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toBuffer());

// Fine detail + noise: real photo with Gaussian-ish noise added.
const coffee = await sharp(src('coffee.png')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const noisy = Buffer.from(coffee.data);
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
for (let i = 0; i < noisy.length; i++) noisy[i] = Math.max(0, Math.min(255, noisy[i] + (rnd() + rnd() + rnd() - 1.5) * 30));
await out('photo-noise.jpg', await sharp(noisy, { raw: coffee.info }).jpeg({ quality: 92 }).toBuffer());

// EXIF: orientation 6, copyright, date and GPS.
await out(
  'photo-exif.jpg',
  await sharp(src('chelsea.png'))
    .jpeg({ quality: 90 })
    .withMetadata({ orientation: 6 })
    .withExifMerge({
      IFD0: { Copyright: 'Comprimo test CC0', DateTime: '2024:01:02 03:04:05' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '40/1 25/1 0/1', GPSLongitudeRef: 'W', GPSLongitude: '3/1 42/1 0/1' },
    })
    .toBuffer(),
);

// Transparency: photo with radial alpha gradient + fully transparent corners.
const W = 600, H = 400;
const astro = await sharp(src('astronaut.png')).resize(W, H, { fit: 'cover' }).removeAlpha().raw().toBuffer();
const rgba = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x;
  const d = Math.hypot((x - W / 2) / (W / 2), (y - H / 2) / (H / 2));
  rgba[i * 4] = astro[i * 3]; rgba[i * 4 + 1] = astro[i * 3 + 1]; rgba[i * 4 + 2] = astro[i * 3 + 2];
  rgba[i * 4 + 3] = d >= 1 ? 0 : Math.round(255 * Math.min(1, (1 - d) * 2.5));
}
await out('alpha.png', await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 6 }).toBuffer());
await out('alpha.webp', await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 95, alphaQuality: 100 }).toBuffer());

// Flat graphic with text (svg rendered by libvips → ≤ a few hundred colours with antialiasing).
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500">
  <rect width="800" height="500" fill="#f4f1ea"/><rect x="40" y="40" width="320" height="200" fill="#1f6feb"/>
  <circle cx="560" cy="160" r="110" fill="#e85d04"/><rect x="40" y="290" width="720" height="160" fill="#2b9348"/>
  <text x="60" y="380" font-size="64" font-family="sans-serif" fill="#ffffff">Comprimo 123</text></svg>`;
await out('flat-graphic.png', await sharp(Buffer.from(svg)).png({ compressionLevel: 6 }).toBuffer());

await out('photo.png', await sharp(src('chelsea.png')).png({ compressionLevel: 6 }).toBuffer());
await out('photo.webp', await sharp(src('coffee.png')).webp({ quality: 92 }).toBuffer());
await out('photo.avif', await sharp(src('astronaut.png')).avif({ quality: 80, effort: 4 }).toBuffer());
await out('tiny.png', await sharp({ create: { width: 1, height: 1, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } }).png().toBuffer());
await out('solid.png', await sharp({ create: { width: 64, height: 64, channels: 3, background: '#336699' } }).png({ palette: true, compressionLevel: 9 }).toBuffer());
// Already heavily compressed JPEG: re-encoding cannot beat it without visible loss.
await out('already-small.jpg', await sharp(src('chelsea.png')).jpeg({ quality: 30, mozjpeg: true }).toBuffer());

// Broken / tricky inputs
const big = await readFile(join(dir, 'photo-noise.jpg'));
await out('truncated.jpg', big.subarray(0, Math.floor(big.length / 3)));
await out('fake.jpg', Buffer.from('Esto no es una imagen, es texto con extension .jpg\n'));
await out('mislabeled.jpg', await readFile(join(dir, 'flat-graphic.png')));

// Minimal APNG: copy a PNG and inject an acTL chunk after IHDR.
const base = await sharp({ create: { width: 8, height: 8, channels: 4, background: '#00ff00' } }).png().toBuffer();
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const actlData = Buffer.alloc(8); actlData.writeUInt32BE(2, 0); actlData.writeUInt32BE(0, 4);
const actl = Buffer.alloc(20); actl.writeUInt32BE(8, 0); actl.write('acTL', 4, 'ascii'); actlData.copy(actl, 8);
actl.writeUInt32BE(crc(actl.subarray(4, 16)), 16);
await out('animated.png', Buffer.concat([base.subarray(0, 33), actl, base.subarray(33)]));

console.log('fixtures written to', dir);
