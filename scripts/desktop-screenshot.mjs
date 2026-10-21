// Screenshot of the real Electron window with a live session (run under xvfb on Linux).
import { _electron as electron } from '@playwright/test';
import { mkdtempSync, mkdirSync, copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const root = mkdtempSync(join(tmpdir(), 'comprimo-shot-'));
const out = join(root, 'Entregas cliente'), cam = join(root, 'Sesión Boda Lucía');
mkdirSync(out); mkdirSync(cam);
const app = await electron.launch({
  executablePath: require('electron'),
  args: [resolve('electron/main.cjs'), '--no-sandbox'],
  env: { ...process.env, COMPRIMO_E2E_OUTPUT_DIR: out, COMPRIMO_E2E_WATCH_DIR: cam, COMPRIMO_USER_DATA: join(root, 'perfil') },
});
const page = await app.firstWindow();
await page.setViewportSize({ width: 1440, height: 900 });
await page.getByTestId('preset-web').click();
await page.getByTestId('pick-output').click();
await page.getByTestId('pick-watch').click();
await page.getByTestId('session-toggle').click();
const shots = ['photo-large.jpg', 'photo-exif.jpg', 'photo.png', 'alpha.png', 'photo.webp'];
for (const [i, f] of shots.entries()) { copyFileSync(resolve('tests/fixtures', f), join(cam, `IMG_${2040 + i}${f.slice(f.lastIndexOf('.'))}`)); }
await page.waitForFunction(() => document.querySelectorAll('[data-testid=file-row][data-status=done]').length >= 3, null, { timeout: 120000 });
await page.waitForTimeout(300);
await page.screenshot({ path: 'docs/screenshots/desktop-session.png' });
await app.close();
console.log('ok');
