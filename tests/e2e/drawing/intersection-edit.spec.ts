import type { MapContainer } from '../../../src/composables/useMap';
import type { ProjectData } from '../../../src/types/project';
import type { Page } from '@playwright/test';
import type { LineString, Point, Polygon } from 'ol/geom';
import { expect, test } from '../fixtures';
import {
  seedIntersectionProject as seed,
  seedReciprocalIntersectionProject,
} from '../helpers/intersection';

async function mapState(page: Page, lineId = 'editable') {
  return page.evaluate((lineId) => {
    const element = document.querySelector('#map') as HTMLElement & {
      __vueParentComponent?: { provides: Record<symbol, MapContainer> };
    };
    const provides = element?.__vueParentComponent?.provides;
    const key =
      provides &&
      Object.getOwnPropertySymbols(provides).find(
        (symbol) => symbol.description === 'mapContainer'
      );
    if (!key)
      return {
        endpoint: null,
        endpointPixel: null,
        throughPixel: null,
        targetPixel: null,
        point: null,
        zoom: null,
        cursor: element?.style.cursor,
      };
    const container = provides![key]!;
    const map = container.map.value!;
    const line = container.linesSource.value!.getFeatureById(lineId)?.getGeometry() as
      LineString | undefined;
    const through = container.pointsSource.value!.getFeatureById('through')?.getGeometry() as
      Point | undefined;
    const point = container.pointsSource.value!.getFeatureById('end')?.getGeometry() as
      Point | undefined;
    const target = container.linesSource.value!.getFeatureById('target')?.getGeometry() as
      LineString | undefined;
    const circle = container.circlesSource.value!.getFeatureById('target')?.getGeometry() as
      LineString | undefined;
    const polygon = container.polygonsSource.value!.getFeatureById('target')?.getGeometry() as
      Polygon | undefined;
    const ring = polygon?.getCoordinates()[0];
    const targetCoordinate =
      target?.getCoordinateAt(0.5) ??
      circle?.getCoordinates().reduce((north, point) => (point[1]! > north[1]! ? point : north)) ??
      (ring ? [(ring[0]![0]! + ring[1]![0]!) / 2, ring[0]![1]!] : null);
    return {
      endpoint: line?.getLastCoordinate() ?? null,
      endpointPixel: line ? map.getPixelFromCoordinate(line.getLastCoordinate()) : null,
      throughPixel: through ? map.getPixelFromCoordinate(through.getCoordinates()) : null,
      targetPixel: targetCoordinate ? map.getPixelFromCoordinate(targetCoordinate) : null,
      point: point?.getCoordinates() ?? null,
      zoom: map.getView().getZoom(),
      cursor: element.style.cursor,
    };
  }, lineId);
}

async function stored(page: Page): Promise<ProjectData['data']> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('geochase_projects')!)[0].data);
}

async function startEditing(page: Page, lineId = 'editable') {
  await expect.poll(async () => (await mapState(page, lineId)).endpointPixel).not.toBeNull();
  // Panel transitions can shift the map center; hover the current endpoint once they settle.
  await expect
    .poll(async () => {
      const pixel = (await mapState(page, lineId)).endpointPixel!;
      await page.mouse.move(pixel[0]! + 1, pixel[1]!);
      return (await mapState(page)).cursor;
    })
    .toBe('pointer');
  const pixel = (await mapState(page, lineId)).endpointPixel!;
  await page.mouse.click(pixel[0]!, pixel[1]!);
  await expect(page.getByTestId('intersection-edit-status')).toBeVisible();
  return pixel;
}

for (const projection of ['mercator', 'geodesic'] as const) {
  test(`${projection}: snaps a second line to the endpoint just snapped onto it`, async ({
    page,
    blankProject,
  }) => {
    await seedReciprocalIntersectionProject(page, projection);
    await startEditing(page);
    const target = (await mapState(page)).targetPixel!;
    const x = (await mapState(page)).endpointPixel![0]!;
    await page.mouse.move(x + 15, target[1]! + 3);
    await expect(page.getByTestId('intersection-snap-status')).toContainText('Snap target');
    await page.mouse.click(x + 15, target[1]! + 3);
    await expect(page.getByTestId('intersection-edit-status')).not.toBeVisible();
    const joined = (await mapState(page)).endpointPixel!;
    const before = await stored(page);

    await startEditing(page, 'target');
    await page.mouse.move(joined[0]! + 4, joined[1]! + 3);
    await expect(page.getByTestId('intersection-snap-status')).toHaveText(
      'Snapped to Editable intersection'
    );
    const preview = (await mapState(page, 'target')).endpointPixel!;
    expect(preview[0]).toBeCloseTo(joined[0]!, 1);
    expect(preview[1]).toBeCloseTo(joined[1]!, 1);
    expect((await stored(page)).lineSegments[1]!.endpoint).toEqual(
      before.lineSegments[1]!.endpoint
    );
    await page.mouse.click(joined[0]! + 4, joined[1]! + 3);
    await expect(page.getByTestId('intersection-edit-status')).not.toBeVisible();
    const saved = await stored(page);
    expect(saved.lineSegments[0]!.endpoint).toEqual(before.lineSegments[0]!.endpoint);
    expect(saved.lineSegments[1]!.intersectionPoint).toEqual({ lat: 48, lon: 1 });
    expect(saved.lineSegments[1]!.center).toEqual({ lat: 48, lon: 0 });
    await page.reload();
    await expect
      .poll(async () => (await mapState(page, 'target')).endpointPixel?.[0])
      .toBeCloseTo(joined[0]!, 1);
    await expect
      .poll(async () => (await mapState(page, 'target')).endpointPixel?.[1])
      .toBeCloseTo(joined[1]!, 1);
  });

  test(`${projection}: previews on the imposed path, snaps, saves and reloads the new endpoint`, async ({
    page,
    blankProject,
  }) => {
    await seed(page, projection);
    const before = await stored(page);
    await startEditing(page);
    const target = (await mapState(page)).targetPixel!;
    await page.mouse.move(target[0]! + 40, target[1]! + 3);
    await expect(page.getByTestId('intersection-snap-status')).toHaveText('Snapped to Snap target');
    const preview = await mapState(page);
    expect(preview.endpointPixel![0]).toBeCloseTo(target[0]!, 3);
    expect(preview.endpointPixel![1]).toBeCloseTo(target[1]!, 2);
    expect(preview.point![0]).toBeCloseTo(preview.endpoint![0]!, 5);
    expect(preview.point![1]).toBeCloseTo(preview.endpoint![1]!, 5);
    expect((await stored(page)).lineSegments[0]!.endpoint).toEqual(
      before.lineSegments[0]!.endpoint
    );
    await page.mouse.click(target[0]! + 40, target[1]! + 3);
    await expect(page.getByTestId('intersection-edit-status')).not.toBeVisible();
    await expect
      .poll(async () => (await stored(page)).lineSegments[0]!.intersectionExtension ?? 0)
      .toBeGreaterThan(200);
    const saved = await stored(page);
    const line = saved.lineSegments[0]!;
    expect(line.endpoint!.lon).toBeCloseTo(2, 6);
    expect(line.endpoint!.lat).toBeGreaterThan(47.999999);
    expect(line.center).toEqual(before.lineSegments[0]!.center);
    expect(line.intersectionPoint).toEqual(before.lineSegments[0]!.intersectionPoint);
    expect(line.color).toBe('#e53935');
    expect(saved.points.find((point) => point.id === 'end')!.coordinates).toEqual(line.endpoint);
    expect(saved.lineSegments[1]!.endpoint).toEqual(before.lineSegments[1]!.endpoint);
    await page.reload();
    await expect
      .poll(async () => (await mapState(page)).endpointPixel?.[1])
      .toBeCloseTo(target[1]!, 2);
  });
}

test('Escape and Cancel discard previews without saving', async ({ page, blankProject }) => {
  await seed(page);
  const original = await mapState(page);
  const saved = (await stored(page)).lineSegments[0]!.endpoint;
  for (const action of ['escape', 'cancel'] as const) {
    const pixel = await startEditing(page);
    await page.mouse.move(pixel[0]! + 60, pixel[1]! - 40);
    await expect.poll(async () => (await mapState(page)).endpoint).not.toEqual(original.endpoint);
    await (action === 'escape'
      ? page.keyboard.press('Escape')
      : page.getByTestId('cancel-intersection-edit').click());
    await expect(page.getByTestId('intersection-edit-status')).not.toBeVisible();
    expect((await mapState(page)).endpoint).toEqual(original.endpoint);
    expect((await mapState(page)).point).toEqual(original.point);
    expect((await stored(page)).lineSegments[0]!.endpoint).toEqual(saved);
  }
});

test('clamps behind the intersection to zero and can extend again without moving the imposed point', async ({
  page,
  blankProject,
}) => {
  await seed(page);
  await startEditing(page);
  const through = (await mapState(page)).throughPixel!;
  await page.mouse.move(through[0]!, through[1]! + 20);
  await expect(page.getByTestId('intersection-edit-status')).toContainText('0.000 km beyond');
  await page.mouse.click(through[0]!, through[1]! + 20);
  await expect
    .poll(async () => (await stored(page)).lineSegments[0]!.intersectionExtension)
    .toBe(0);
  await startEditing(page);
  await page.mouse.move(through[0]!, through[1]! - 30);
  await page.mouse.click(through[0]!, through[1]! - 30);
  await expect(page.getByTestId('intersection-edit-status')).not.toBeVisible();
  const saved = await stored(page);
  expect(saved.points.find((point) => point.id === 'through')!.coordinates).toEqual({
    lat: 46,
    lon: 2,
  });
  expect(saved.lineSegments[0]!.intersectionPoint).toEqual({ lat: 46, lon: 2 });
  expect(saved.lineSegments[0]!.intersectionExtension).toBeGreaterThan(0);
});

for (const mode of ['azimuth', 'intersection', 'parallel'] as const) {
  test(`snaps to ${mode} lines`, async ({ page, blankProject }) => {
    await seed(page, 'mercator', mode);
    await startEditing(page);
    const target = (await mapState(page)).targetPixel!;
    // Parallel features span the world; use the editable meridian's x coordinate.
    const x = (await mapState(page)).endpointPixel![0]!;
    await page.mouse.move(x + 5, target[1]! + 3);
    await expect(page.getByTestId('intersection-snap-status')).toContainText('Snap target');
    await page.mouse.click(x + 5, target[1]! + 3);
    await expect
      .poll(async () => (await stored(page)).lineSegments[0]!.endpoint!.lat)
      .toBeCloseTo(48, 5);
    expect((await stored(page)).lineSegments[1]!.endpoint).toEqual({ lat: 48, lon: 3 });
  });
}

test('explains hover, click, snapping and cancellation in the tutorial', async ({
  page,
  blankProject,
}) => {
  await page.getByRole('button', { name: 'Welcome to GeoChase', exact: true }).click();
  await page.getByRole('tab', { name: 'Drawing Tools', exact: true }).click();
  const tutorial = page.getByTestId('intersection-edit-tutorial');
  await expect(tutorial).toContainText('hand cursor');
  await expect(tutorial).toContainText('Click again');
  await expect(tutorial).toContainText('Escape');
  await expect(tutorial).toContainText('start and end points of lines take priority');
});

for (const shape of ['circle', 'polygon'] as const) {
  test(`snaps to ${shape} edges`, async ({ page, blankProject }) => {
    await seed(page, 'mercator', 'coordinate', shape);
    await startEditing(page);
    const target = (await mapState(page)).targetPixel!;
    await page.mouse.move(target[0]! + 5, target[1]! + 3);
    await expect(page.getByTestId('intersection-snap-status')).toContainText('Snap target');
    await page.mouse.click(target[0]! + 5, target[1]! + 3);
    await expect(page.getByTestId('intersection-edit-status')).not.toBeVisible();
    expect((await mapState(page)).endpointPixel![1]).toBeCloseTo(target[1]!, 2);
  });
}

test('ignores hidden snap targets', async ({ page, blankProject }) => {
  await seed(page);
  const target = (await mapState(page)).targetPixel!;
  await page.getByRole('button', { name: 'Open sidebar', exact: true }).click();
  await page.locator('.layer-item').filter({ hasText: 'Snap target' }).getByRole('button').click();
  await page.getByText('Hide', { exact: true }).click();
  await expect.poll(async () => (await mapState(page)).targetPixel).toBeNull();
  await page.getByRole('button', { name: 'Close sidebar', exact: true }).click();
  await expect
    .poll(async () => {
      const box = await page.getByTestId('layers-sidebar').boundingBox();
      return box ? box.x + box.width : 0;
    })
    .toBeLessThanOrEqual(1);
  await expect
    .poll(async () => (await mapState(page)).endpointPixel?.[0])
    .toBeCloseTo(target[0]!, 1);
  await startEditing(page);
  await page.mouse.move(target[0]!, target[1]! + 3);
  await expect(page.getByTestId('intersection-snap-status')).not.toBeVisible();
  expect((await mapState(page)).endpointPixel![1]).toBeCloseTo(target[1]! + 3, 2);
});

test('cancels when opening a modal or activating the ruler, leaving the ruler usable', async ({
  page,
  blankProject,
}) => {
  await seed(page);
  const original = (await mapState(page)).endpoint;
  let pixel = await startEditing(page);
  await page.mouse.move(pixel[0]!, pixel[1]! - 30);
  await page.getByTestId('draw-point-btn').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByTestId('intersection-edit-status')).not.toBeVisible();
  expect((await mapState(page)).endpoint).toEqual(original);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  pixel = await startEditing(page);
  await page.mouse.move(pixel[0]!, pixel[1]! - 30);
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.getByRole('button', { name: 'Ruler', exact: true }).click();
  await expect(page.getByTestId('intersection-edit-status')).not.toBeVisible();
  expect((await mapState(page)).endpoint).toEqual(original);
  await page.mouse.click(pixel[0]!, pixel[1]!);
  await page.mouse.move(pixel[0]! + 60, pixel[1]! + 30);
  await page.mouse.click(pixel[0]! + 60, pixel[1]! + 30);
  await expect(page.locator('.ruler-measurement')).toHaveCount(1);
  await expect(page.getByTestId('intersection-edit-status')).not.toBeVisible();
});
