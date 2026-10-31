import { expect, test } from '../fixtures';

test('drawing windows can move while the map remains interactive', async ({
  page,
  blankProject,
}) => {
  void blankProject;
  await page.getByTestId('advanced-tools-btn').click();
  await page.getByText('Parallel Line', { exact: true }).click();
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
  await page.getByTestId('advanced-tools-btn').click();
  await page.getByText('Parallel Line', { exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.locator('input').first().press('Escape');
  await expect(dialog).not.toBeVisible();
});

for (const entry of [
  { name: 'note', button: 'create-note-btn' },
  { name: 'point', button: 'draw-point-btn' },
  { name: 'circle', button: 'draw-circle-btn' },
  { name: 'line', button: 'draw-line-btn' },
  { name: 'route', button: 'draw-route-btn' },
  { name: 'polygon', button: 'draw-polygon-btn' },
  { name: 'azimuth', advanced: 'Azimuth Line' },
  { name: 'intersection', advanced: 'Intersection' },
  { name: 'parallel', advanced: 'Parallel Line' },
  { name: 'freehand', advanced: 'Free Hand' },
  { name: 'angle', advanced: 'Line at Angle' },
  { name: 'project creation', project: 'new-project-btn', blocking: true },
  { name: 'project settings', project: 'project-settings-btn' },
  { name: 'project management', project: 'load-project-btn' },
  { name: 'language', moreLabel: 'Language' },
  { name: 'bearings', contextLabel: 'Bearings' },
  { name: 'themes', more: 'theme-picker-btn' },
]) {
  test(`${entry.name} uses a ${'blocking' in entry ? 'blocking' : 'draggable nonblocking'} window`, async ({
    page,
    blankProject,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1100 });
    if ('label' in entry)
      await page.getByRole('button', { name: entry.label!, exact: true }).click();
    if ('button' in entry) await page.getByTestId(entry.button!).click();
    if ('advanced' in entry) {
      await page.getByTestId('advanced-tools-btn').click();
      await page.getByText(entry.advanced!, { exact: true }).click();
    }
    if ('project' in entry) {
      await page.getByTestId('save-menu-btn').click();
      await page.getByTestId(entry.project!).click();
    }
    if ('moreLabel' in entry) {
      await page.getByRole('button', { name: 'More', exact: true }).click();
      await page.getByText(entry.moreLabel!, { exact: true }).click();
    }
    if ('contextLabel' in entry) {
      await page.locator('.layer-item-actions button').first().click();
      await page.getByText(entry.contextLabel!, { exact: true }).click();
    }
    if ('more' in entry) {
      await page.getByRole('button', { name: 'More', exact: true }).click();
      await page.getByTestId(entry.more!).click();
    }
    const dialog = page.getByRole('dialog');
    if ('blocking' in entry) {
      await expect(dialog).toHaveAttribute('aria-modal', 'true');
      await expect(page.locator('.v-overlay__scrim')).toBeVisible();
      await dialog.getByText('Imported image', { exact: true }).click();
      await expect(dialog.getByRole('radio', { name: /^Imported image/ })).toBeChecked();
      await expect(dialog.getByRole('button', { name: 'Choose an image' })).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(dialog).not.toBeVisible();
      return;
    }
    await expect(dialog).toHaveAttribute('aria-modal', 'false');
    await expect(page.locator('.v-overlay__scrim')).toHaveCount(0);
    const content = dialog.locator('.v-overlay__content');
    const before = (await content.boundingBox())!;
    const title = (await dialog.locator('.v-card-title').first().boundingBox())!;
    await page.mouse.move(title.x + 30, title.y + 20);
    await page.mouse.down();
    await page.mouse.move(title.x + 110, title.y + 10, { steps: 10 });
    await page.mouse.up();
    const after = (await content.boundingBox())!;
    expect(after.x - before.x).toBeCloseTo(80, 0);
    expect(after.y - before.y).toBeCloseTo(-10, 0);
    await page.locator('#map').click({ position: { x: 1350, y: 850 } });
    await expect(dialog).toBeVisible();
    // Escape belongs to the floating window when focus returns to it.
    await content.focus();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
}

test('tutorial opens as a full-page modal', async ({ page, blankProject }) => {
  void blankProject;
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.getByRole('button', { name: 'Welcome to GeoChase', exact: true }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(page.locator('.v-overlay__scrim')).toBeVisible();

  const content = dialog.locator('.v-overlay__content');
  await expect
    .poll(async () => {
      const bounds = await content.boundingBox();
      return (
        bounds !== null &&
        Math.abs(bounds.x) <= 1 &&
        Math.abs(bounds.y) <= 1 &&
        Math.abs(bounds.width - 1440) <= 1 &&
        Math.abs(bounds.height - 1100) <= 1
      );
    })
    .toBe(true);
});
