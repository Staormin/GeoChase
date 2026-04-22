import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';

const toolsButton = (page: Page) => page.locator('button[aria-label="Tools"]');

// The left Vuetify sidebar (640px) overlays the `#map` div, so clicks in the
// left half would land on the sidebar, not the OL canvas. Aim at the center of
// the visible map area (right of the sidebar).
const SIDEBAR_WIDTH = 640;

async function mapCenter(page: Page) {
  const map = page.locator('#map');
  const box = await map.boundingBox();
  if (!box) throw new Error('map bounding box unavailable');
  const left = Math.max(box.x, box.x + SIDEBAR_WIDTH);
  return {
    cx: left + (box.x + box.width - left) / 2,
    cy: box.y + box.height / 2,
  };
}

async function activateRuler(page: Page) {
  await toolsButton(page).click();
  await page.locator('button[aria-label="Ruler"]').click();
}

test.describe('Ruler Tool', () => {
  test('shows FAB and toggles the toolbar', async ({ page, blankProject }) => {
    const fab = toolsButton(page);
    await expect(fab).toBeVisible();
    await expect(fab.locator('.mdi-tools')).toBeVisible();
    await expect(page.locator('.tools-toolbar')).not.toBeVisible();

    await fab.click();
    await expect(page.locator('.tools-toolbar')).toBeVisible();
    await expect(page.locator('button[aria-label="Ruler"]')).toBeVisible();

    await fab.click();
    await expect(page.locator('.tools-toolbar')).not.toBeVisible();
  });

  test('activates the ruler and switches the FAB into close mode', async ({
    page,
    blankProject,
  }) => {
    await activateRuler(page);

    // Toolbar closes when a tool is activated
    await expect(page.locator('.tools-toolbar')).not.toBeVisible();

    // FAB now shows the close icon
    const fab = toolsButton(page);
    await expect(fab.locator('.mdi-close')).toBeVisible();
    await expect(fab.locator('.mdi-tools')).toHaveCount(0);
  });

  test('shows cursor tooltip after the first click and mouse move', async ({
    page,
    blankProject,
  }) => {
    await activateRuler(page);
    const { cx, cy } = await mapCenter(page);

    await expect(page.locator('.cursor-tooltip')).not.toBeVisible();

    await page.mouse.click(cx, cy);
    await page.waitForTimeout(350);
    await page.mouse.move(cx + 120, cy + 80, { steps: 8 });

    const tooltip = page.locator('.cursor-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('km');
    await expect(tooltip).toContainText('°');
  });

  test('second click drops a measurement window and hides the cursor tooltip', async ({
    page,
    blankProject,
  }) => {
    await activateRuler(page);
    const { cx, cy } = await mapCenter(page);

    await page.mouse.click(cx, cy);
    await page.waitForTimeout(350);
    await page.mouse.move(cx + 120, cy + 80, { steps: 6 });
    await page.mouse.click(cx + 120, cy + 80);
    await page.waitForTimeout(350);

    // Cursor tooltip goes away; a permanent measurement window appears instead.
    await expect(page.locator('.cursor-tooltip')).not.toBeVisible();
    const measurement = page.locator('.ruler-measurement');
    await expect(measurement).toHaveCount(1);
    await expect(measurement).toContainText('km');
    await expect(measurement).toContainText('°');

    // Ruler is still active — ready for another measurement.
    await expect(toolsButton(page).locator('.mdi-close')).toBeVisible();
  });

  test('supports multiple independent measurements, each with its own window', async ({
    page,
    blankProject,
  }) => {
    await activateRuler(page);
    const { cx, cy } = await mapCenter(page);

    // First measurement
    await page.mouse.click(cx - 120, cy - 60);
    await page.waitForTimeout(350);
    await page.mouse.move(cx - 20, cy - 20, { steps: 4 });
    await page.mouse.click(cx - 20, cy - 20);
    await page.waitForTimeout(350);

    // Second measurement
    await page.mouse.click(cx + 60, cy + 60);
    await page.waitForTimeout(350);
    await page.mouse.move(cx + 180, cy + 140, { steps: 4 });
    await page.mouse.click(cx + 180, cy + 140);
    await page.waitForTimeout(350);

    await expect(page.locator('.ruler-measurement')).toHaveCount(2);
    await expect(toolsButton(page).locator('.mdi-close')).toBeVisible();
  });

  test('measurement window tracks the endpoint when the map is panned', async ({
    page,
    blankProject,
  }) => {
    await activateRuler(page);
    const { cx, cy } = await mapCenter(page);

    await page.mouse.click(cx - 80, cy);
    await page.waitForTimeout(350);
    await page.mouse.move(cx + 80, cy, { steps: 4 });
    await page.mouse.click(cx + 80, cy);
    await page.waitForTimeout(350);

    const measurement = page.locator('.ruler-measurement');
    const before = await measurement.boundingBox();
    if (!before) throw new Error('measurement bounding box unavailable before pan');

    // Pan the map to the right — the endpoint (and thus its window) should move.
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx - 200, cy, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(400);

    const after = await measurement.boundingBox();
    if (!after) throw new Error('measurement bounding box unavailable after pan');
    expect(Math.abs(after.x - before.x)).toBeGreaterThan(50);
    await expect(toolsButton(page).locator('.mdi-close')).toBeVisible();
  });

  test('map drag between measurements does not exit the tool', async ({ page, blankProject }) => {
    await activateRuler(page);
    const { cx, cy } = await mapCenter(page);

    await page.mouse.click(cx, cy);
    await page.waitForTimeout(350);
    await page.mouse.click(cx + 100, cy + 100);
    await page.waitForTimeout(350);

    await page.mouse.move(cx + 50, cy + 50);
    await page.mouse.down();
    await page.mouse.move(cx - 150, cy - 150, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(350);

    await expect(toolsButton(page).locator('.mdi-close')).toBeVisible();
    await expect(page.locator('.ruler-measurement')).toHaveCount(1);
  });

  test('escape exits the ruler and removes all measurements', async ({ page, blankProject }) => {
    await activateRuler(page);
    const { cx, cy } = await mapCenter(page);

    // Make one measurement, then start another one we leave in-progress.
    await page.mouse.click(cx - 60, cy);
    await page.waitForTimeout(350);
    await page.mouse.move(cx - 10, cy, { steps: 3 });
    await page.mouse.click(cx - 10, cy);
    await page.waitForTimeout(350);
    await page.mouse.click(cx + 40, cy);
    await page.waitForTimeout(350);
    await page.mouse.move(cx + 100, cy + 40, { steps: 4 });

    await expect(page.locator('.cursor-tooltip')).toBeVisible();
    await expect(page.locator('.ruler-measurement')).toHaveCount(1);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    const fab = toolsButton(page);
    await expect(fab.locator('.mdi-tools')).toBeVisible();
    await expect(fab.locator('.mdi-close')).toHaveCount(0);
    await expect(page.locator('.cursor-tooltip')).not.toBeVisible();
    await expect(page.locator('.ruler-measurement')).toHaveCount(0);
  });

  test('clicking the FAB close button stops an active ruler and clears measurements', async ({
    page,
    blankProject,
  }) => {
    await activateRuler(page);
    const { cx, cy } = await mapCenter(page);

    await page.mouse.click(cx, cy);
    await page.waitForTimeout(350);
    await page.mouse.click(cx + 100, cy + 100);
    await page.waitForTimeout(350);

    await expect(toolsButton(page).locator('.mdi-close')).toBeVisible();
    await expect(page.locator('.ruler-measurement')).toHaveCount(1);

    await toolsButton(page).click();

    const fab = toolsButton(page);
    await expect(fab.locator('.mdi-tools')).toBeVisible();
    await expect(fab.locator('.mdi-close')).toHaveCount(0);
    await expect(page.locator('.ruler-measurement')).toHaveCount(0);
  });
});
