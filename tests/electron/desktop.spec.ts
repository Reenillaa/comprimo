import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as unknown as string;
const FX = resolve('tests/fixtures');
const finished = '[data-testid=file-row]:is([data-status=done],[data-status=error],[data-status=duplicate],[data-status=cancelled])';

let app: ElectronApplication;
let page: Page;
let outDir: string;
let watchDir: string;

test.beforeEach(async () => {
  const root = mkdtempSync(join(tmpdir(), 'comprimo-e2e-'));
  outDir = join(root, 'salida');
  watchDir = join(root, 'camara');
  mkdirSync(outDir);
  mkdirSync(watchDir);
  app = await electron.launch({
    executablePath: electronPath,
    args: [resolve('electron/main.cjs'), '--no-sandbox'],
    env: { ...process.env, COMPRIMO_E2E_OUTPUT_DIR: outDir, COMPRIMO_E2E_WATCH_DIR: watchDir, COMPRIMO_USER_DATA: join(root, 'perfil') },
  });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
});

test.afterEach(async () => {
  await app.close();
});

test('arranca desde app:// con el puente de escritorio y sin Node en la interfaz', async () => {
  expect(page.url()).toBe('app://comprimo/index.html');
  await expect(page.getByRole('heading', { name: /Fotos ligeras/ })).toBeVisible();
  const env = await page.evaluate(() => ({
    bridge: typeof (window as unknown as { comprimoDesktop?: object }).comprimoDesktop,
    require: typeof (window as unknown as { require?: unknown }).require,
    process: typeof (window as unknown as { process?: unknown }).process,
  }));
  expect(env).toEqual({ bridge: 'object', require: 'undefined', process: 'undefined' });
  await expect(page.getByRole('heading', { name: 'Modo sesión' })).toBeVisible();
});

test('guarda cada foto en la carpeta elegida, con sufijo y sin sobrescribir', async () => {
  await page.getByTestId('preset-web').click(); // 2560 px, suffix _web
  await page.getByTestId('pick-output').click();
  await expect(page.locator('.folder-pill')).toContainText('salida');
  await page.getByTestId('file-input').setInputFiles([join(FX, 'photo-large.jpg'), join(FX, 'photo.png')]);
  await expect.poll(() => page.locator(finished).count(), { timeout: 120_000 }).toBe(2);
  await expect.poll(() => readdirSync(outDir).sort(), { timeout: 20_000 }).toEqual(['photo-large_web.jpg', 'photo_web.png']);
  const m = await sharp(readFileSync(join(outDir, 'photo-large_web.jpg'))).metadata();
  expect([m.width, m.height]).toEqual([2560, 1920]);
  await expect(page.getByTestId('reveal').first()).toBeVisible();

  // Same photo again → "Procesar igualmente" → never overwrites: "(2)"
  await page.getByTestId('file-input').setInputFiles([join(FX, 'photo.png')]);
  const dup = page.locator('[data-testid=file-row][data-status=duplicate]');
  await expect(dup).toHaveCount(1);
  await dup.getByRole('button', { name: 'Procesar igualmente' }).click();
  await expect.poll(() => readdirSync(outDir).sort(), { timeout: 60_000 }).toContain('photo_web (2).png');
});

test('modo sesión: una foto que la "cámara" escribe poco a poco se optimiza y se guarda sola', async () => {
  await page.getByTestId('pick-output').click();
  await page.getByTestId('pick-watch').click();
  await page.getByTestId('session-toggle').click();
  await expect(page.getByTestId('session-toggle')).toContainText('En directo');

  // Simulate tethering: the file appears in chunks over ~1 s.
  const bytes = readFileSync(join(FX, 'photo-exif.jpg'));
  const target = join(watchDir, 'IMG_0042.JPG');
  writeFileSync(target, bytes.subarray(0, 4000));
  for (let off = 4000; off < bytes.length; off += 8000) {
    await new Promise((r) => setTimeout(r, 250));
    appendFileSync(target, bytes.subarray(off, off + 8000));
  }

  const row = page.locator('[data-testid=file-row][data-name="IMG_0042.JPG"]');
  await expect(row).toHaveAttribute('data-status', 'done', { timeout: 60_000 });
  await expect(row.locator('.chip-session')).toBeVisible();
  await expect(page.getByTestId('session-toggle')).toContainText('1 foto');
  await expect.poll(() => readdirSync(outDir), { timeout: 20_000 }).toEqual(['IMG_0042.JPG']);
  const m = await sharp(readFileSync(join(outDir, 'IMG_0042.JPG'))).metadata();
  expect([m.width, m.height]).toEqual([300, 451]); // upright
  expect(readFileSync(join(outDir, 'IMG_0042.JPG')).length).toBeLessThan(bytes.length);

  // A non-image file in the folder is ignored
  writeFileSync(join(watchDir, 'notas.txt'), 'hola');
  await page.waitForTimeout(2000);
  await expect(page.locator('[data-testid=file-row]')).toHaveCount(1);

  await page.getByTestId('session-toggle').click();
  await expect(page.getByTestId('session-toggle')).toContainText('Empezar sesión');
});

test('modo sesión: rechaza una salida dentro de la carpeta vigilada (evita bucles)', async () => {
  await app.close();
  const root = mkdtempSync(join(tmpdir(), 'comprimo-loop-'));
  const cam = join(root, 'camara');
  mkdirSync(join(cam, 'salida'), { recursive: true });
  app = await electron.launch({
    executablePath: electronPath,
    args: [resolve('electron/main.cjs'), '--no-sandbox'],
    env: { ...process.env, COMPRIMO_E2E_OUTPUT_DIR: join(cam, 'salida'), COMPRIMO_E2E_WATCH_DIR: cam, COMPRIMO_USER_DATA: join(root, 'perfil') },
  });
  page = await app.firstWindow();
  await page.getByTestId('pick-output').click();
  await page.getByTestId('pick-watch').click();
  await page.getByTestId('session-toggle').click();
  await expect(page.locator('.session .card-error')).toContainText('no puede estar dentro de la carpeta vigilada');
  await expect(page.getByTestId('session-toggle')).toContainText('Empezar sesión');
});

test('seguridad: no escribe fuera de las carpetas elegidas', async () => {
  const outside = mkdtempSync(join(tmpdir(), 'comprimo-outside-'));
  const err = await page.evaluate(async (dir) => {
    try {
      await (window as unknown as { comprimoDesktop: { save: (d: string, n: string, b: Uint8Array) => Promise<string> } }).comprimoDesktop.save(dir, 'x.jpg', new Uint8Array([1]));
      return 'ok';
    } catch (e) {
      return String((e as Error).message);
    }
  }, outside);
  expect(err).toMatch(/no autorizada/);
  expect(readdirSync(outside)).toEqual([]);
  const traversal = await page.evaluate(async (dir) => {
    const d = (window as unknown as { comprimoDesktop: { pickFolder: (p: string) => Promise<string>; save: (d: string, n: string, b: Uint8Array) => Promise<string> } }).comprimoDesktop;
    const picked = await d.pickFolder('output');
    return d.save(picked, '../../escapado.jpg', new Uint8Array([1])).then((p) => p.startsWith(dir) ? 'dentro' : `fuera: ${p}`);
  }, outDir);
  expect(traversal).toBe('dentro');
});
