// Smoke test of the PACKAGED app (e.g. Comprimo.app/Contents/MacOS/Comprimo on macOS CI).
// Skipped unless COMPRIMO_PACKAGED_APP points at the executable.
import { _electron as electron, expect, test } from '@playwright/test';
import { mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const exe = process.env.COMPRIMO_PACKAGED_APP;

test.skip(!exe, 'COMPRIMO_PACKAGED_APP no definido');

test('la app empaquetada arranca, procesa una foto y la guarda', async () => {
  const root = mkdtempSync(join(tmpdir(), 'comprimo-pkg-'));
  const out = join(root, 'salida');
  mkdirSync(out);
  const app = await electron.launch({
    executablePath: exe!,
    args: [],
    env: { ...process.env, COMPRIMO_E2E_OUTPUT_DIR: out, COMPRIMO_USER_DATA: join(root, 'perfil') },
  });
  try {
    const page = await app.firstWindow();
    await page.waitForURL('app://comprimo/index.html');
    await page.getByTestId('pick-output').click();
    await page.getByTestId('file-input').setInputFiles([resolve('tests/fixtures/photo-exif.jpg')]);
    await expect(page.locator('[data-testid=file-row]')).toHaveAttribute('data-status', 'done', { timeout: 120_000 });
    await expect.poll(() => readdirSync(out), { timeout: 20_000 }).toEqual(['photo-exif.jpg']);
  } finally {
    await app.close();
  }
});
