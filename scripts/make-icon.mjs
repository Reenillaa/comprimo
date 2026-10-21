// Generates electron/icon.png (1024) and build/icon.icns (macOS) from an SVG drawn here.
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

// macOS icon grid: 1024 canvas, ~824 rounded square with soft shadow.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#22d3ee"/>
    </linearGradient>
    <radialGradient id="shine" cx="0.3" cy="0.2" r="0.9">
      <stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="0.6" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000" flood-opacity="0.35"/></filter>
  </defs>
  <g filter="url(#s)">
    <rect x="100" y="100" width="824" height="824" rx="186" fill="url(#g)"/>
    <rect x="100" y="100" width="824" height="824" rx="186" fill="url(#shine)"/>
  </g>
  <g transform="translate(512 512)" fill="none" stroke="#fff" stroke-width="34" stroke-linecap="round" stroke-linejoin="round">
    <circle r="250"/>
    ${[0, 60, 120, 180, 240, 300].map((a) => `<path transform="rotate(${a})" d="M0 -250 L 125 -33"/>`).join('')}
  </g>
</svg>`;

mkdirSync('build', { recursive: true });
const png1024 = await sharp(Buffer.from(svg)).png().toBuffer();
writeFileSync('electron/icon.png', png1024);
writeFileSync('build/icon.png', png1024);

// ICNS: 'icns' + total length, then entries (type, length incl. 8-byte header, PNG data).
const types = [['icp4', 16], ['icp5', 32], ['icp6', 64], ['ic07', 128], ['ic08', 256], ['ic09', 512], ['ic10', 1024], ['ic11', 32], ['ic12', 64], ['ic13', 256], ['ic14', 512]];
const chunks = [];
for (const [type, size] of types) {
  const data = await sharp(png1024).resize(size, size, { kernel: 'lanczos3' }).png().toBuffer();
  const head = Buffer.alloc(8);
  head.write(type, 0, 'ascii');
  head.writeUInt32BE(data.length + 8, 4);
  chunks.push(head, data);
}
const body = Buffer.concat(chunks);
const header = Buffer.alloc(8);
header.write('icns', 0, 'ascii');
header.writeUInt32BE(body.length + 8, 4);
writeFileSync('build/icon.icns', Buffer.concat([header, body]));
console.log('icon.png + icon.icns listos');
