import type { MapContainer } from '../../../src/composables/useMap';
import type { ImageElement, ProjectData } from '../../../src/types/project';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../fixtures';

async function images(page: Page): Promise<ImageElement[]> {
  return page.evaluate(() => {
    const projects: ProjectData[] = JSON.parse(localStorage.getItem('geochase_projects') || '[]');
    const activeProject = projects.find(
      (project) => project.id === localStorage.getItem('geochase_activeProjectId')
    );
    return activeProject?.data.images ?? [];
  });
}
async function importImage(page: Page, fit = true, count = 1) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('import-image-btn').click();
  await (await chooser).setFiles('public/images/legende-ign.png');
  await expect(page.locator('.map-image')).toHaveCount(count);
  await expect(page.locator('.map-image').last()).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => images(page)).toHaveLength(count);
  if (fit) {
    await page.locator('[data-layer-type="image"] .layer-item-info').first().click();
    await expect
      .poll(async () => {
        const box = (await page.locator('.map-image').last().boundingBox())!;
        return box.height < page.viewportSize()!.height - 200;
      })
      .toBe(true);
    await waitForMapIdle(page);
  }
}
async function drag(page: Page, target: Locator, dx: number, dy: number) {
  const box = (await target.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 12 });
  await page.mouse.up();
}

async function mapCenter(page: Page) {
  return page.evaluate(() => {
    const element = document.querySelector('#map') as HTMLElement & {
      __vueParentComponent: { provides: Record<symbol, MapContainer> };
    };
    const provides = element.__vueParentComponent.provides;
    const key = Object.getOwnPropertySymbols(provides).find(
      (symbol) => symbol.description === 'mapContainer'
    )!;
    return provides[key]!.map.value!.getView().getCenter();
  });
}

async function waitForMapIdle(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const element = document.querySelector('#map') as HTMLElement & {
          __vueParentComponent: { provides: Record<symbol, MapContainer> };
        };
        const provides = element.__vueParentComponent.provides;
        const key = Object.getOwnPropertySymbols(provides).find(
          (symbol) => symbol.description === 'mapContainer'
        )!;
        const view = provides[key]!.map.value!.getView();
        return !view.getAnimating() && !view.getInteracting();
      })
    )
    .toBe(true);
}

test('sizes imported images at the current map scale and keeps their geographic size on zoom', async ({
  page,
  blankProject,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await waitForMapIdle(page);
  await page.getByTestId('map-scale').click();
  await page.getByText('1:25,000', { exact: true }).click();
  await expect(page.getByTestId('map-scale')).toHaveText('1:25,000');
  await importImage(page, false);
  const first = (await images(page))[0]!;
  const image = page.locator('.map-image').first();
  const natural = await image.locator('img').evaluate((element: HTMLImageElement) => ({
    width: element.naturalWidth,
    height: element.naturalHeight,
  }));
  const initialBox = (await image.boundingBox())!;
  expect(initialBox.width).toBeCloseTo(natural.width, 1);
  expect(initialBox.height).toBeCloseTo(natural.height, 1);
  await expect(page.getByTestId('map-scale')).toHaveText('1:25,000');

  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await waitForMapIdle(page);
  await expect
    .poll(async () => (await image.boundingBox())!.width)
    .toBeCloseTo(natural.width / 2, 1);
  expect((await images(page))[0]).toEqual(first);

  await importImage(page, false, 2);
  const second = (await images(page))[1]!;
  expect(second.width).toBeCloseTo(first.width * 2, 5);
  expect(second.height).toBeCloseTo(first.height * 2, 5);
  const secondBox = (await page.locator('.map-image').last().boundingBox())!;
  expect(secondBox.width).toBeCloseTo(natural.width, 1);
  expect(secondBox.height).toBeCloseTo(natural.height, 1);
});

test('imports directly and supports map transforms, undo, visibility, deletion and reload', async ({
  page,
  blankProject,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await importImage(page);
  const original = (await images(page))[0]!;
  await expect(page.getByRole('textbox', { name: 'Image name (optional)' })).toHaveValue(
    'legende-ign.png'
  );
  await page.getByRole('textbox', { name: 'Image name (optional)' }).fill('Overlay map');
  await page.getByRole('textbox', { name: 'Image name (optional)' }).press('Enter');
  await expect.poll(async () => (await images(page))[0]?.name).toBe('Overlay map');

  await drag(page, page.locator('.map-image'), 60, 25);
  await expect.poll(async () => (await images(page))[0]?.center.lon).not.toBe(original.center.lon);
  const moved = (await images(page))[0]!;
  await drag(page, page.locator('[data-image-handle="1,1"]'), 30, 30);
  await expect.poll(async () => (await images(page))[0]!.width).toBeGreaterThan(original.width);
  const resized = (await images(page))[0]!;
  expect(resized.width / resized.height).toBeCloseTo(original.width / original.height, 8);
  await page.getByTestId('undo-btn').click();
  await expect.poll(async () => (await images(page))[0]!.width).toBe(moved.width);
  await expect(page.locator('.map-image')).toBeVisible();
  await page.getByTestId('redo-btn').click();
  await expect.poll(async () => (await images(page))[0]!.width).toBe(resized.width);

  const box = (await page.locator('.map-image').boundingBox())!;
  const handle = (await page.locator('[data-image-handle="rotate"]').boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.keyboard.down('Shift');
  await page.mouse.move(box.x + box.width + 30, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect.poll(async () => (await images(page))[0]!.rotation).toBeCloseTo(90, 1);
  await page.getByRole('spinbutton', { name: 'Rotation', exact: true }).fill('37');
  await page.getByRole('spinbutton', { name: 'Rotation', exact: true }).press('Enter');
  await expect.poll(async () => (await images(page))[0]!.rotation).toBe(37);
  await page
    .getByRole('slider', { name: 'Opacity', exact: true })
    .evaluate((input: HTMLInputElement) => {
      input.value = '55';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  await page.getByRole('slider', { name: 'Opacity', exact: true }).press('Tab');
  await expect.poll(async () => (await images(page))[0]!.opacity).toBe(0.55);
  const saved = (await images(page))[0]!;
  await page.reload();
  await expect(page.locator('.map-image')).toBeVisible();
  expect((await images(page))[0]).toEqual(saved);
  await page.locator('[data-visibility-category="image"]').click();
  await expect(page.locator('.map-image')).toBeHidden();
  await page.locator('[data-visibility-category="image"]').click();
  await expect(page.locator('.map-image')).toBeVisible();
  // Unselected images let clicks and map dragging pass through. Only the sidebar
  // activates their transform controls after ending an edit or reloading.
  const controls = page.getByRole('group', { name: 'Edit image', exact: true });
  const boxAfterReload = (await page.locator('.map-image').boundingBox())!;
  await page.mouse.click(
    boxAfterReload.x + boxAfterReload.width / 2,
    boxAfterReload.y + boxAfterReload.height / 2
  );
  await expect(controls).toHaveCount(0);
  await expect(page.locator('[data-image-handle]')).toHaveCount(0);
  const centerBeforePan = await mapCenter(page);
  await drag(page, page.locator('.map-image'), 60, 25);
  await expect.poll(() => mapCenter(page)).not.toEqual(centerBeforePan);
  expect((await images(page))[0]).toEqual(saved);
  await expect(controls).toHaveCount(0);
  await page.locator('[data-layer-type="image"] .layer-item-info').click();
  await expect(controls).toBeVisible();
  await expect(page.locator('[data-image-handle="rotate"]')).toBeVisible();
  await controls.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(controls).toHaveCount(0);
  await page.locator('[data-layer-type="image"] .layer-item-info').click();
  await expect(controls.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
  await page.locator('[data-layer-type="image"] .layer-item-actions button').click();
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('listitem')
    .filter({ hasText: /^Delete$/ })
    .click();
  await expect(page.locator('.map-image')).toHaveCount(0);
  await page.getByTestId('undo-btn').click();
  await expect(page.locator('.map-image')).toBeVisible();
  expect((await images(page))[0]).toEqual(saved);
});

for (const source of ['image', 'pdf']) {
  test(`${source} exports image bytes and restores them in a fresh browser storage`, async ({
    page,
    browser,
    blankProject,
  }) => {
    if (source === 'image') await importImage(page);
    else {
      await uploadPdf(page, ['/MediaBox [0 0 595.2 841.8]']);
      await expect(page.locator('.map-image')).toBeVisible();
      await expect.poll(() => images(page)).toHaveLength(1);
    }
    const original = (await images(page))[0]!;
    await page.getByTestId('save-menu-btn').click();
    const download = page.waitForEvent('download');
    await page.getByTestId('export-json-btn').click();
    const file = await (await download).path();
    const context = await browser.newContext();
    try {
      const other = await context.newPage();
      await other.addInitScript(() => localStorage.setItem('gpxCircle_language', 'en'));
      await other.goto(page.url());
      await other.getByTestId('project-name-input').locator('input').fill('Fresh browser');
      await other.getByTestId('create-project-btn').click();
      await expect(other.getByRole('dialog')).toBeHidden();
      await other.getByTestId('save-menu-btn').click();
      const chooser = other.waitForEvent('filechooser');
      await other.getByTestId('import-json-btn').click();
      await (await chooser).setFiles(file!);
      await expect(other.locator('.map-image')).toBeVisible();
      await expect.poll(() => images(other)).toHaveLength(1);
      const restored = (await images(other))[0]!;
      expect(restored.assetId).not.toBe(original.assetId);
      expect(restored).toEqual({ ...original, assetId: restored.assetId });
      expect(
        await other
          .locator('.map-image img')
          .evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)
      ).toBe(true);
      await other.reload();
      await expect(other.locator('.map-image')).toBeVisible();
    } finally {
      await context.close();
    }
  });
}

// Small valid PDFs exercise the real PDF.js worker and integrated import UI.
function pdfFile(pages: string[]) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  ];
  for (const [index, settings] of pages.entries()) {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /Resources << >> ${settings} /Contents ${4 + index * 2} 0 R >>`
    );
    const content = '0.1 0.4 0.7 rg 0 0 1000 1000 re f';
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  }
  let pdf = '%PDF-1.7\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return { name: 'paper.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf) };
}

async function uploadPdf(page: Page, pages: string[]) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('import-image-btn').click();
  await (await chooser).setFiles(pdfFile(pages));
}

function groundSize(image: ImageElement) {
  const correction = Math.cos((image.center.lat * Math.PI) / 180);
  return { width: image.width * correction, height: image.height * correction };
}

test('imports PDF paper dimensions at map scale independently of rendering pixels', async ({
  page,
  blankProject,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await waitForMapIdle(page);
  await page.getByTestId('map-scale').click();
  await page.getByText('1:1,000,000', { exact: true }).click();
  await waitForMapIdle(page);
  // 10 × 20 inches: deliberately not A4.
  await uploadPdf(page, ['/MediaBox [0 0 720 1440]']);
  await expect(page.locator('.map-image')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('pdf-import-bar')).toHaveCount(0);
  await expect.poll(() => images(page)).toHaveLength(1);
  const imported = (await images(page))[0]!;
  expect(imported.name).toBe('paper.pdf');
  expect(groundSize(imported).width).toBeCloseTo(254_000, 4);
  expect(groundSize(imported).height).toBeCloseTo(508_000, 4);
  const pixels = await page
    .locator('.map-image img')
    .evaluate((img: HTMLImageElement) => ({ width: img.naturalWidth, height: img.naturalHeight }));
  expect(pixels.height).toBe(4096); // bounded render size, not the physical dimensions
  expect(pixels.width).toBe(2048);
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await waitForMapIdle(page);
  expect((await images(page))[0]).toEqual(imported);
  await page.reload();
  await expect(page.locator('.map-image img')).toBeVisible();
  expect((await images(page))[0]).toEqual(imported);
});

test('selects PDF pages without a modal, respects crop, rotation and UserUnit, and supports cancel', async ({
  page,
  blankProject,
}) => {
  await waitForMapIdle(page);
  await page.getByTestId('map-scale').click();
  await page.getByText('1:25,000', { exact: true }).click();
  await waitForMapIdle(page);
  const pages = [
    '/MediaBox [0 0 595.2 841.8]',
    '/MediaBox [0 0 360 720] /CropBox [36 72 324 648] /Rotate 90 /UserUnit 2',
  ];
  await uploadPdf(page, pages);
  const bar = page.getByTestId('pdf-import-bar');
  await expect(bar.getByRole('spinbutton')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await bar.getByRole('spinbutton').fill('3');
  await expect(page.getByTestId('import-pdf-page')).toBeDisabled();
  await bar.getByRole('spinbutton').fill('2');
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await waitForMapIdle(page);
  await page.getByTestId('import-pdf-page').click();
  await expect(page.locator('.map-image')).toBeVisible();
  await expect.poll(() => images(page)).toHaveLength(1);
  const imported = (await images(page))[0]!;
  expect(imported.name).toBe('paper.pdf — page 2');
  expect(groundSize(imported).width).toBeCloseTo(10_160, 4);
  expect(groundSize(imported).height).toBeCloseTo(5080, 4);
  await uploadPdf(page, pages);
  await expect(bar.getByRole('spinbutton')).toBeVisible();
  await bar.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(bar).toHaveCount(0);
  expect(await images(page)).toHaveLength(1);
  // A malformed document must leave the importer available for the next file.
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('import-image-btn').click();
  await (
    await chooser
  ).setFiles({
    name: 'invalid.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('not a pdf'),
  });
  await expect(page.getByText('Could not import this PDF.', { exact: false })).toBeVisible();
  await expect(bar).toHaveCount(0);
  await uploadPdf(page, [pages[0]!]);
  await expect(page.locator('.map-image')).toHaveCount(2);
});

async function selectImageProjection(page: Page, projection: 'mercator' | 'geodesic') {
  await page.getByTestId('save-menu-btn').click();
  await page.getByTestId('project-settings-btn').click();
  await page.getByTestId('project-projection-select').locator('.v-select__menu-icon').click();
  await page
    .getByRole('option', { name: projection === 'geodesic' ? /Geodesic/ : /Mercator/ })
    .click();
  await page.getByTestId('save-project-settings-btn').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function mapResolution(page: Page) {
  return page.evaluate(() => {
    const element = document.querySelector('#map') as HTMLElement & {
      __vueParentComponent: { provides: Record<symbol, MapContainer> };
    };
    const provides = element.__vueParentComponent.provides;
    const key = Object.getOwnPropertySymbols(provides).find(
      (symbol) => symbol.description === 'mapContainer'
    )!;
    return provides[key]!.map.value!.getView().getResolution()!;
  });
}

async function zoomOverImage(page: Page) {
  const resolution = await mapResolution(page);
  await page.locator('.map-image-selected').hover();
  await page.mouse.wheel(0, -120);
  await expect.poll(() => mapResolution(page)).toBeLessThan(resolution);
  await waitForMapIdle(page);
  await expect(page.locator('.map-image-selected')).toHaveCount(1);
}

for (const projection of ['mercator', 'geodesic'] as const) {
  for (const provider of [
    'Geoportail (IGN)',
    'OpenStreetMap',
    'Google - Plan',
    'Google - Satellite',
    'Google - Relief',
  ]) {
    test(`image and PDF editing, zoom and persistent history: ${provider}, ${projection}`, async ({
      page,
      blankProject,
    }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width: 1440, height: 1000 });
      if (projection === 'geodesic') await selectImageProjection(page, projection);
      await page.locator('.topbar-provider .v-select__menu-icon').click();
      await page.getByRole('option', { name: provider, exact: true }).click();
      await expect(page.locator('.topbar-provider')).toContainText(provider);
      await importImage(page);
      const original = (await images(page))[0]!;
      await zoomOverImage(page);
      expect((await images(page))[0]).toEqual(original);
      const resolution = await mapResolution(page);
      const rotation = page.getByRole('spinbutton', { name: 'Rotation', exact: true });
      await rotation.fill('23');
      await expect(page.locator('.map-image-selected')).toHaveCSS('transform', /matrix\(/);
      expect(await page.locator('.map-image-selected').getAttribute('style')).toContain(
        'rotate(23deg)'
      );
      await rotation.hover();
      await page.mouse.wheel(0, -120);
      await expect(rotation).toHaveValue('24');
      expect(await page.locator('.map-image-selected').getAttribute('style')).toContain(
        'rotate(24deg)'
      );
      expect(await mapResolution(page)).toBe(resolution);
      await rotation.press('Tab');
      await expect.poll(async () => (await images(page))[0]!.rotation).toBe(24);
      await page.getByTestId('undo-btn').click();
      await expect.poll(async () => (await images(page))[0]!.rotation).toBe(0);
      await page.getByTestId('redo-btn').click();
      await expect.poll(async () => (await images(page))[0]!.rotation).toBe(24);
      // The same physical PDF size must hold for every provider and calculation mode.
      await page.getByTestId('map-scale').click();
      await page.getByText('1:1,000,000', { exact: true }).click();
      await waitForMapIdle(page);
      await uploadPdf(page, ['/MediaBox [0 0 72 144]']);
      await expect.poll(() => images(page)).toHaveLength(2);
      const saved = await images(page);
      expect(groundSize(saved[1]!).width).toBeCloseTo(25_400, 4);
      expect(groundSize(saved[1]!).height).toBeCloseTo(50_800, 4);
      await page.reload();
      await expect(page.locator('.map-image')).toHaveCount(2);
      await expect(page.getByTestId('undo-btn')).toBeEnabled();
      await page.getByTestId('undo-btn').click();
      await expect.poll(() => images(page)).toHaveLength(1);
      await expect(page.locator('.map-image')).toHaveCount(1);
      await page.getByTestId('redo-btn').click();
      await expect.poll(() => images(page)).toEqual(saved);
      await expect(page.locator('.map-image img').last()).toBeVisible();
      await page.getByTestId('toggle-map-background').click();
      await expect(page.locator('#map')).toHaveClass(/map-background-hidden/);
      await expect(page.locator('.map-image img').last()).toBeVisible();
    });
  }
}

for (const ratio of [10, 0.00001]) {
  test(`image background supports image/PDF overlays, recalibration, zoom and history (${ratio} m/px)`, async ({
    page,
    cleanState,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page
      .getByTestId('project-name-input')
      .locator('input')
      .fill('Overlay on calibrated image');
    await page
      .locator('label')
      .filter({ has: page.locator('input[value="image"]') })
      .click();
    await page.getByTestId('create-project-btn').click();
    await page
      .getByRole('dialog')
      .locator('input[type="file"]')
      .setInputFiles('public/images/legende-ign.png');
    await page.getByRole('button', { name: 'Known ratio', exact: true }).click();
    await page
      .getByRole('spinbutton', { name: 'Metres per pixel', exact: true })
      .fill(String(ratio));
    await page.getByRole('button', { name: 'Create project', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByTestId('map-scale')).toHaveCount(0);
    await waitForMapIdle(page);
    await importImage(page);
    const raster = (await images(page))[0]!;
    await zoomOverImage(page);
    expect((await images(page))[0]).toEqual(raster);
    const importResolution = await mapResolution(page);
    await uploadPdf(page, ['/MediaBox [0 0 72 144]']);
    await expect.poll(() => images(page)).toHaveLength(2);
    const saved = await images(page);
    expect(saved[1]!.width).toBeCloseTo(96 * importResolution, 6);
    expect(saved[1]!.height).toBeCloseTo(192 * importResolution, 6);
    await page.getByRole('button', { name: 'Recalibrate', exact: true }).click();
    await expect(page.locator('[data-image-handle]')).toHaveCount(0);
    await page.getByRole('spinbutton', { name: 'Metres per pixel', exact: true }).fill('20');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await images(page)).toEqual(saved);
    await page.reload();
    await expect(page.locator('.map-image')).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Recalibrate', exact: true })).toBeVisible();
    await expect(page.getByTestId('map-scale')).toHaveCount(0);
    await page.getByTestId('undo-btn').click();
    await expect.poll(() => images(page)).toHaveLength(1);
    await page.getByTestId('redo-btn').click();
    await expect.poll(() => images(page)).toEqual(saved);
  });
}

test('zoom during dragging, cancellation and project switching preserve separate image histories', async ({
  page,
  blankProject,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await importImage(page);
  const original = (await images(page))[0]!;
  const box = (await page.locator('.map-image-selected').boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 20, y + 20, { steps: 4 });
  const resolution = await mapResolution(page);
  await page.mouse.wheel(0, 120);
  await expect.poll(() => mapResolution(page)).toBeGreaterThan(resolution);
  await waitForMapIdle(page);
  await page.mouse.move(x + 40, y + 30, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => (await images(page))[0]!.center).not.toEqual(original.center);
  const moved = (await images(page))[0]!;
  expect(moved.width).toBe(original.width);
  expect(moved.height).toBe(original.height);
  await page.getByTestId('undo-btn').click();
  await expect.poll(async () => (await images(page))[0]).toEqual(original);
  await page.getByTestId('redo-btn').click();
  await expect.poll(async () => (await images(page))[0]).toEqual(moved);
  // Escape cancels a live resize without creating an extra history step.
  const handle = (await page.locator('[data-image-handle="1,1"]').boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + 40, handle.y + 35, { steps: 4 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect((await images(page))[0]).toEqual(moved);
  await page.getByTestId('undo-btn').click();
  await expect.poll(async () => (await images(page))[0]).toEqual(original);
  await page.getByTestId('redo-btn').click();
  await expect.poll(async () => (await images(page))[0]).toEqual(moved);

  await page.getByTestId('save-menu-btn').click();
  await page.getByTestId('new-project-btn').click();
  await page.getByTestId('project-name-input').locator('input').fill('Independent image history');
  await page.getByTestId('create-project-btn').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.map-image')).toHaveCount(0);
  await uploadPdf(page, ['/MediaBox [0 0 144 72]']);
  await expect.poll(() => images(page)).toHaveLength(1);
  const secondProject = await page.evaluate(() => localStorage.getItem('geochase_activeProjectId'));
  const secondImage = (await images(page))[0]!;
  await page.getByTestId('save-menu-btn').click();
  await page.getByTestId('load-project-btn').click();
  await page.getByTestId(`load-project-${blankProject.id}`).click();
  await expect.poll(async () => (await images(page))[0]).toEqual(moved);
  await expect(page.locator('.map-image')).toHaveCount(1);
  await page.getByTestId('undo-btn').click();
  await expect.poll(async () => (await images(page))[0]).toEqual(original);
  // Switching away while choosing a PDF page must not import into the next project.
  await uploadPdf(page, ['/MediaBox [0 0 72 144]', '/MediaBox [0 0 144 72]']);
  await expect(page.getByTestId('pdf-import-bar').getByRole('spinbutton')).toBeVisible();
  await page.getByTestId('save-menu-btn').click();
  await page.getByTestId('load-project-btn').click();
  await page.getByTestId(`load-project-${secondProject}`).click();
  await expect(page.getByTestId('pdf-import-bar')).toHaveCount(0);
  await expect.poll(async () => (await images(page))[0]).toEqual(secondImage);
  await page.getByTestId('undo-btn').click();
  await expect.poll(() => images(page)).toHaveLength(0);
  await page.reload();
  await expect(page.getByTestId('redo-btn')).toBeEnabled();
  await page.getByTestId('redo-btn').click();
  await expect.poll(async () => (await images(page))[0]).toEqual(secondImage);
  await expect(page.locator('.map-image img')).toBeVisible();
});
