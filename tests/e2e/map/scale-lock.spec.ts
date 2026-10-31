import type { MapContainer } from '../../../src/composables/useMap';
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';

async function mapState(page: Page) {
  return page.evaluate(() => {
    const element = document.querySelector('#map') as HTMLElement & {
      __vueParentComponent: { provides: Record<symbol, MapContainer> };
    };
    const provides = element.__vueParentComponent.provides;
    const key = Object.getOwnPropertySymbols(provides).find(
      (symbol) => symbol.description === 'mapContainer'
    )!;
    const view = provides[key]!.map.value!.getView();
    const center = view.getCenter()!;
    const metersPerPixel = view.getProjection().getPointResolutionFunc()!(
      view.getResolution()!,
      center
    );
    return {
      center,
      scale: Math.round((metersPerPixel * 96) / 0.0254),
      idle: !view.getAnimating() && !view.getInteracting(),
    };
  });
}

test('locks the ground scale while panning and restores zoom when unlocked', async ({
  page,
  blankProject,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect.poll(async () => (await mapState(page)).idle).toBe(true);
  const scale = page.getByTestId('map-scale');
  const lock = page.getByTestId('map-scale-lock');
  await scale.click();
  await page.getByText('1:1,000,000', { exact: true }).click();
  await expect(scale).toHaveText('1:1,000,000');
  await expect.poll(async () => (await mapState(page)).idle).toBe(true);
  await lock.click();
  await expect(lock).toHaveAttribute('aria-pressed', 'true');
  await expect(lock).toHaveAccessibleName('Unlock scale');
  await expect(scale).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Zoom out', exact: true })).toBeDisabled();

  await page.mouse.move(900, 500);
  await page.mouse.wheel(0, -500);
  await page.waitForTimeout(400);
  expect((await mapState(page)).scale).toBe(1_000_000);
  await page.mouse.dblclick(900, 500);
  await page.waitForTimeout(400);
  expect((await mapState(page)).scale).toBe(1_000_000);
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, 500);
  await page.keyboard.up('Shift');
  await page.waitForTimeout(400);
  expect((await mapState(page)).scale).toBe(1_000_000);

  const beforePan = await mapState(page);
  await page.mouse.move(900, 500);
  await page.mouse.down();
  await page.mouse.move(1000, 750, { steps: 15 });
  await page.mouse.up();
  await expect.poll(async () => (await mapState(page)).center).not.toEqual(beforePan.center);
  await expect.poll(async () => (await mapState(page)).idle).toBe(true);
  await expect.poll(async () => (await mapState(page)).scale).toBe(1_000_000);
  await expect(scale).toHaveText('1:1,000,000');

  await lock.click();
  await expect(lock).toHaveAttribute('aria-pressed', 'false');
  await expect(scale).toBeEnabled();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect.poll(async () => (await mapState(page)).scale).toBe(500_000);
  await page.mouse.move(900, 500);
  await page.mouse.wheel(0, 500);
  await expect.poll(async () => (await mapState(page)).scale).toBeGreaterThan(500_000);
});
