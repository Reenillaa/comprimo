// Builds Comprimo.app for macOS (arm64 + x64) from any OS, ad-hoc signs it and zips it.
//   ELECTRON_ZIP_DIR=/path/with/electron-zips  RCODESIGN=/path/to/rcodesign  node scripts/package-mac.mjs
// On macOS, `codesign` is used instead of rcodesign when RCODESIGN is not set.
import { packager } from '@electron/packager';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve('.');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const electronVersion = JSON.parse(readFileSync('node_modules/electron/package.json', 'utf8')).version;
const stage = join(root, 'build', 'stage');
const out = join(root, 'release');
const arches = (process.env.MAC_ARCHES || 'arm64,x64').split(',');

if (!existsSync('dist/index.html')) throw new Error('Falta dist/: ejecuta npm run build antes.');
rmSync(stage, { recursive: true, force: true });
mkdirSync(join(stage, 'electron'), { recursive: true });
for (const f of ['main.cjs', 'preload.cjs', 'icon.png']) cpSync(join('electron', f), join(stage, 'electron', f));
cpSync('dist', join(stage, 'dist'), { recursive: true });
writeFileSync(
  join(stage, 'package.json'),
  JSON.stringify({ name: pkg.name, productName: 'Comprimo', version: pkg.version, description: pkg.description, main: 'electron/main.cjs', author: pkg.author, license: pkg.license }, null, 2),
);

mkdirSync(out, { recursive: true });
const results = [];
for (const arch of arches) {
  const [appDir] = await packager({
    dir: stage,
    out,
    platform: 'darwin',
    arch,
    name: 'Comprimo',
    executableName: 'Comprimo',
    appBundleId: 'io.github.reenillaa.comprimo',
    appCategoryType: 'public.app-category.photography',
    appVersion: pkg.version,
    buildVersion: pkg.version,
    appCopyright: 'Comprimo · MIT',
    icon: 'build/icon.icns',
    electronVersion,
    electronZipDir: process.env.ELECTRON_ZIP_DIR || undefined,
    asar: true,
    prune: false,
    overwrite: true,
    darwinDarkModeSupport: true,
    extendInfo: { NSHighResolutionCapable: true },
  });
  const app = join(appDir, 'Comprimo.app');

  // Ad-hoc signature: required for Apple Silicon to launch the modified bundle.
  // (Not a Developer ID signature and not notarized: Gatekeeper still asks the first time.)
  if (process.env.RCODESIGN) execFileSync(process.env.RCODESIGN, ['sign', app], { stdio: 'inherit' });
  else if (process.platform === 'darwin') execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  else console.warn('⚠️  Sin firma ad-hoc (define RCODESIGN): no arrancará en Macs con Apple Silicon.');

  const zip = join(out, `Comprimo-${pkg.version}-mac-${arch}.zip`);
  rmSync(zip, { force: true });
  // -y keeps the framework symlinks; Finder's Archive Utility restores them.
  execFileSync('zip', ['-qry', zip, 'Comprimo.app'], { cwd: appDir });
  results.push(zip);
}
console.log('\nListo:\n' + results.map((r) => '  ' + r).join('\n'));
