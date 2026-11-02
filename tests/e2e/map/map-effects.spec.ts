import type { MapContainer } from '../../../src/composables/useMap';
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';

async function viewState(page: Page) {
  return page.evaluate(() => {
    const element = document.querySelector('#map') as HTMLElement & {
      __vueParentComponent: { provides: Record<symbol, MapContainer> };
    };
    const provides = element.__vueParentComponent.provides;
    const key = Object.getOwnPropertySymbols(provides).find(
      (symbol) => symbol.description === 'mapContainer'
    )!;
    const view = provides[key]!.map.value!.getView();
    return { zoom: view.getZoom(), center: view.getCenter(), animating: view.getAnimating() };
  });
}

test('hidden sequence ignores inputs, accepts mixed case, and exposes controls only while active', async ({
  page,
  blankProject,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await expect(page.getByTestId('game-tank')).toHaveCount(0);
  await expect(page.getByTestId('game-controls')).toHaveCount(0);
  const input = page.locator('.layers-search input');
  await input.pressSequentially('billb');
  await expect(page.getByTestId('game-tank')).toHaveCount(0);
  await input.fill('');
  await input.blur();
  await expect.poll(async () => (await viewState(page)).animating).toBe(false);
  const before = await viewState(page);
  await page.keyboard.type('BiLlB');
  const tank = page.getByTestId('game-tank');
  await expect(tank).toBeVisible();
  await expect(page.getByTestId('game-controls')).toContainText('Space');
  expect((await viewState(page)).zoom).toBe(before.zoom);
  const box = (await tank.boundingBox())!;
  const sidebar = (await page.getByTestId('layers-sidebar').boundingBox())!;
  expect(box.x).toBeGreaterThan(sidebar.x + sidebar.width);
  for (const [key, axis, sign] of [
    ['ArrowRight', 'x', 1],
    ['ArrowDown', 'y', 1],
    ['ArrowLeft', 'x', -1],
    ['ArrowUp', 'y', -1],
    ['d', 'x', 1],
    ['s', 'y', 1],
    ['q', 'x', -1],
    ['z', 'y', -1],
    ['a', 'x', -1],
    ['w', 'y', -1],
  ] as const) {
    const position = (await tank.boundingBox())!;
    await page.keyboard.down(key);
    await page.waitForTimeout(140);
    await page.keyboard.up(key);
    const moved = (await tank.boundingBox())!;
    expect((moved[axis] - position[axis]) * sign).toBeGreaterThan(10);
  }
  await page.keyboard.press('Escape');
  await expect(tank).toHaveCount(0);
  await expect(page.getByTestId('game-controls')).toHaveCount(0);
  await page.keyboard.type('BILLB');
  await expect(tank).toBeVisible();
  await page.getByRole('button', { name: 'Exit game', exact: true }).click();
  await expect(tank).toHaveCount(0);
});

for (const type of ['point', 'lineSegment', 'circle', 'polygon', 'route']) {
  test(`a shot temporarily hides a ${type} without changing the saved project`, async ({
    page,
    blankProject,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.addInitScript((type) => {
      if (sessionStorage.getItem('game-target-seeded')) return;
      sessionStorage.setItem('game-target-seeded', '1');
      const projects = JSON.parse(localStorage.getItem('geochase_projects')!);
      const project = projects[0];
      project.viewData = {
        topPanelOpen: true,
        sidePanelOpen: false,
        mapView: { lat: 48, lon: 2, zoom: 10 },
      };
      project.data = {
        points: [],
        circles: [],
        lineSegments: [],
        polygons: [],
        routes: [],
        notes: [],
      };
      const base = { id: 'target', name: 'Target', createdAt: 1_700_000_000_000 };
      if (type === 'point')
        project.data.points.push({ ...base, coordinates: { lat: 48.12, lon: 2 } });
      if (type === 'lineSegment')
        project.data.lineSegments.push({
          ...base,
          mode: 'coordinate',
          pointsOnLine: [],
          center: { lat: 48.12, lon: 1.9 },
          endpoint: { lat: 48.12, lon: 2.1 },
        });
      if (type === 'circle')
        project.data.circles.push({ ...base, center: { lat: 48.12, lon: 2 }, radius: 3 });
      if (type === 'route')
        project.data.routes.push({
          ...base,
          coordinates: [
            [1.9, 48.12],
            [2.1, 48.12],
          ],
          distance: 15_000,
          duration: 500,
          profile: 'car',
          optimization: 'fastest',
          start: { lat: 48.12, lon: 1.9 },
          end: { lat: 48.12, lon: 2.1 },
        });
      if (type === 'polygon') {
        project.data.points = [
          [1.9, 48.1],
          [2.1, 48.1],
          [2.1, 48.2],
          [1.9, 48.2],
        ].map(([lon, lat], index) => ({
          id: `vertex-${index}`,
          name: `Vertex ${index}`,
          polygonIds: ['target'],
          createdAt: 1_700_000_000_000,
          coordinates: { lat, lon },
        }));
        project.data.polygons.push({
          ...base,
          pointIds: project.data.points.map((point: { id: string }) => point.id),
        });
      }
      localStorage.setItem('geochase_projects', JSON.stringify(projects));
    }, type);
    await page.reload();
    await expect(page.locator('[data-layer-id="target"]')).toBeAttached();
    await page.keyboard.type('billb');
    await expect(page.getByTestId('game-tank')).toBeVisible();
    const targetExists = () =>
      page.evaluate((type) => {
        const element = document.querySelector('#map') as HTMLElement & {
          __vueParentComponent: { provides: Record<symbol, MapContainer> };
        };
        const provides = element.__vueParentComponent.provides;
        const key = Object.getOwnPropertySymbols(provides).find(
          (symbol) => symbol.description === 'mapContainer'
        )!;
        const container = provides[key]!;
        const source = {
          point: container.pointsSource,
          lineSegment: container.linesSource,
          circle: container.circlesSource,
          polygon: container.polygonsSource,
          route: container.routesSource,
        }[type];
        return !!source?.value?.getFeatureById('target');
      }, type);
    await expect.poll(targetExists).toBe(true);
    const savedData = await page.evaluate(
      () => JSON.parse(localStorage.getItem('geochase_projects')!)[0].data
    );
    await page.keyboard.press('Space');
    await expect.poll(targetExists).toBe(false);
    await expect(page.locator('[data-layer-id="target"]')).toBeAttached();
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem('geochase_projects')!)[0].data)
    ).toEqual(savedData);
    await page.keyboard.press('Escape');
    await expect.poll(targetExists).toBe(true);
    await page.reload();
    await expect(page.locator('[data-layer-id="target"]')).toBeAttached();
    await expect.poll(targetExists).toBe(true);
    await expect(page.getByTestId('game-tank')).toHaveCount(0);
  });
}

test('the camera follows the tank without changing zoom and input focus stops movement', async ({
  page,
  blankProject,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.keyboard.type('billb');
  await expect(page.getByTestId('game-tank')).toBeVisible();
  const initial = await viewState(page);
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await viewState(page)).center).not.toEqual(initial.center);
  await page.keyboard.up('ArrowRight');
  const moved = await viewState(page);
  expect(moved.center).not.toEqual(initial.center);
  expect(moved.zoom).toBe(initial.zoom);
  await expect(page.getByTestId('game-tank')).toBeInViewport();
  await page.keyboard.down('ArrowLeft');
  await page.locator('.layers-search input').focus();
  const stopped = await page.getByTestId('game-tank').boundingBox();
  await page.waitForTimeout(200);
  expect(await page.getByTestId('game-tank').boundingBox()).toEqual(stopped);
  await page.keyboard.up('ArrowLeft');
});

for (const [up, left] of [
  ['ArrowUp', 'ArrowLeft'],
  ['z', 'q'],
  ['w', 'a'],
]) {
  test(`shoots diagonally up-left with ${up}/${left}`, async ({ page, blankProject }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.keyboard.type('billb');
    const tank = page.getByTestId('game-tank');
    await expect(tank).toBeVisible();
    await page.keyboard.down(up!);
    await page.keyboard.down(left!);
    await expect(tank).toHaveAttribute('style', /rotate\(-45deg\)/);
    await page.keyboard.press('Space');
    const box = (await tank.boundingBox())!;
    const findShot = () =>
      page.locator('.game-effects').evaluate((canvas: HTMLCanvasElement) => {
        const { data, width } = canvas
          .getContext('2d')!
          .getImageData(0, 0, canvas.width, canvas.height);
        let x = 0,
          y = 0,
          count = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i]! > 240 && data[i + 1]! > 200 && data[i + 2]! > 100 && data[i + 3]! > 0) {
            x += (i / 4) % width;
            y += Math.floor(i / 4 / width);
            count++;
          }
        }
        return { x: x / count / devicePixelRatio, y: y / count / devicePixelRatio, count };
      });
    // Under load the shell's frames come later than any fixed delay: wait until it is
    // visible and has travelled up-left from the tank.
    await expect
      .poll(async () => {
        const shot = await findShot();
        return (
          shot.count > 0 &&
          shot.x < box.x + box.width / 2 - 15 &&
          shot.y < box.y + box.height / 2 - 15
        );
      })
      .toBe(true);
    await page.keyboard.up(up!);
    await page.keyboard.up(left!);
  });
}

test('shells land at limited range and craters follow the map until exit', async ({
  page,
  blankProject,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => {
    const projects = JSON.parse(localStorage.getItem('geochase_projects')!);
    projects[0].viewData = {
      topPanelOpen: true,
      sidePanelOpen: false,
      mapView: { lat: 48, lon: 2, zoom: 10 },
    };
    localStorage.setItem('geochase_projects', JSON.stringify(projects));
  });
  await page.reload();
  await expect(page.locator('#map')).toBeVisible();
  await page.keyboard.type('billb');
  const tank = page.getByTestId('game-tank');
  await expect(tank).toBeVisible();
  const box = (await tank.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2 - 389;
  const pixel = (x: number, y: number) =>
    page.locator('.game-effects').evaluate(
      (canvas: HTMLCanvasElement, position) => {
        const rect = canvas.getBoundingClientRect();
        const context = canvas.getContext('2d')!;
        const image = context.getImageData(
          Math.round((position.x - rect.left) * devicePixelRatio),
          Math.round((position.y - rect.top) * devicePixelRatio),
          1,
          1
        );
        return [...image.data];
      },
      { x, y }
    );
  await page.keyboard.press('Space');
  await expect.poll(() => pixel(x, y)).toEqual([17, 20, 24, 255]);
  await page.waitForTimeout(500);
  expect(await pixel(x, y - 45)).toEqual([0, 0, 0, 0]);
  await page.screenshot({ path: '/tmp/geochase-game-crater.png' });
  await page.evaluate(() => {
    const element = document.querySelector('#map') as HTMLElement & {
      __vueParentComponent: { provides: Record<symbol, MapContainer> };
    };
    const provides = element.__vueParentComponent.provides;
    const key = Object.getOwnPropertySymbols(provides).find(
      (symbol) => symbol.description === 'mapContainer'
    )!;
    const map = provides[key]!.map.value!;
    const view = map.getView();
    view.adjustCenter([40 * view.getResolution()!, 0]);
    map.renderSync();
  });
  await expect.poll(() => pixel(x - 40, y)).toEqual([17, 20, 24, 255]);
  expect(await pixel(x, y)).toEqual([0, 0, 0, 0]);
  await page.keyboard.press('Escape');
  await expect(page.locator('.game-effects')).toBeHidden();
  await page.keyboard.type('billb');
  await expect(page.locator('.game-effects')).toBeVisible();
  expect(await pixel(x - 40, y)).toEqual([0, 0, 0, 0]);
});
