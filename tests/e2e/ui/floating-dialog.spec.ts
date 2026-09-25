import { expect, test } from '../fixtures';

test('drawing windows can move while the map remains interactive', async ({
  page,
  blankProject,
}) => {
  void blankProject;
  await page.locator('button .mdi-minus').locator('..').click();
  const dialog = page.locator('.floating-dialog .v-overlay__content');
  await expect(dialog).toBeVisible();
  const title = dialog.locator('.v-card-title').first();
  const before = (await dialog.boundingBox())!;
  const handle = (await title.boundingBox())!;
  await page.mouse.move(handle.x + 50, handle.y + 20);
  await page.mouse.down();
  await page.mouse.move(handle.x + 230, handle.y + 110, { steps: 12 });
  await page.mouse.up();
  const after = (await dialog.boundingBox())!;
  expect(after.x - before.x).toBeCloseTo(180, 0);
  expect(after.y - before.y).toBeCloseTo(90, 0);
  await expect(page.locator('.v-overlay__scrim')).toHaveCount(0);
  await page.locator('#map').click({ position: { x: 900, y: 150 } });
  await expect(dialog).toBeVisible();
  await dialog.locator('input').first().fill('Floating parallel');
  await page.setViewportSize({ width: 600, height: 600 });
  await expect
    .poll(async () => {
      const box = (await dialog.boundingBox())!;
      return box.x >= 0 && box.y >= 0 && box.x + box.width <= 601 && box.y + box.height <= 601;
    })
    .toBe(true);
  await dialog.getByRole('button', { name: /cancel/i }).click();
  await expect(dialog).not.toBeVisible();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.locator('button .mdi-minus').locator('..').click();
  await expect(dialog).toBeVisible();
  await dialog.locator('input').first().press('Escape');
  await expect(dialog).not.toBeVisible();
});
