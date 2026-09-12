import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('geochase_activeProjectId')) return;
    const now = Date.now();
    const project = {
      id: 'pages-verification',
      name: 'Pages verification',
      createdAt: now,
      updatedAt: now,
      data: { circles: [], lineSegments: [], points: [], polygons: [], notes: [] },
      viewData: { topPanelOpen: true, sidePanelOpen: false },
    };
    localStorage.setItem('gpxCircle_language', 'en');
    localStorage.setItem('geochase_projects', JSON.stringify([project]));
    localStorage.setItem('geochase_activeProjectId', project.id);
  });
});

test('loads production assets and drawing controls under the Pages subpath', async ({ page }) => {
  const errors: string[] = [];
  const assets: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.origin !== 'http://127.0.0.1:4173') return;
    if (response.status() >= 400) errors.push(`${response.status()} ${url.pathname}`);
    if (url.pathname.includes('/assets/')) assets.push(url.pathname);
  });

  await page.goto('./');
  await expect(page.locator('#map canvas').first()).toBeVisible();
  await expect(page.locator('script[type="module"][src]')).toHaveAttribute(
    'src',
    /^\/GeoChase\/assets\/.+\.js$/
  );
  await page.evaluate(() => document.fonts.ready);
  expect(assets.some((path) => path.endsWith('.css'))).toBe(true);
  expect(assets.some((path) => path.endsWith('.woff2'))).toBe(true);
  expect(assets.every((path) => path.startsWith('/GeoChase/assets/'))).toBe(true);

  await page.getByTestId('draw-circle-btn').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.reload();
  await page.getByTestId('save-menu-btn').click();
  await expect(page.getByTestId('new-project-btn')).toBeVisible();
  expect(errors).toEqual([]);
});

test('loads the bundled PDF worker and renders an uploaded document', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');

  const pdf = Buffer.from(`%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> /Contents 4 0 R >> endobj
4 0 obj << /Length 0 >> stream
endstream
endobj
trailer << /Root 1 0 R >>
%%EOF`);
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('pdf-btn').click();
  const worker = page.waitForResponse((response) =>
    /\/GeoChase\/assets\/pdf\.worker\..+\.mjs$/.test(new URL(response.url()).pathname)
  );
  await (
    await chooser
  ).setFiles({ name: 'pages-test.pdf', mimeType: 'application/pdf', buffer: pdf });
  expect((await worker).ok()).toBe(true);
  const canvas = page.locator('.pdf-viewer canvas').last();
  await expect(canvas).toBeVisible();
  await expect
    .poll(() =>
      canvas.evaluate(
        (element) => element instanceof HTMLCanvasElement && element.width > 0 && element.height > 0
      )
    )
    .toBe(true);
  expect(errors).toEqual([]);
});
