import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';

async function importJSON(page: Page, data: unknown) {
  await page.getByTestId('save-menu-btn').click();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByTestId('import-json-btn').click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'project.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(data)),
  });
}

async function mapPointIds(page: Page): Promise<string[]> {
  // Inspect actual OpenLayers features to catch sidebar/map divergence.
  return page.evaluate(() => {
    const component = (document.querySelector('#map') as any)?.__vueParentComponent;
    if (!component) return [];
    const key = Object.getOwnPropertySymbols(component.provides).find(
      (symbol) => symbol.description === 'mapContainer'
    );
    if (!key) throw new Error('Map provider was not initialized');
    return component.provides[key].pointsSource.value
      .getFeatures()
      .map((feature: any) => feature.getId());
  });
}

test('JSON import replaces both saved layers and rendered map features', async ({
  page,
  blankProject,
}) => {
  await expect.poll(() => mapPointIds(page)).toHaveLength(blankProject.data.points.length);
  await importJSON(page, {
    points: [{ id: 'imported', name: 'Imported location', coordinates: { lat: 48.9, lon: 2.4 } }],
  });
  await expect(page.getByText('Imported location', { exact: true }).first()).toBeVisible();
  await expect.poll(() => mapPointIds(page)).toEqual(['imported']);
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem('geochase_projects')!)[0].data.points.map(
          (point: { id: string }) => point.id
        )
      )
    )
    .toEqual(['imported']);
  await page.reload();
  await expect.poll(() => mapPointIds(page)).toEqual(['imported']);
});

for (const { name, data } of [
  { name: 'an empty object', data: {} },
  {
    name: 'malformed line point references',
    data: {
      points: [{ id: 'replacement', name: 'Replacement', coordinates: { lat: 49, lon: 3 } }],
      lineSegments: [
        {
          id: 'line',
          name: 'Route',
          mode: 'coordinate',
          center: { lat: 49, lon: 3 },
          endpoint: { lat: 50, lon: 4 },
          pointsOnLine: 42,
        },
      ],
    },
  },
  {
    name: 'malformed point polygon references',
    data: {
      points: [
        {
          id: 'replacement',
          name: 'Replacement',
          coordinates: { lat: 49, lon: 3 },
          polygonIds: 42,
        },
      ],
      polygons: [{ id: 'polygon', name: 'Area', pointIds: ['replacement', 'other', 'third'] }],
    },
  },
]) {
  test(`rejects ${name} without replacing saved or rendered drawings`, async ({
    page,
    blankProject,
  }) => {
    const ids = blankProject.data.points.map((point) => point.id);
    await expect.poll(() => mapPointIds(page)).toEqual(ids);
    const original = await page.evaluate(
      () => JSON.parse(localStorage.getItem('geochase_projects')!)[0].data
    );
    await importJSON(page, data);
    await expect(page.getByText('Import error', { exact: true })).toBeVisible();
    // Let autosave run so a partial replacement cannot hide behind the old map features.
    await page.waitForTimeout(650);
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem('geochase_projects')!)[0].data)
    ).toEqual(original);
    await expect.poll(() => mapPointIds(page)).toEqual(ids);
    await page.reload();
    await expect.poll(() => mapPointIds(page)).toEqual(ids);
    expect(await page.evaluate(() => localStorage.getItem('geochase_activeProjectId'))).toBe(
      blankProject.id
    );
  });
}
