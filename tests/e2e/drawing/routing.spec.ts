import type { MapContainer } from '../../../src/composables/useMap';
import type { Page } from '@playwright/test';
import type { LineString } from 'ol/geom';
import type { Style } from 'ol/style';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const live = process.env.GEOCHASE_LIVE_ROUTING === '1';
const geometry = {
  type: 'LineString',
  coordinates: [
    [2.337306, 48.849319],
    [2.35, 48.851],
    [2.367776, 48.852891],
  ],
};

async function mapRoute(page: Page) {
  return page.evaluate(() => {
    const element = document.querySelector('#map') as HTMLElement & {
      __vueParentComponent?: { provides: Record<symbol, MapContainer> };
    };
    const provides = element.__vueParentComponent!.provides;
    const key = Object.getOwnPropertySymbols(provides).find(
      (symbol) => symbol.description === 'mapContainer'
    )!;
    const map = provides[key]!;
    const feature = map.routesSource.value!.getFeatures()[0];
    const geometry = feature?.getGeometry() as LineString | undefined;
    const center = map.map.value!.getView().getCenter()!;
    const nearest = geometry?.getClosestPoint(center);
    return {
      count: map.routesSource.value!.getFeatures().length,
      coordinates: geometry?.getCoordinates(),
      center,
      distanceToRoute: nearest
        ? Math.hypot(center[0]! - nearest[0]!, center[1]! - nearest[1]!)
        : null,
      color: (feature?.getStyle() as Style | undefined)?.getStroke()?.getColor(),
      animating: map.map.value!.getView().getAnimating(),
    };
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('routing-init')) return;
    sessionStorage.setItem('routing-init', '1');
    localStorage.setItem('gpxCircle_language', 'en');
    localStorage.setItem('geochase_activeProjectId', 'routing-test');
    localStorage.setItem(
      'geochase_projects',
      JSON.stringify([
        {
          id: 'routing-test',
          name: 'Routing test',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          data: {
            circles: [],
            lineSegments: [],
            polygons: [],
            notes: [],
            points: [
              { id: 'a', name: 'Departure Paris', coordinates: { lat: 48.849319, lon: 2.337306 } },
              { id: 'b', name: 'Arrival Paris', coordinates: { lat: 48.852891, lon: 2.367776 } },
              { id: 'c', name: 'Notre-Dame', coordinates: { lat: 48.853, lon: 2.3499 } },
              { id: 'd', name: 'Hotel de Ville', coordinates: { lat: 48.855, lon: 2.358 } },
            ],
          },
        },
      ])
    );
  });
  await page.goto('/GeoChase/');
  await expect(page.locator('#map')).toBeVisible();
});

async function choose(page: Page) {
  await page.getByTestId('draw-route-btn').click();
  await page.getByRole('combobox', { name: 'Departure', exact: true }).press('Enter');
  await page
    .getByRole('listbox', { name: 'Departure', exact: true })
    .getByRole('option', { name: 'Departure Paris', exact: true })
    .click();
  await page.getByRole('combobox', { name: 'Arrival', exact: true }).press('Enter');
  await page
    .getByRole('listbox', { name: 'Arrival', exact: true })
    .getByRole('option', { name: 'Arrival Paris', exact: true })
    .click();
  await page.getByRole('textbox', { name: 'Route name' }).fill('Paris walking route');
}

test('route calculation, persistence, visibility, editing and GPX export', async ({ page }) => {
  test.setTimeout(60_000);
  if (!live)
    await page.route('https://data.geopf.fr/navigation/itineraire?**', (route) =>
      route.fulfill({
        json: { geometry, distance: 2504.9, duration: 2510 },
      })
    );
  await choose(page);
  const responsePromise = page.waitForResponse((r) => r.url().includes('/navigation/itineraire?'));
  await page.getByRole('button', { name: 'Calculate and save', exact: true }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  expect(new URL(response.url()).searchParams.get('start')).toBe('2.337306,48.849319');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const row = page.locator('[data-layer-type="route"]').filter({ hasText: 'Paris walking route' });
  await expect(row).toBeVisible();
  await expect(row).toContainText('2.50 km');
  await expect
    .poll(async () =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('geochase_projects')!)[0].data.routes.length
      )
    )
    .toBe(1);
  await page.reload();
  await expect(row).toBeVisible();
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('geochase_projects')!)[0].data.routes[0]
  );
  expect(saved.profile).toBe('pedestrian');
  expect(saved.coordinates.length).toBeGreaterThan(2);
  await expect(page.locator('[data-layer-type="lineSegment"]')).toHaveCount(0);
  expect((await mapRoute(page)).coordinates?.length).toBe(saved.coordinates.length);
  await row.getByRole('button').click();
  await page.getByText('Hide', { exact: true }).click();
  await expect(row).toHaveClass(/layer-item-hidden/);
  expect((await mapRoute(page)).count).toBe(0);
  await page.keyboard.press('Escape');
  await row.getByRole('button').click();
  await page.getByText('Show', { exact: true }).click();
  await expect(row).not.toHaveClass(/layer-item-hidden/);
  expect((await mapRoute(page)).count).toBe(1);
  await page.keyboard.press('Escape');
  await row.getByRole('button').click();
  await page.getByText('Edit', { exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Route name' })).toHaveValue(
    'Paris walking route'
  );
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await row.getByRole('button').click();
  await page.getByText('Drawing color', { exact: true }).click();
  await page.getByRole('button', { name: '#6366F1', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(async () => (await mapRoute(page)).color).toBe('#6366F1');
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('geochase_projects')!)[0].data.routes[0].color
      )
    )
    .toBe('#6366F1');
  await page.reload();
  await expect(row).toBeVisible();
  expect((await mapRoute(page)).color).toBe('#6366F1');
  await row.getByRole('button').click();
  await page.getByText('Navigate', { exact: true }).click();
  await expect(page.locator('.navigation-bar')).toBeVisible();
  await expect.poll(async () => (await mapRoute(page)).animating).toBe(false);
  const origin = (await mapRoute(page)).center;
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await mapRoute(page)).animating).toBe(false);
  const forward = await mapRoute(page);
  expect(
    Math.hypot(forward.center[0]! - origin[0]!, forward.center[1]! - origin[1]!)
  ).toBeGreaterThan(10);
  expect(forward.distanceToRoute).toBeLessThan(0.1);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await mapRoute(page)).animating).toBe(false);
  const backward = await mapRoute(page);
  expect(backward.distanceToRoute).toBeLessThan(0.1);
  expect(
    Math.hypot(backward.center[0]! - origin[0]!, backward.center[1]! - origin[1]!)
  ).toBeLessThan(2);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open sidebar', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Project GPX', exact: true }).click();
  const download = await downloadPromise;
  const rendered = await readFile((await download.path())!, 'utf8');
  expect((rendered.match(/<trkpt /g) ?? []).length).toBe(saved.coordinates.length);
  await page.screenshot({ path: '/tmp/geochase-routing-local.png' });
});

test('service failure keeps the form and creates no route', async ({ page }) => {
  await page.route('https://data.geopf.fr/navigation/itineraire?**', (route) =>
    route.fulfill({ status: 429, body: '{}' })
  );
  await choose(page);
  await page.getByRole('button', { name: 'Calculate and save', exact: true }).click();
  await expect(page.locator('.v-alert[role=alert]')).toContainText('IGN service is busy');
  await expect(page.getByRole('textbox', { name: 'Route name' })).toHaveValue(
    'Paris walking route'
  );
  await expect(page.locator('[data-layer-type="route"]')).toHaveCount(0);
});

test('driving fastest route uses the selected options', async ({ page }) => {
  if (!live)
    await page.route('https://data.geopf.fr/navigation/itineraire?**', (route) =>
      route.fulfill({ json: { geometry, distance: 3200, duration: 600 } })
    );
  await choose(page);
  await page.getByRole('combobox', { name: 'Travel mode', exact: true }).press('Enter');
  await page
    .getByRole('listbox', { name: 'Travel mode', exact: true })
    .getByRole('option', { name: 'Driving', exact: true })
    .click();
  await page.getByRole('combobox', { name: 'Route preference', exact: true }).press('Enter');
  await page
    .getByRole('listbox', { name: 'Route preference', exact: true })
    .getByRole('option', { name: 'Fastest', exact: true })
    .click();
  const responsePromise = page.waitForResponse((r) => r.url().includes('/navigation/itineraire?'));
  await page.getByRole('button', { name: 'Calculate and save', exact: true }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  expect(new URL(response.url()).searchParams.get('profile')).toBe('car');
  expect(new URL(response.url()).searchParams.get('optimization')).toBe('fastest');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('[data-layer-type="route"]')).toHaveCount(1);
});

test('cancelling a pending calculation does not save a late route', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('https://data.geopf.fr/navigation/itineraire?**', async (route) => {
    await gate;
    await route.fulfill({ json: { geometry, distance: 2504.9, duration: 2510 } });
  });
  await choose(page);
  const request = page.waitForRequest((r) => r.url().includes('/navigation/itineraire?'));
  await page.getByRole('button', { name: 'Calculate and save', exact: true }).click();
  await request;
  await expect(page.getByRole('button', { name: 'Calculating…', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  release();
  await page.unrouteAll({ behavior: 'wait' });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('[data-layer-type="route"]')).toHaveCount(0);
});

test('route notes, nearby search along detours and deletion', async ({ page }) => {
  const detour = {
    type: 'LineString',
    coordinates: [
      [2.337306, 48.849319],
      [2.337306, 48.879],
      [2.367776, 48.879],
      [2.367776, 48.852891],
    ],
  };
  await page.route('https://data.geopf.fr/navigation/itineraire?**', (route) =>
    route.fulfill({ json: { geometry: detour, distance: 8000, duration: 8000 } })
  );
  await page.route('https://overpass-api.de/api/interpreter', (route) =>
    route.fulfill({
      contentType: 'text/xml',
      body: '<osm><node id="1" lat="48.879" lon="2.35"><tag k="name" v="Village on the detour"/><tag k="place" v="village"/></node><node id="2" lat="48.851" lon="2.352"><tag k="name" v="Village on the chord"/><tag k="place" v="village"/></node></osm>',
    })
  );
  await page.route('**/altimetrie/**', (route) =>
    route.fulfill({
      json: {
        elevations: [
          { lat: 48.879, lon: 2.35, z: 30 },
          { lat: 48.851, lon: 2.352, z: 30 },
        ],
      },
    })
  );
  await choose(page);
  await page.getByRole('button', { name: 'Calculate and save', exact: true }).click();
  const row = page.locator('[data-layer-type="route"]');
  await expect(row).toBeVisible();
  await row.getByRole('button').click();
  await page.getByText('Add Note', { exact: true }).click();
  await page.getByTestId('note-title-input').locator('input').fill('Route clue');
  await page.getByTestId('note-content-input').locator('textarea').fill('Explore the bend');
  await page.getByTestId('submit-note-btn').click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('geochase_projects')!)[0].data.notes[0]?.linkedElementType
      )
    )
    .toBe('route');
  await page.reload();
  await expect(row).toBeVisible();
  await row.getByRole('button').click();
  await page.getByText('Location Near', { exact: true }).click();
  await expect(page.getByText('Village on the detour', { exact: true })).toBeVisible();
  await expect(page.getByText('Village on the chord', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: '/tmp/geochase-route-search.png' });
  await page.reload();
  await expect(row).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await row.getByRole('button').click();
  await page.getByText('Delete', { exact: true }).click();
  await expect(row).toHaveCount(0);
  expect((await mapRoute(page)).count).toBe(0);
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('geochase_projects')!)[0].data.notes.length
      )
    )
    .toBe(0);
  await page.reload();
  await expect(row).toHaveCount(0);
});

test('intermediate stops can be reordered, saved, edited and removed', async ({ page }) => {
  test.setTimeout(60_000);
  if (!live)
    await page.route('https://data.geopf.fr/navigation/itineraire?**', (route) =>
      route.fulfill({
        json: { geometry, distance: 3018.9, duration: 3024, portions: [{}, {}, {}] },
      })
    );
  await choose(page);
  const calculate = page.getByRole('button', { name: 'Calculate and save', exact: true });
  await page.getByRole('button', { name: 'Add stop', exact: true }).click();
  await expect(calculate).toBeDisabled();
  await page.getByRole('combobox', { name: 'Stop 1', exact: true }).press('Enter');
  await page
    .getByRole('listbox', { name: 'Stop 1', exact: true })
    .getByRole('option', { name: 'Hotel de Ville', exact: true })
    .click();
  await page.getByRole('button', { name: 'Add stop', exact: true }).click();
  await page.getByRole('combobox', { name: 'Stop 2', exact: true }).press('Enter');
  await page
    .getByRole('listbox', { name: 'Stop 2', exact: true })
    .getByRole('option', { name: 'Notre-Dame', exact: true })
    .click();
  await page.getByRole('button', { name: 'Move stop 2 up', exact: true }).click();
  await expect(page.getByTestId('route-step').first()).toContainText('Notre-Dame');
  await expect(page.getByTestId('route-step').last()).toContainText('Hotel de Ville');
  await expect(page.getByRole('button', { name: 'Move stop 1 up', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Move stop 2 down', exact: true })).toBeDisabled();
  const responsePromise = page.waitForResponse((r) => r.url().includes('/navigation/itineraire?'));
  await calculate.click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  expect(new URL(response.url()).searchParams.get('intermediates')).toBe(
    '2.3499,48.853|2.358,48.855'
  );
  expect((await response.json()).portions).toHaveLength(3);
  const row = page.locator('[data-layer-type="route"]');
  await expect(row).toBeVisible();
  const stops = () =>
    page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('geochase_projects')!)[0].data.routes?.[0]?.intermediates
    );
  await expect.poll(stops).toEqual([
    { lat: 48.853, lon: 2.3499 },
    { lat: 48.855, lon: 2.358 },
  ]);
  await page.reload();
  await row.getByRole('button').click();
  await page.getByText('Edit', { exact: true }).click();
  await expect(page.getByTestId('route-step')).toHaveCount(2);
  await expect(page.getByTestId('route-step').first()).toContainText('Notre-Dame');
  await page.getByRole('button', { name: 'Move stop 1 down', exact: true }).click();
  await expect(page.getByTestId('route-step').first()).toContainText('Hotel de Ville');
  await page.getByRole('button', { name: 'Remove stop 2', exact: true }).click();
  await expect(page.getByTestId('route-step')).toHaveCount(1);
  await page.getByRole('button', { name: 'Remove stop 1', exact: true }).click();
  const recalculation = page.waitForResponse((r) => r.url().includes('/navigation/itineraire?'));
  await calculate.click();
  const direct = await recalculation;
  expect(direct.ok()).toBeTruthy();
  expect(new URL(direct.url()).searchParams.has('intermediates')).toBe(false);
  await expect.poll(stops).toEqual([]);
  await expect(row).toHaveCount(1);
});
