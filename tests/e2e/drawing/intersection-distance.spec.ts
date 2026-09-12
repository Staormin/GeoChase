import type { LineSegmentElement, ProjectData } from '../../../src/types/project';
import type { Page } from '@playwright/test';
import { getDistance } from 'ol/sphere.js';
import { expect, test } from '../fixtures';

const start = { lat: 43.208829, lon: 2.35458 };
const intersection = { lat: 46.69318, lon: -1.926687 };
const lineName = 'Intersection extension test';

test.beforeEach(async ({ page, blankProject }) => {
  await page.evaluate(
    ({ start, intersection }) => {
      const projects: ProjectData[] = JSON.parse(localStorage.getItem('geochase_projects')!);
      projects[0]!.data.points = [
        { id: 'start', name: 'Carcassonne', coordinates: start },
        { id: 'through', name: 'Saint-Gilles-Croix-de-Vie', coordinates: intersection },
      ];
      localStorage.setItem('geochase_projects', JSON.stringify(projects));
    },
    { start, intersection }
  );
  await page.reload();
});

async function openLineForm(page: Page, distance: string) {
  await page.getByRole('button', { name: 'Intersection', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill(lineName);
  await dialog.locator('.v-select').first().locator('.v-select__menu-icon').click();
  await page
    .getByRole('listbox', { name: 'Start Point', exact: true })
    .getByRole('option', { name: /^Carcassonne / })
    .click();
  await dialog.locator('.v-select').last().locator('.v-select__menu-icon').click();
  await page
    .getByRole('listbox', { name: 'Intersection Point', exact: true })
    .getByRole('option', { name: /^Saint-Gilles-Croix-de-Vie / })
    .click();
  await dialog
    .getByRole('spinbutton', { name: 'Distance beyond intersection (km)', exact: true })
    .fill(distance);
  return dialog;
}

async function savedLine(page: Page): Promise<LineSegmentElement | undefined> {
  return page.evaluate((name) => {
    const projects: ProjectData[] = JSON.parse(localStorage.getItem('geochase_projects')!);
    return projects[0]?.data.lineSegments.find((line) => line.name === name);
  }, lineName);
}

async function extensionDistance(page: Page) {
  const line = await savedLine(page);
  if (!line?.endpoint || !line.intersectionPoint) return undefined;
  return (
    getDistance(
      [line.intersectionPoint.lon, line.intersectionPoint.lat],
      [line.endpoint.lon, line.endpoint.lat]
    ) / 1000
  );
}

test('extends 500 km beyond the selected point and retains the extension when editing', async ({
  page,
}) => {
  let dialog = await openLineForm(page, '500');
  await dialog.getByRole('checkbox', { name: 'Create Endpoint', exact: true }).check();
  await dialog
    .getByRole('textbox', { name: 'Endpoint Name', exact: true })
    .fill('Extension endpoint');
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect.poll(() => extensionDistance(page)).toBeCloseTo(500, 4);
  const line = await savedLine(page);
  expect(line?.intersectionPoint).toEqual(intersection);
  await expect(
    page.locator('.layer-item-name').filter({ hasText: 'Extension endpoint' })
  ).toBeVisible();

  await page.reload();
  const row = page.locator('.layer-item').filter({ hasText: lineName });
  await row.locator('button').last().click();
  await page.getByText('Edit', { exact: true }).click();
  dialog = page.getByRole('dialog');
  const input = dialog.getByRole('spinbutton', {
    name: 'Distance beyond intersection (km)',
    exact: true,
  });
  await expect.poll(async () => Number(await input.inputValue())).toBeCloseTo(500, 4);
  await input.fill('2');
  await dialog.getByRole('button', { name: 'Update', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect.poll(() => extensionDistance(page)).toBeCloseTo(2, 4);
  expect((await savedLine(page))?.id).toBe(line?.id);
});

for (const distance of [0, 2]) {
  test(`accepts ${distance} km beyond a point more than 500 km from the start`, async ({
    page,
  }) => {
    const dialog = await openLineForm(page, String(distance));
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect.poll(() => extensionDistance(page)).toBeCloseTo(distance, 4);
  });
}

test('rejects a negative extension with a relevant message', async ({ page }) => {
  const dialog = await openLineForm(page, '-1');
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(
    page.getByText('Enter a distance of 0 km or more beyond the intersection point', {
      exact: true,
    })
  ).toBeVisible();
  await expect(dialog).toBeVisible();
  expect(await savedLine(page)).toBeUndefined();
});
