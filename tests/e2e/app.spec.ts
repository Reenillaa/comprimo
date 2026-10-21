import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const FX = 'tests/fixtures/';
const finished = '[data-testid=file-row]:is([data-status=done],[data-status=error],[data-status=duplicate],[data-status=cancelled])';

async function waitAll(page: Page, n: number) {
  await expect.poll(() => page.locator(finished).count(), { timeout: 150_000 }).toBe(n);
}
const row = (page: Page, name: string) => page.locator(`[data-testid=file-row][data-name="${name}"]`);

async function readDownload(dl: import('@playwright/test').Download) {
  const p = await dl.path();
  return readFileSync(p!);
}

/** Track every network request the page or its workers make. */
function trackRequests(page: Page) {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  return urls;
}

test.describe('Comprimo', () => {
  test('selector múltiple: cada formato termina y los tamaños son reales', async ({ page }) => {
    const requests = trackRequests(page);
    await page.goto('/');
    const files = ['photo-exif.jpg', 'photo.png', 'flat-graphic.png', 'photo.webp', 'photo.avif', 'alpha.png'];
    await page.getByTestId('file-input').setInputFiles(files.map((f) => FX + f));
    await waitAll(page, files.length);

    for (const f of files) {
      const r = row(page, f);
      await expect(r).toHaveAttribute('data-status', 'done');
      const shown = Number(await r.getByTestId('result-size').getAttribute('data-bytes'));
      const [dl] = await Promise.all([page.waitForEvent('download'), r.getByTestId('download-link').click()]);
      const bytes = await readDownload(dl);
      expect(bytes.length, f).toBe(shown); // displayed size == downloaded bytes
      expect(bytes.length, f).toBeLessThan(readFileSync(FX + f).length);
      const meta = await sharp(bytes).metadata(); // decodable by an independent decoder
      expect(meta.width, f).toBeGreaterThan(0);
      expect(dl.suggestedFilename()).toBe(f);
    }
    // The percentage shown matches the bytes
    const r = row(page, 'photo.png');
    const out = Number(await r.getByTestId('result-size').getAttribute('data-bytes'));
    const orig = readFileSync(FX + 'photo.png').length;
    const pct = (Math.round((1 - out / orig) * 1000) / 10).toLocaleString('es-ES');
    await expect(r.getByTestId('result-savings')).toContainText(pct);

    // No request ever left the local server (no commercial API, no telemetry).
    const external = requests.filter((u) => !/^(http:\/\/127\.0\.0\.1:4173\/|blob:|data:)/.test(u));
    expect(external).toEqual([]);
  });

  test('orientación EXIF: la foto sale derecha y sin girar dos veces', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('file-input').setInputFiles([FX + 'photo-exif.jpg']);
    await waitAll(page, 1);
    const r = row(page, 'photo-exif.jpg');
    await expect(r).toContainText('300×451');
    const [dl] = await Promise.all([page.waitForEvent('download'), r.getByTestId('download-link').click()]);
    const out = await sharp(await readDownload(dl)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([out.info.width, out.info.height]).toEqual([300, 451]);
    // Compare with libvips' own auto-orientation of the source
    const ref = await sharp(readFileSync(FX + 'photo-exif.jpg')).autoOrient().ensureAlpha().raw().toBuffer();
    let diff = 0;
    for (let i = 0; i < ref.length; i++) diff += Math.abs(ref[i] - out.data[i]);
    expect(diff / ref.length).toBeLessThan(8); // mean abs error per channel: same orientation
  });

  test('arrastrar y soltar', async ({ page }) => {
    await page.goto('/');
    const buf = readFileSync(FX + 'photo-exif.jpg').toString('base64');
    const dt = await page.evaluateHandle(async (b64) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const d = new DataTransfer();
      d.items.add(new File([bin], 'arrastrada.jpg', { type: 'image/jpeg' }));
      d.items.add(new File([bin.slice(0, 100)], 'rota.jpg', { type: 'image/jpeg' }));
      return d;
    }, buf);
    const zone = page.getByTestId('dropzone');
    await zone.dispatchEvent('dragenter', { dataTransfer: dt });
    await expect(page.getByText('¡Suéltalas!')).toBeVisible();
    await zone.dispatchEvent('drop', { dataTransfer: dt });
    await waitAll(page, 2);
    await expect(row(page, 'arrastrada.jpg')).toHaveAttribute('data-status', 'done');
    await expect(row(page, 'rota.jpg')).toHaveAttribute('data-status', 'error');
    await expect(row(page, 'rota.jpg').getByTestId('row-error')).toContainText(/incompleto|dañado/);
  });

  test('descargar todo como ZIP con nombres únicos', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('file-input').setInputFiles([FX + 'photo.png', FX + 'flat-graphic.png', FX + 'mislabeled.jpg']);
    await waitAll(page, 3);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-all').click()]);
    expect(dl.suggestedFilename()).toBe('comprimo-imagenes.zip');
    const entries = unzipSync(new Uint8Array(await readDownload(dl)));
    // mislabeled.jpg has the same content as flat-graphic.png → duplicate, not processed
    await expect(row(page, 'mislabeled.jpg')).toHaveAttribute('data-status', 'duplicate');
    expect(Object.keys(entries).sort()).toEqual(['flat-graphic.png', 'photo.png']);
    for (const [name, data] of Object.entries(entries)) {
      const m = await sharp(Buffer.from(data)).metadata();
      expect(m.format, name).toBe('png');
    }
    // Totals in the summary match the files
    const detail = page.getByTestId('summary-detail');
    const result = Number(await detail.getAttribute('data-result'));
    expect(result).toBe(Object.values(entries).reduce((s, d) => s + d.length, 0));
  });

  test('ZIP con nombres repetidos se desambigua', async ({ page }) => {
    await page.goto('/');
    // two different images, same name
    await page.getByTestId('file-input').setInputFiles([
      { name: 'foto.png', mimeType: 'image/png', buffer: readFileSync(FX + 'photo.png') },
      { name: 'foto.png', mimeType: 'image/png', buffer: readFileSync(FX + 'tiny.png') },
    ]);
    await waitAll(page, 2);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-all').click()]);
    expect(Object.keys(unzipSync(new Uint8Array(await readDownload(dl)))).sort()).toEqual(['foto (2).png', 'foto.png']);
  });

  test('conversión PNG → WebP y redimensionado desde los ajustes', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Formato de salida').selectOption('webp');
    await page.getByLabel('Redimensionar').selectOption('fit');
    await page.getByLabel('Ancho', { exact: true }).fill('300');
    await page.getByLabel('Alto', { exact: true }).fill('300');
    await page.getByTestId('file-input').setInputFiles([FX + 'alpha.png']);
    await waitAll(page, 1);
    const r = row(page, 'alpha.png');
    await expect(r).toContainText('WebP · 300×200');
    const [dl] = await Promise.all([page.waitForEvent('download'), r.getByTestId('download-link').click()]);
    expect(dl.suggestedFilename()).toBe('alpha.webp');
    const bytes = await readDownload(dl);
    expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
    expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
    const m = await sharp(bytes).metadata();
    expect([m.width, m.height, m.hasAlpha]).toEqual([300, 200, true]);
  });

  test('errores claros: no admitido, dañado y animado', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('file-input').setInputFiles([FX + 'fake.jpg', FX + 'truncated.jpg', FX + 'animated.png']);
    await waitAll(page, 3);
    await expect(row(page, 'fake.jpg').getByTestId('row-error')).toContainText('No es una imagen reconocible');
    await expect(row(page, 'truncated.jpg').getByTestId('row-error')).toContainText('incompleto');
    await expect(row(page, 'animated.png').getByTestId('row-error')).toContainText('animada');
    await expect(page.getByTestId('download-all')).toBeDisabled();
  });

  test('cancelar y reintentar', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Formato de salida').selectOption('avif'); // slowest encoder
    await page.getByTestId('file-input').setInputFiles([FX + 'photo-large.jpg']);
    const r = row(page, 'photo-large.jpg');
    await expect(r).toHaveAttribute('data-status', 'processing');
    await r.getByRole('button', { name: 'Cancelar photo-large.jpg' }).click();
    await expect(r).toHaveAttribute('data-status', 'cancelled');
    await page.getByLabel('Formato de salida').selectOption('same');
    await r.getByRole('button', { name: 'Reintentar photo-large.jpg' }).click();
    await expect(r).toHaveAttribute('data-status', 'done', { timeout: 150_000 });
  });

  test('lote grande sin límite artificial (25 imágenes distintas)', async ({ page }) => {
    await page.goto('/');
    const files = await Promise.all(
      Array.from({ length: 25 }, async (_, i) => ({
        name: `lote-${i + 1}.png`,
        mimeType: 'image/png',
        buffer: await sharp({ create: { width: 120, height: 80, channels: 3, background: { r: i * 10, g: 255 - i * 9, b: 128 } } })
          .composite([{ input: Buffer.from(`<svg width="120" height="80"><text x="10" y="50" font-size="30">${i}</text></svg>`) }])
          .png()
          .toBuffer(),
      })),
    );
    await page.getByTestId('file-input').setInputFiles(files);
    await waitAll(page, 25);
    await expect(page.locator('[data-testid=file-row][data-status=done]')).toHaveCount(25);
    await expect(page.getByTestId('summary-detail')).toContainText('25 terminadas');
    await expect(page.getByTestId('live-region')).toContainText('Listo: 25 imágenes optimizadas');
  });

  test('comparador antes/después con teclado', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('file-input').setInputFiles([FX + 'photo.webp']);
    await waitAll(page, 1);
    await page.getByRole('button', { name: 'Comparar photo.webp' }).click();
    const dialog = page.getByTestId('compare-dialog');
    await expect(dialog).toBeVisible();
    const slider = dialog.getByLabel('Posición del corte');
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveValue('52');
    await expect(dialog.locator('.compare-after')).toHaveAttribute('style', /inset\(0px 0px 0px 52%\)|inset\(0 0 0 52%\)/);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('flujo con teclado: el botón abre el selector', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Ir a añadir fotos' })).toBeFocused();
    await page.keyboard.press('Enter'); // skip link jumps straight to the add button
    await expect(page.getByRole('button', { name: 'Elegir imágenes' })).toBeFocused();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Enter')]);
    expect(chooser.isMultiple()).toBe(true);
    await chooser.setFiles([FX + 'tiny.png']);
    await waitAll(page, 1);
  });

  test('accesibilidad (axe) sin violaciones graves, vacío y con resultados', async ({ page }) => {
    await page.goto('/');
    const empty = await new AxeBuilder({ page }).analyze();
    expect(empty.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')).map((v) => v.id)).toEqual([]);
    await page.getByTestId('file-input').setInputFiles([FX + 'photo.png', FX + 'fake.jpg']);
    await waitAll(page, 2);
    const full = await new AxeBuilder({ page }).analyze();
    expect(full.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')).map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  });

  test('móvil 375 px: sin scroll horizontal y todo usable', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.getByTestId('file-input').setInputFiles([FX + 'photo-exif.jpg', FX + 'fake.jpg']);
    await waitAll(page, 2);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const link = row(page, 'photo-exif.jpg').getByTestId('download-link');
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeInViewport();
    const box = (await link.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    expect(box.height).toBeGreaterThanOrEqual(40); // touch target
  });

  test('preajuste "Redes sociales" + sufijo: JPEG de 2048 px con nombre _rrss', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('preset-social').click();
    await expect(page.getByTestId('preset-social')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByLabel('Sufijo del nombre')).toHaveValue('_rrss');
    await page.getByTestId('file-input').setInputFiles([FX + 'photo-large.jpg', FX + 'alpha.png']);
    await waitAll(page, 2);
    const [dl] = await Promise.all([page.waitForEvent('download'), row(page, 'photo-large.jpg').getByTestId('download-link').click()]);
    expect(dl.suggestedFilename()).toBe('photo-large_rrss.jpg');
    const m = await sharp(await readDownload(dl)).metadata();
    expect([m.format, m.width, m.height]).toEqual(['jpeg', 2048, 1536]);
    // PNG with alpha converted to JPEG for social: flattened, renamed
    await expect(row(page, 'alpha.png')).toContainText('JPEG');
    // changing a setting leaves the preset ("personalizado")
    await page.getByLabel('Formato de salida').selectOption('webp');
    await expect(page.getByTestId('preset-social')).toHaveAttribute('aria-checked', 'false');
  });

  test('vista de lista, tema claro y persistencia de preferencias', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('file-input').setInputFiles([FX + 'tiny.png']);
    await waitAll(page, 1);
    await page.getByRole('radio', { name: 'Lista' }).check();
    await expect(page.locator('.gallery')).toHaveClass(/is-list/);
    await page.getByRole('button', { name: 'Cambiar a tema claro' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('sin muros de pago ni textos comerciales', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('file-input').setInputFiles([FX + 'photo.png']);
    await waitAll(page, 1);
    const text = (await page.locator('body').innerText()).toLowerCase();
    for (const word of ['pro', 'premium', 'upgrade', 'suscripción', 'subscription', 'crédito', 'precio', 'pagar', 'api key', 'clave api']) {
      expect(text, word).not.toMatch(new RegExp(`\\b${word}\\b`));
    }
  });

  test('la CSP de producción bloquea conexiones a terceros', async ({ page }) => {
    await page.goto('/');
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(csp).toContain("connect-src 'self'");
    const blocked = await page.evaluate(() =>
      fetch('https://api.tinify.com/shrink', { method: 'POST' }).then(
        () => false,
        () => true,
      ),
    );
    expect(blocked).toBe(true);
  });
});
