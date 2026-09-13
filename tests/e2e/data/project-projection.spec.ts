import type { ProjectData, ProjectProjection } from '../../../src/types/project';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { expect, test } from '../fixtures';

const data: ProjectData['data'] = {
  circles: [],
  polygons: [],
  notes: [],
  points: [
    { id: 'west', name: 'West', coordinates: { lat: 60, lon: -60 } },
    { id: 'east', name: 'East', coordinates: { lat: 60, lon: 60 } },
  ],
  lineSegments: [
    {
      id: 'route',
      name: 'Long route',
      mode: 'coordinate',
      center: { lat: 60, lon: -60 },
      endpoint: { lat: 60, lon: 60 },
    },
  ],
};

async function selectProjection(page: Page, projection: ProjectProjection) {
  await page.getByTestId('project-projection-select').locator('.v-select__menu-icon').click();
  await page
    .getByRole('option', { name: projection === 'geodesic' ? /Geodesic/ : /Mercator/ })
    .click();
}

async function openSettings(page: Page) {
  await page.getByTestId('save-menu-btn').click();
  await page.getByTestId('project-settings-btn').click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

async function savedProject(page: Page): Promise<ProjectData> {
  return page.evaluate(() => {
    const projects: ProjectData[] = JSON.parse(localStorage.getItem('geochase_projects')!);
    return projects.find(
      (project) => project.id === localStorage.getItem('geochase_activeProjectId')
    )!;
  });
}

async function importProject(page: Page, project: unknown) {
  await page.getByTestId('save-menu-btn').click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('import-json-btn').click();
  await (
    await chooser
  ).setFiles({
    name: 'project.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
}

test('chooses the projection at creation and retains it through project switching', async ({
  page,
  cleanState,
}) => {
  await page.getByTestId('project-name-input').locator('input').fill('Curved project');
  await selectProjection(page, 'geodesic');
  await page.getByTestId('create-project-btn').click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect((await savedProject(page)).projection).toBe('geodesic');
  const curvedId = (await savedProject(page)).id;
  await page.getByTestId('save-menu-btn').click();
  await page.getByTestId('new-project-btn').click();
  await expect(page.getByTestId('project-projection-select')).toContainText('Mercator');
  await page.getByTestId('project-name-input').locator('input').fill('Straight project');
  await page.getByTestId('create-project-btn').click();
  await expect.poll(async () => (await savedProject(page)).projection).toBe('mercator');
  await page.getByTestId('save-menu-btn').click();
  await page.getByTestId('load-project-btn').click();
  await page.getByTestId(`load-project-${curvedId}`).click();
  await page.reload();
  await openSettings(page);
  await expect(page.getByTestId('project-projection-select')).toContainText('Geodesic');
});

test('changes the whole project, exports the setting and follows the arc in GPX', async ({
  page,
  blankProject,
}) => {
  await importProject(page, { name: 'Legacy', data });
  await expect.poll(async () => (await savedProject(page)).data.lineSegments.length).toBe(1);
  await openSettings(page);
  await selectProjection(page, 'geodesic');
  await page.getByTestId('save-project-settings-btn').click();
  await expect.poll(async () => (await savedProject(page)).projection).toBe('geodesic');
  await page.reload();
  await openSettings(page);
  await expect(page.getByTestId('project-projection-select')).toContainText('Geodesic');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  await page.getByTestId('save-menu-btn').click();
  const jsonDownload = page.waitForEvent('download');
  await page.getByTestId('export-json-btn').click();
  const exported: ProjectData = JSON.parse(
    await readFile((await (await jsonDownload).path())!, 'utf8')
  );
  expect(exported.projection).toBe('geodesic');
  expect(exported.data.lineSegments[0]?.id).toBe('route');
  expect(exported.data.points.map((point) => point.coordinates)).toEqual(
    data.points.map((point) => point.coordinates)
  );

  const gpxDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export Project GPX/i }).click();
  const gpx = await readFile((await (await gpxDownload).path())!, 'utf8');
  const latitudes = [...gpx.matchAll(/trkpt lat="([\d.-]+)"/g)].map((match) => Number(match[1]));
  expect(Math.max(...latitudes)).toBeGreaterThan(73);

  await importProject(page, data);
  await expect.poll(async () => (await savedProject(page)).projection).toBe('mercator');
  await importProject(page, exported);
  await expect.poll(async () => (await savedProject(page)).projection).toBe('geodesic');
});

test('rejects unsupported imported projections without replacing the project', async ({
  page,
  blankProject,
}) => {
  await importProject(page, { data, projection: 'geodesic' });
  await expect.poll(async () => (await savedProject(page)).projection).toBe('geodesic');
  await expect
    .poll(async () => (await savedProject(page)).data.lineSegments[0]?.startPointId)
    .toBe('west');
  const before = await savedProject(page);
  await importProject(page, { data: { ...data, points: [] }, projection: 'unsupported' });
  await expect(page.getByText('Import error', { exact: true })).toBeVisible();
  expect((await savedProject(page)).data).toEqual(before.data);
  expect((await savedProject(page)).projection).toBe('geodesic');
});

test('explains the project-wide setting in the tutorial', async ({ page, blankProject }) => {
  await page.getByRole('button', { name: 'Welcome to GeoChase', exact: true }).click();
  await page.getByRole('tab', { name: 'Projects', exact: true }).click();
  await expect(page.getByTestId('projection-tutorial')).toContainText('Project Settings');
  await expect(page.getByTestId('projection-tutorial')).toContainText('JSON');
});
