import type { MapContainer } from '../../../src/composables/useMap';
import type { ProjectData } from '../../../src/types/project';
import type { Page } from '@playwright/test';
import type { LineString } from 'ol/geom';
import { expect, test } from '../fixtures';

async function renderedCoordinates(page: Page): Promise<number[][][]> {
  return page.evaluate(() => {
    const element = document.querySelector('#map') as HTMLElement & {
      __vueParentComponent?: { provides: Record<symbol, MapContainer> };
    };
    const provides = element?.__vueParentComponent?.provides;
    if (!provides) return [];
    const key = Object.getOwnPropertySymbols(provides).find(
      (symbol) => symbol.description === 'mapContainer'
    );
    if (!key) return [];
    return provides[key]!.linesSource.value!.getFeatures()
      .filter((feature) => feature.get('type') === 'lineSegment')
      .map((feature) => (feature.getGeometry() as LineString).getCoordinates());
  });
}

test('renders existing and new lines using the active project, including after switching', async ({
  page,
  blankProject,
}) => {
  await page.evaluate(() => {
    const projects: ProjectData[] = JSON.parse(localStorage.getItem('geochase_projects')!);
    const project = projects[0]!;
    project.projection = 'geodesic';
    project.data.points = [
      { id: 'west', name: 'West', coordinates: { lat: 60, lon: -60 } },
      { id: 'east', name: 'East', coordinates: { lat: 60, lon: 60 } },
    ];
    project.data.lineSegments = [
      {
        id: 'route',
        name: 'Existing route',
        mode: 'coordinate',
        center: { lat: 60, lon: -60 },
        endpoint: { lat: 60, lon: 60 },
      },
    ];
    projects.push({ ...project, id: 'flat', name: 'Flat project', projection: 'mercator' });
    localStorage.setItem('geochase_projects', JSON.stringify(projects));
  });
  await page.reload();
  await expect
    .poll(async () => (await renderedCoordinates(page))[0]?.length ?? 0)
    .toBeGreaterThan(100);
  const coordinates = (await renderedCoordinates(page))[0]!;
  expect(Math.max(...coordinates.map((point) => point[1]!))).toBeGreaterThan(
    coordinates[0]![1]! + 1_000_000
  );

  await page.getByTestId('draw-line-btn').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Line Name', exact: true }).fill('New route');
  await dialog.locator('.v-select').first().locator('.v-select__menu-icon').click();
  await page.getByRole('option', { name: /^West / }).click();
  await dialog.locator('.v-select').last().locator('.v-select__menu-icon').click();
  await page.getByRole('option', { name: /^East / }).click();
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  await expect.poll(async () => (await renderedCoordinates(page)).length).toBe(2);
  expect((await renderedCoordinates(page)).every((path) => path.length > 100)).toBe(true);

  await page.getByTestId('save-menu-btn').click();
  await page.getByTestId('load-project-btn').click();
  await page.getByTestId('load-project-flat').click();
  await expect
    .poll(async () => (await renderedCoordinates(page)).map((path) => path.length))
    .toEqual([2]);
  await page.getByTestId('save-menu-btn').click();
  await page.getByTestId('project-settings-btn').click();
  await page.getByTestId('project-projection-select').locator('.v-select__menu-icon').click();
  await page.getByRole('option', { name: /Geodesic/ }).click();
  await page.getByTestId('save-project-settings-btn').click();
  await expect
    .poll(async () => (await renderedCoordinates(page))[0]?.length ?? 0)
    .toBeGreaterThan(100);
});
