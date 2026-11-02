import type { MapContainer } from '../../../src/composables/useMap';
import type { useHistoryStore } from '../../../src/stores/history';
import type { useLayersStore } from '../../../src/stores/layers';
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';

type AppElement = HTMLElement & {
  __vue_app__: {
    config: {
      globalProperties: {
        $pinia: {
          _s: Map<string, ReturnType<typeof useHistoryStore> | ReturnType<typeof useLayersStore>>;
        };
      };
    };
  };
};

function pdfFile() {
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> >>',
  ].entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  // Valid PDF comments add a sizeable attachment without complicating rendering.
  pdf += ('%' + 'attachment'.repeat(100) + '\n').repeat(1024);
  const xref = Buffer.byteLength(pdf);
  pdf += 'xref\n0 4\n0000000000 65535 f \n';
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return { name: 'capacity.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf) };
}

async function storageSizes(page: Page) {
  return page.evaluate(async () => {
    async function records(name: string, store: string): Promise<unknown[]> {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onsuccess = () => {
          const db = request.result;
          const read = db.transaction(store).objectStore(store).getAll();
          read.onsuccess = () => {
            db.close();
            resolve(read.result);
          };
          read.addEventListener('error', () => {
            db.close();
            reject(read.error);
          });
        };
        request.addEventListener('error', () => reject(request.error));
      });
    }
    const metadata = await records('geochase_project_history', 'histories');
    const steps = await records('geochase_project_history', 'steps');
    const image = JSON.stringify(await records('geochase_image_maps', 'images'));
    const pdf = JSON.stringify(await records('geochase_pdf_storage', 'pdfs'));
    const encoded = JSON.stringify({ metadata, steps });
    return {
      steps: steps.length,
      historyBytes: new TextEncoder().encode(encoded).length,
      imageBytes: image.length,
      pdfBytes: pdf.length,
      includesAttachments:
        encoded.includes('data:image/') || encoded.includes('data:application/pdf'),
      includesGeometry: encoded.includes('coordinates') || encoded.includes('endpoint'),
    };
  });
}

test('1,000 edits on 1,000 drawings stay small with an imported image and PDF', async ({
  page,
  cleanState,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.getByTestId('project-name-input').locator('input').fill('Capacity');
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
  await page.getByRole('spinbutton', { name: 'Metres per pixel', exact: true }).fill('10');
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('pdf-btn').click();
  await (await chooser).setFiles(pdfFile());
  await expect(page.locator('.pdf-viewer canvas.block')).toBeVisible();
  await page.getByTestId('pdf-btn').click();

  // Generate volume through the real app stores; verify restoration through the UI/map.
  await page.evaluate(async () => {
    const app = (document.querySelector('#app') as AppElement).__vue_app__;
    const stores = app.config.globalProperties.$pinia._s;
    const layers = stores.get('layers') as ReturnType<typeof useLayersStore>;
    const history = stores.get('history') as ReturnType<typeof useHistoryStore>;
    layers.lineSegments = Array.from({ length: 1000 }, (_, i) => ({
      id: `line-${i}`,
      name: `Line ${i}`,
      mode: 'coordinate',
      center: { lat: 0, lon: i / 100_000 },
      endpoint: { lat: 0.01, lon: i / 100_000 },
    }));
    await history.flush();
  });
  await page.reload();
  await expect(page.getByTestId('undo-btn')).toBeEnabled({ timeout: 30_000 });
  const before = await storageSizes(page);
  // Keep the edited row in view while all 1,000 drawings remain loaded on the map.
  await page.getByPlaceholder('Filter by name...').fill('Revision');
  await page.evaluate(async () => {
    const app = (document.querySelector('#app') as AppElement).__vue_app__;
    const stores = app.config.globalProperties.$pinia._s;
    const layers = stores.get('layers') as ReturnType<typeof useLayersStore>;
    const history = stores.get('history') as ReturnType<typeof useHistoryStore>;
    for (let i = 1; i <= 1000; i++) {
      layers.updateLineSegment('line-0', { name: `Revision ${i}` });
      await history.flush();
    }
  });
  const after = await storageSizes(page);
  expect(after.steps).toBe(1000);
  expect(after.historyBytes).toBeLessThan(1024 * 1024);
  expect(after.imageBytes).toBe(before.imageBytes);
  expect(after.pdfBytes).toBe(before.pdfBytes);
  expect(after.includesAttachments).toBe(false);
  expect(after.includesGeometry).toBe(false);
  await testInfo.attach('history-capacity', {
    body: JSON.stringify(after),
    contentType: 'application/json',
  });

  await page.reload();
  // Same allowance as the first reload: 1,000 drawings take a while to restore under load.
  await expect(page.getByRole('button', { name: 'Recalibrate', exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId('undo-btn')).toHaveAttribute('title', /1000/);
  await expect(page.locator('[data-layer-id="line-0"] .layer-item-name')).toHaveText(
    'Revision 1000'
  );
  await page.getByTestId('undo-btn').click();
  await expect(page.locator('[data-layer-id="line-0"] .layer-item-name')).toHaveText(
    'Revision 999'
  );
  await page.reload();
  // Redo stays disabled until the 1,000 saved steps are read back, slower under load.
  await expect(page.getByTestId('redo-btn')).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId('redo-btn').click();
  await expect(page.locator('[data-layer-id="line-0"] .layer-item-name')).toHaveText(
    'Revision 1000'
  );
  const featureCount = await page.evaluate(() => {
    const element = document.querySelector('#map') as HTMLElement & {
      __vueParentComponent: { provides: Record<symbol, MapContainer> };
    };
    const provides = element.__vueParentComponent.provides;
    const key = Object.getOwnPropertySymbols(provides).find(
      (symbol) => symbol.description === 'mapContainer'
    )!;
    const features = provides[key]!.linesSource.value!.getFeatures();
    return features.filter((feature) => feature.get('type') === 'lineSegment').length;
  });
  expect(featureCount).toBe(1000);
  await page.getByTestId('pdf-btn').click();
  await expect(page.locator('.pdf-viewer canvas.block')).toBeVisible();
});

test('a browser quota error drops old undo steps and preserves saved drawings', async ({
  page,
  blankProject,
}) => {
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = new Proxy(original, {
      apply(target, store: IDBObjectStore, args: Parameters<typeof original>) {
        if (store.name === 'histories' && args[0].steps.length > 2)
          throw new DOMException('Simulated full browser storage', 'QuotaExceededError');
        return Reflect.apply(target, store, args);
      },
    });
  });
  for (const name of ['First', 'Second', 'Third']) {
    await page.getByTestId('draw-point-btn').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Point Name', { exact: true }).fill(name);
    await dialog.getByLabel('Coordinates', { exact: true }).fill('48.8, 2.3');
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(dialog).toBeHidden();
  }
  await expect(page.getByTestId('undo-btn')).toHaveAttribute('title', /\(1 /);
  await page.getByTestId('undo-btn').click();
  await expect(page.locator('.layer-item-name').getByText('Third', { exact: true })).toHaveCount(0);
  await expect(page.locator('.layer-item-name').getByText('Second', { exact: true })).toBeVisible();
  await expect(page.getByTestId('undo-btn')).toBeDisabled();
  await page.reload();
  // Redo stays disabled until the 1,000 saved steps are read back, slower under load.
  await expect(page.getByTestId('redo-btn')).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId('redo-btn').click();
  await expect(page.locator('.layer-item-name').getByText('Third', { exact: true })).toBeVisible();
});
