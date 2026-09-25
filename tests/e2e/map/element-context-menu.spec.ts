import type { MapContainer } from '../../../src/composables/useMap';
import type { Point } from 'ol/geom';
import { expect, test } from '../fixtures';

test('hover and left click open the point menu and its edit action', async ({
  page,
  blankProject,
}) => {
  await page.locator('[data-layer-id="point-1"] .layer-item-info').click();
  await page.waitForTimeout(800);
  const pixel = await page.evaluate(() => {
    const element = document.querySelector('#map') as HTMLElement & {
      __vueParentComponent: { provides: Record<symbol, MapContainer> };
    };
    const provides = element.__vueParentComponent.provides;
    const key = Object.getOwnPropertySymbols(provides).find(
      (symbol) => symbol.description === 'mapContainer'
    )!;
    const container = provides[key]!;
    const feature = container.pointsSource.value!.getFeatureById('point-1')!;
    const geometry = feature.getGeometry() as Point;
    const pixel = container.map.value!.getPixelFromCoordinate(geometry.getCoordinates());
    const rect = element.getBoundingClientRect();
    return { x: rect.left + pixel[0]!, y: rect.top + pixel[1]! };
  });
  await page.mouse.move(pixel.x, pixel.y);
  await expect(page.locator('#map')).toHaveCSS('cursor', 'pointer');
  await page.mouse.move(pixel.x + 60, pixel.y + 60);
  await expect(page.locator('#map')).not.toHaveCSS('cursor', 'pointer');
  await page.mouse.click(pixel.x, pixel.y);
  const menu = page.locator('.v-menu .v-list:visible');
  await expect(menu).toBeVisible();
  await menu.getByText('Edit', { exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').locator('input').first()).toHaveValue('Paris');
});
