import type {
  LineSegmentElement,
  ProjectData,
  ProjectProjection,
} from '../../../src/types/project';
import type { Page } from '@playwright/test';
import { fromLonLat } from 'ol/proj.js';
import { getDistance } from 'ol/sphere.js';
import { geodesicInverse } from '../../../src/services/geodesy';
import { expect, test } from '../fixtures';
import { reloadWithProjects, seedIntersectionProject } from '../helpers/intersection';

type EndpointCase = 'start-a' | 'end-a' | 'start-b' | 'end-b' | 'shared';
const pointName = 'intersection of line Meridian and West–East';

async function seed(
  page: Page,
  projection: ProjectProjection = 'mercator',
  endpointCase?: EndpointCase,
  targetMode: LineSegmentElement['mode'] = 'coordinate'
) {
  await seedIntersectionProject(page, projection);
  const projects = await page.evaluate(
    ({ endpointCase, targetMode }) => {
      const projects: ProjectData[] = JSON.parse(localStorage.getItem('geochase_projects')!);
      const data = projects[0]!.data;
      const first = data.lineSegments[0]!;
      const second = data.lineSegments[1]!;
      first.name = 'Meridian';
      second.name = 'West–East';
      second.mode = targetMode;
      first.endpoint = { lat: 49, lon: 2 };
      if (endpointCase === 'start-a') {
        first.center = { lat: 48, lon: 2 };
        first.intersectionPoint = { lat: 48.5, lon: 2 };
      }
      if (endpointCase === 'end-a' || endpointCase === 'shared') first.endpoint.lat = 48;
      if (endpointCase === 'start-b') second.center.lon = 2;
      if (endpointCase === 'end-b' || endpointCase === 'shared') second.endpoint!.lon = 2;
      data.points[0]!.coordinates = first.center;
      data.points[1]!.coordinates = first.intersectionPoint!;
      data.points[2]!.coordinates = first.endpoint;
      return projects;
    },
    { endpointCase, targetMode }
  );
  await reloadWithProjects(page, projects);
  return mapPixel(page, 48, 2);
}

async function mapPixel(page: Page, lat: number, lon: number) {
  const box = (await page.locator('#map').boundingBox())!;
  const center = fromLonLat([2, 47]);
  const point = fromLonLat([lon, lat]);
  const resolution = 40_075_016.68557849 / (256 * 2 ** 6);
  return [
    box.x + box.width / 2 + (point[0]! - center[0]!) / resolution,
    box.y + box.height / 2 - (point[1]! - center[1]!) / resolution,
  ];
}

async function hoverCrossing(page: Page, x: number, y: number) {
  // Map restoration may finish after the first canvas is displayed.
  await expect
    .poll(async () => {
      await page.mouse.move(x, y);
      return page.locator('#map').evaluate((element) => getComputedStyle(element).cursor);
    })
    .toMatch(/url\(.*\) 12 30, crosshair/);
}

async function savedPoints(page: Page) {
  return page.evaluate(() => {
    const project: ProjectData = JSON.parse(localStorage.getItem('geochase_projects')!)[0];
    return project.data.points.map(({ id, name, coordinates }) => ({ id, name, coordinates }));
  });
}

for (const projection of ['mercator', 'geodesic'] as const) {
  test(`${projection}: creates a named point at the crossing, not the mouse position`, async ({
    page,
    blankProject,
  }) => {
    const [x, y] = await seed(page, projection);
    let geocodingRequests = 0;
    await page.route('**/geocodage/reverse?*', (route) => {
      geocodingRequests++;
      return route.fulfill({ json: { features: [] } });
    });
    const before = await savedPoints(page);
    await hoverCrossing(page, x! + 4, y! + 3);
    expect(
      await page.evaluate(async () => {
        const cursor = getComputedStyle(document.querySelector('#map')!).cursor;
        const url = cursor.match(/url\("(.*?)"\)/)?.[1];
        if (!url) return false;
        return new Promise<boolean>((resolve) => {
          const icon = new Image();
          icon.addEventListener(
            'load',
            () => resolve(icon.naturalWidth === 32 && icon.naturalHeight === 32),
            { once: true }
          );
          icon.addEventListener('error', () => resolve(false), { once: true });
          icon.src = url;
        });
      })
    ).toBe(true);
    await page.mouse.click(x! + 4, y! + 3);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: 'Point Name', exact: true })).toHaveValue(
      pointName
    );
    const coordinates = (
      await dialog.getByRole('textbox', { name: 'Coordinates', exact: true }).inputValue()
    )
      .split(',')
      .map(Number);
    expect(coordinates[1]).toBeCloseTo(2, 6);
    if (projection === 'mercator') expect(coordinates[0]).toBeCloseTo(48, 6);
    else {
      expect(coordinates[0]).toBeGreaterThan(48.001);
      expect(coordinates[0]).toBeLessThan(48.01);
    }
    expect(await savedPoints(page)).toEqual(before);
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect
      .poll(
        async () => (await savedPoints(page)).find((point) => point.name === pointName)?.coordinates
      )
      .toEqual({ lat: coordinates[0], lon: coordinates[1] });
    expect(geocodingRequests).toBe(0);
    await page.reload();
    expect(
      (await savedPoints(page)).find((point) => point.name === pointName)?.coordinates
    ).toEqual({ lat: coordinates[0], lon: coordinates[1] });
  });

  test(`${projection}: creates an angled line from a crossing using either reference`, async ({
    page,
    blankProject,
  }) => {
    const [x, y] = await seed(page, projection);
    await hoverCrossing(page, x!, y!);
    await page.mouse.click(x!, y!);
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect.poll(async () => (await savedPoints(page)).length).toBe(4);
    const crossing = (await savedPoints(page)).find((point) => point.name === pointName)!;
    await page.reload();

    await page.getByRole('button', { name: 'Line at Angle', exact: true }).click();
    await dialog.locator('.v-select').first().locator('.v-select__menu-icon').click();
    const pointOptions = page.getByRole('listbox', { name: 'Start Point', exact: true });
    await expect(pointOptions.getByRole('option')).toHaveCount(4);
    await pointOptions.getByRole('option', { name: pointName, exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Add', exact: true })).toBeDisabled();
    await dialog.locator('.v-select').last().locator('.v-select__menu-icon').click();
    const lineOptions = page.getByRole('listbox', { name: 'Reference Line', exact: true });
    await expect(lineOptions.getByRole('option')).toHaveCount(2);
    await expect(lineOptions.getByRole('option', { name: 'Meridian', exact: true })).toBeVisible();
    await lineOptions.getByRole('option', { name: 'West–East', exact: true }).click();
    await dialog
      .getByRole('textbox', { name: 'Line Name', exact: true })
      .fill('Angled at crossing');
    await dialog.getByRole('spinbutton', { name: 'Angle', exact: true }).fill('90');
    await dialog.getByRole('spinbutton', { name: 'Distance (km)', exact: true }).fill('25');
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const savedLine = () =>
      page.evaluate(() => {
        const project: ProjectData = JSON.parse(localStorage.getItem('geochase_projects')!)[0];
        return project.data.lineSegments.find((line) => line.name === 'Angled at crossing');
      });
    await expect
      .poll(async () => (await savedLine())?.angleFrom)
      .toEqual({ lineId: 'target', degrees: 90 });
    const line = (await savedLine())!;
    expect(line.center).toEqual(crossing.coordinates);
    expect(line.azimuth).toBeGreaterThan(179);
    expect(line.azimuth).toBeLessThan(181);
    const lengthKm =
      projection === 'geodesic'
        ? geodesicInverse(line.center, line.endpoint!).distance / 1000
        : getDistance(
            [line.center.lon, line.center.lat],
            [line.endpoint!.lon, line.endpoint!.lat]
          ) / 1000;
    expect(lengthKm).toBeCloseTo(25, 3);
    await page.reload();
    expect((await savedLine())?.angleFrom).toEqual({ lineId: 'target', degrees: 90 });

    // Creating another line at this point must not hide either original reference.
    await page.getByRole('button', { name: 'Line at Angle', exact: true }).click();
    await dialog.locator('.v-select').first().locator('.v-select__menu-icon').click();
    await pointOptions.getByRole('option', { name: pointName, exact: true }).click();
    await dialog.locator('.v-select').last().locator('.v-select__menu-icon').click();
    await expect(lineOptions.getByRole('option')).toHaveCount(3);
    await expect(lineOptions.getByRole('option', { name: 'Meridian', exact: true })).toBeVisible();
    await expect(lineOptions.getByRole('option', { name: 'West–East', exact: true })).toBeVisible();
  });
}

test('allows editing the generated name and cancelling without creating a point', async ({
  page,
  blankProject,
}) => {
  const [x, y] = await seed(page);
  const before = await savedPoints(page);
  await page.mouse.click(x!, y!);
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Point Name', exact: true }).fill('My crossing');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(await savedPoints(page)).toEqual(before);
  await page.mouse.click(x!, y!);
  await expect(dialog.getByRole('textbox', { name: 'Point Name', exact: true })).toHaveValue(
    pointName
  );
  await dialog.getByRole('textbox', { name: 'Point Name', exact: true }).fill('My crossing');
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  await expect
    .poll(async () => (await savedPoints(page)).some((point) => point.name === 'My crossing'))
    .toBe(true);
});

for (const mode of ['azimuth', 'intersection', 'parallel'] as const) {
  test(`supports crossings with ${mode} lines`, async ({ page, blankProject }) => {
    const [x, y] = await seed(page, 'mercator', undefined, mode);
    await hoverCrossing(page, x!, y!);
    await page.mouse.click(x!, y!);
    await expect(
      page.getByRole('dialog').getByRole('textbox', { name: 'Point Name', exact: true })
    ).toHaveValue(pointName);
  });
}

for (const endpointCase of ['start-a', 'end-a', 'start-b', 'end-b', 'shared'] as const) {
  test(`does not offer crossing creation at a line endpoint: ${endpointCase}`, async ({
    page,
    blankProject,
  }) => {
    const [x, y] = await seed(page, 'mercator', endpointCase);
    await page.mouse.move(x!, y!);
    await expect(page.locator('#map')).not.toHaveCSS('cursor', /url\(/);
    await page.mouse.click(x!, y!);
    await expect(page.getByRole('dialog')).not.toBeVisible();
    if (endpointCase === 'end-a' || endpointCase === 'shared') {
      await expect(page.getByTestId('intersection-edit-status')).toBeVisible();
      await page.keyboard.press('Escape');
    }
  });
}

test('does not interfere with the ruler or use hidden lines', async ({ page, blankProject }) => {
  const [x, y] = await seed(page);
  await hoverCrossing(page, x!, y!);
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.getByRole('button', { name: 'Ruler', exact: true }).click();
  await page.mouse.click(x!, y!);
  await page.mouse.click(x! + 50, y! + 30);
  await expect(page.locator('.ruler-measurement')).toHaveCount(1);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open sidebar', exact: true }).click();
  await page.locator('.layer-item').filter({ hasText: 'West–East' }).getByRole('button').click();
  await page.getByText('Hide', { exact: true }).click();
  await page.getByRole('button', { name: 'Close sidebar', exact: true }).click();
  await expect
    .poll(async () => {
      const box = await page.getByTestId('layers-sidebar').boundingBox();
      return box ? box.x + box.width : 0;
    })
    .toBeLessThanOrEqual(1);
  await page.mouse.move(x!, y!);
  await expect(page.locator('#map')).not.toHaveCSS('cursor', /url\(/);
  await page.mouse.click(x!, y!);
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('explains crossing creation and endpoint exclusions in the tutorial', async ({
  page,
  blankProject,
}) => {
  await page.getByRole('button', { name: 'Welcome to GeoChase', exact: true }).click();
  await page.getByRole('tab', { name: 'Drawing Tools', exact: true }).click();
  await expect(page.getByTestId('crossing-point-tutorial')).toContainText('Left-click');
  await expect(page.getByTestId('crossing-point-tutorial')).toContainText(
    'either line are excluded'
  );
});
