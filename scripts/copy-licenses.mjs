// Copies the licence texts of every runtime dependency into dist/licenses (Apache-2.0/BSD/MIT notices).
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const pkgs = ['react', 'react-dom', 'scheduler', 'fflate', 'wasm-feature-detect', 'tslib',
  '@jsquash/jpeg', '@jsquash/png', '@jsquash/oxipng', '@jsquash/webp', '@jsquash/avif', '@jsquash/jxl', '@jsquash/resize'];
const out = new URL('../dist/licenses/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const index = [];
for (const name of pkgs) {
  const dir = dirname(require.resolve(`${name}/package.json`));
  const files = readdirSync(dir).filter((f) => /^(licen[cs]e|notice|copying)/i.test(f));
  const { version, license } = require(`${name}/package.json`);
  for (const f of files) cpSync(join(dir, f), join(out, `${name.replace('/', '__')}-${f}`));
  index.push(`${name}@${version} — ${license} — ${files.join(', ') || 'sin archivo de licencia en el paquete'}`);
}
cpSync(new URL('../THIRD_PARTY_LICENSES.md', import.meta.url).pathname, join(out, 'THIRD_PARTY_LICENSES.md'));
writeFileSync(join(out, 'INDEX.txt'), index.join('\n') + '\n');
console.log(`licencias copiadas a ${out}`);
if (!existsSync(join(out, 'INDEX.txt'))) process.exit(1);
