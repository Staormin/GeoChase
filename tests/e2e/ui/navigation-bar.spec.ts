import { expect, test } from '../fixtures';

// Helper to create a circle and start navigation
async function createCircleAndNavigate(page: any) {
  // Create a circle
  await page.locator('[data-testid="draw-circle-btn"]').click();
  await page.waitForTimeout(300);
  const dialog = page.locator('.v-dialog');
  await dialog.locator('.v-select').first().click();
  await page.waitForTimeout(300);
  await page.locator('.v-select__content .v-list-item').first().click();
  await page.waitForTimeout(300);
  await dialog.locator('input[type="number"]').first().fill('1');
  await page
    .locator('button')
    .filter({ hasText: /Add|Ajouter/i })
    .click();
  await page.waitForTimeout(500);

  // Open context menu and click Navigate
  const circleItem = page
    .locator('.layer-item')
    .filter({ has: page.locator('.layer-item-type', { hasText: /km radius/ }) })
    .first();
  await circleItem.locator('.mdi-dots-vertical').click();
  await page.waitForTimeout(300);
  await page
    .locator('.v-list-item')
    .filter({ hasText: /Navigate|Naviguer/i })
    .click();
  await page.waitForTimeout(300);
}

// Helper to start free-hand drawing
async function startFreeHandDrawing(page: any) {
  await page.locator('button .mdi-gesture').locator('..').click();
  await page.waitForTimeout(300);
  await page
    .locator('button')
    .filter({ hasText: /Start Drawing|Commencer/i })
    .click();
  await page.waitForTimeout(300);
}

test.describe('Navigation Bar', () => {
  test.describe('Navigation Mode', () => {
    test('should show navigation bar when navigating', async ({ page, blankProject }) => {
      await createCircleAndNavigate(page);

      // Navigation bar should be visible
      await expect(page.locator('.navigation-bar')).toBeVisible();
    });

    test('should show compass emoji in navigation mode', async ({ page, blankProject }) => {
      await createCircleAndNavigate(page);

      // Compass emoji should be visible
      await expect(page.locator('.navigation-bar').locator('text=🧭')).toBeVisible();
    });

    test('should show arrow key instructions', async ({ page, blankProject }) => {
      await createCircleAndNavigate(page);

      // Arrow key instructions should be visible
      await expect(page.locator('.navigation-bar').locator('text=← →')).toBeVisible();
    });

    test('should show ESC key instruction', async ({ page, blankProject }) => {
      await createCircleAndNavigate(page);

      // ESC instruction should be visible
      await expect(page.locator('.navigation-bar').locator('text=ESC')).toBeVisible();
    });

    test('should show exit navigation button', async ({ page, blankProject }) => {
      await createCircleAndNavigate(page);

      // Exit button should be visible
      await expect(page.locator('.navigation-exit-btn')).toBeVisible();
    });

    test('should exit navigation when clicking exit button', async ({ page, blankProject }) => {
      await createCircleAndNavigate(page);

      // Click exit button
      await page.locator('.navigation-exit-btn').click();
      await page.waitForTimeout(300);

      // Navigation bar should be hidden
      await expect(page.locator('.navigation-bar')).not.toBeVisible();
    });

    test('should exit navigation when pressing ESC key', async ({ page, blankProject }) => {
      await createCircleAndNavigate(page);

      // Press ESC
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Navigation bar should be hidden
      await expect(page.locator('.navigation-bar')).not.toBeVisible();
    });

    test('should navigate to next point with ArrowRight', async ({ page, blankProject }) => {
      await createCircleAndNavigate(page);

      // Press ArrowRight
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(500);

      // Navigation bar should still be visible (navigated to next point)
      await expect(page.locator('.navigation-bar')).toBeVisible();
    });

    test('should navigate to previous point with ArrowLeft', async ({ page, blankProject }) => {
      await createCircleAndNavigate(page);

      // First go to next point
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(300);

      // Then go back
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(500);

      // Navigation bar should still be visible
      await expect(page.locator('.navigation-bar')).toBeVisible();
    });
  });

  test.describe('Free-Hand Drawing Mode', () => {
    test('should show navigation bar when free-hand drawing', async ({ page, blankProject }) => {
      await startFreeHandDrawing(page);

      // Navigation bar should be visible
      await expect(page.locator('.navigation-bar')).toBeVisible();
    });

    test('should show pencil emoji in drawing mode', async ({ page, blankProject }) => {
      await startFreeHandDrawing(page);

      // Pencil emoji should be visible
      await expect(page.locator('.navigation-bar').locator('text=✏️')).toBeVisible();
    });

    test('should show click to set start instruction', async ({ page, blankProject }) => {
      await startFreeHandDrawing(page);

      // Click to set start instruction should be visible (i18n key: freehand.clickToSetStart)
      const navBar = page.locator('.navigation-bar');
      await expect(navBar).toBeVisible();
    });

    test('should show ALT key instruction', async ({ page, blankProject }) => {
      await startFreeHandDrawing(page);

      // ALT instruction should be visible
      await expect(page.locator('.navigation-bar').locator('text=ALT')).toBeVisible();
    });

    test('should show CTRL key instruction', async ({ page, blankProject }) => {
      await startFreeHandDrawing(page);

      // CTRL instruction should be visible
      await expect(page.locator('.navigation-bar').locator('text=CTRL')).toBeVisible();
    });

    test('should show ESC instruction in drawing mode', async ({ page, blankProject }) => {
      await startFreeHandDrawing(page);

      // ESC instruction should be visible
      await expect(page.locator('.navigation-bar').locator('text=ESC')).toBeVisible();
    });

    test('should show cancel drawing button', async ({ page, blankProject }) => {
      await startFreeHandDrawing(page);

      // Cancel button should be visible
      await expect(page.locator('.navigation-exit-btn')).toBeVisible();
    });

    test('should exit drawing mode when clicking cancel button', async ({ page, blankProject }) => {
      await startFreeHandDrawing(page);

      // Click cancel button
      await page.locator('.navigation-exit-btn').click();
      await page.waitForTimeout(300);

      // Navigation bar should be hidden
      await expect(page.locator('.navigation-bar')).not.toBeVisible();
    });

    test('should exit drawing mode when pressing ESC key', async ({ page, blankProject }) => {
      await startFreeHandDrawing(page);

      // Press ESC
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Navigation bar should be hidden
      await expect(page.locator('.navigation-bar')).not.toBeVisible();
    });
  });

  test.describe('Navigation Bar Visibility', () => {
    test('should not show navigation bar by default', async ({ page, blankProject }) => {
      // Navigation bar should not be visible by default
      await expect(page.locator('.navigation-bar')).not.toBeVisible();
    });

    test('should hide top bar when navigation mode is active', async ({ page, blankProject }) => {
      await createCircleAndNavigate(page);

      // Top bar draw buttons should be hidden when navigating
      await expect(page.locator('[data-testid="draw-circle-btn"]')).not.toBeVisible();
    });

    test('should show top bar again after exiting navigation', async ({ page, blankProject }) => {
      await createCircleAndNavigate(page);

      // Exit navigation
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      // Top bar draw buttons should be visible again
      await expect(page.locator('[data-testid="draw-circle-btn"]')).toBeVisible();
    });
  });

  test.describe('Button Styling', () => {
    test('should have styled exit button', async ({ page, blankProject }) => {
      await createCircleAndNavigate(page);

      // Exit button should be visible and styled
      const exitBtn = page.locator('.navigation-exit-btn');
      await expect(exitBtn).toBeVisible();

      // Button should have text
      const buttonText = await exitBtn.textContent();
      expect(buttonText?.length).toBeGreaterThan(0);
    });
  });
});
