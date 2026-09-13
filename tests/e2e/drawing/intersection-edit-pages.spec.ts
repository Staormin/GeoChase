import type { ProjectData } from '../../../src/types/project';
import { fromLonLat } from 'ol/proj.js';
import { expect, test } from '../fixtures';
import {
  seedIntersectionProject,
  seedReciprocalIntersectionProject,
} from '../helpers/intersection';

// Exercise production using map pixels and the public UI, without Vue's development internals.
for (const projection of ['mercator', 'geodesic'] as const) {
  test(`${projection}: joins a second line to the endpoint just snapped onto it`, async ({
    page,
    blankProject,
  }) => {
    const endB = await seedReciprocalIntersectionProject(page, projection);
    const box = (await page.locator('#map').boundingBox())!;
    const resolution = 40_075_016.68557849 / (256 * 2 ** 6);
    const center = fromLonLat([2, 47]);
    const pixel = (coordinate: { lat: number; lon: number }) => {
      const projected = fromLonLat([coordinate.lon, coordinate.lat]);
      return [
        box.x + box.width / 2 + (projected[0]! - center[0]!) / resolution,
        box.y + box.height / 2 - (projected[1]! - center[1]!) / resolution,
      ];
    };
    const [x, y] = pixel({ lat: 47, lon: 2 });
    const nearCrossing = pixel({ lat: 48, lon: 2 });
    await page.mouse.click(x!, y!);
    await expect(page.getByTestId('intersection-edit-status')).toBeVisible();
    await page.mouse.move(nearCrossing[0]!, nearCrossing[1]! + 3);
    await expect(page.getByTestId('intersection-snap-status')).toContainText('Snap target');
    await page.mouse.click(nearCrossing[0]!, nearCrossing[1]! + 3);
    await expect(page.getByTestId('intersection-edit-status')).not.toBeVisible();
    const endA = await page.evaluate(() => {
      const project: ProjectData = JSON.parse(localStorage.getItem('geochase_projects')!)[0];
      return project.data.lineSegments[0]!.endpoint!;
    });
    const endPixelB = pixel(endB);
    const joined = pixel(endA);
    await page.mouse.click(endPixelB[0]!, endPixelB[1]!);
    await expect(page.getByTestId('intersection-edit-status')).toBeVisible();
    await page.mouse.move(joined[0]! + 4, joined[1]! + 3);
    await expect(page.getByTestId('intersection-snap-status')).toHaveText(
      'Snapped to Editable intersection'
    );
    await page.mouse.click(joined[0]! + 4, joined[1]! + 3);
    await expect(page.getByTestId('intersection-edit-status')).not.toBeVisible();
    const finalEndpoint = await page.evaluate(() => {
      const project: ProjectData = JSON.parse(localStorage.getItem('geochase_projects')!)[0];
      return project.data.lineSegments[1]!.endpoint!;
    });
    expect(pixel(finalEndpoint)[0]).toBeCloseTo(joined[0]!, 1);
    expect(pixel(finalEndpoint)[1]).toBeCloseTo(joined[1]!, 1);
  });

  test(`${projection}: edits and persists an endpoint on the deployed app`, async ({
    page,
    blankProject,
  }) => {
    await seedIntersectionProject(page, projection, 'parallel');
    const box = (await page.locator('#map').boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const resolution = 40_075_016.68557849 / (256 * 2 ** 6);
    const targetY = y - (fromLonLat([2, 48])[1]! - fromLonLat([2, 47])[1]!) / resolution;
    const map = page.locator('#map');
    await page.mouse.move(x + 8, y);
    await expect(map).toHaveCSS('cursor', 'pointer');
    await page.mouse.click(x + 8, y);
    await expect(page.getByTestId('intersection-edit-status')).toBeVisible();
    await page.mouse.move(x + 40, targetY + 3);
    await expect(page.getByTestId('intersection-snap-status')).toHaveText('Snapped to Snap target');
    await page.mouse.click(x + 40, targetY + 3);
    await expect(page.getByTestId('intersection-edit-status')).not.toBeVisible();
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const project: ProjectData = JSON.parse(localStorage.getItem('geochase_projects')!)[0];
          return project.data.lineSegments[0]!.endpoint?.lat;
        })
      )
      .toBeCloseTo(48, 5);
    await page.reload();
    await expect(map).toBeVisible();
    await page.mouse.move(x, targetY);
    await expect(map).toHaveCSS('cursor', 'pointer');
    await page.mouse.click(x, targetY);
    await expect(page.getByTestId('intersection-edit-status')).toContainText(
      'km beyond the intersection'
    );
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('intersection-edit-status')).not.toBeVisible();
  });
}
