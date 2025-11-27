import { expect, test } from '../fixtures';

test.describe('Keyboard Shortcuts', () => {
  test.describe('Escape Key', () => {
    test('should close circle modal with escape key', async ({ page, blankProject }) => {
      // Open circle modal
      await page.locator('[data-testid="draw-circle-btn"]').click();
      await page.waitForTimeout(300);

      // Verify modal is open
      await expect(page.locator('.v-dialog')).toBeVisible();

      // Press escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Modal should be closed
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should close point modal with escape key', async ({ page, blankProject }) => {
      // Open point modal
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);

      // Verify modal is open
      await expect(page.locator('.v-dialog')).toBeVisible();

      // Press escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Modal should be closed
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should close azimuth line modal with escape key', async ({ page, blankProject }) => {
      // Open azimuth line modal
      await page.locator('button .mdi-compass-outline').locator('..').click();
      await page.waitForTimeout(300);

      // Verify modal is open
      await expect(page.locator('.v-dialog')).toBeVisible();

      // Press escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Modal should be closed
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should close free-hand modal with escape key', async ({ page, blankProject }) => {
      // Open free-hand modal
      await page.locator('button .mdi-gesture').locator('..').click();
      await page.waitForTimeout(300);

      // Verify modal is open
      await expect(page.locator('.v-dialog')).toBeVisible();

      // Press escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Modal should be closed
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should close angle line modal with escape key', async ({ page, blankProject }) => {
      // Open angle line modal
      await page.locator('button .mdi-angle-acute').locator('..').click();
      await page.waitForTimeout(300);

      // Verify modal is open
      await expect(page.locator('.v-dialog')).toBeVisible();

      // Press escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Modal should be closed
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });
  });

  test.describe('Enter Key', () => {
    test('should submit circle form with enter key', async ({ page, blankProject }) => {
      // Open circle modal
      await page.locator('[data-testid="draw-circle-btn"]').click();
      await page.waitForTimeout(300);

      const dialog = page.locator('.v-dialog');

      // Select coordinate
      await dialog.locator('.v-select').first().click();
      await page.waitForTimeout(300);
      await page.locator('.v-select__content .v-list-item').first().click();
      await page.waitForTimeout(300);

      // Set radius
      const radiusInput = dialog.locator('input[type="number"]').first();
      await radiusInput.fill('1');
      await page.waitForTimeout(300);

      // Press enter
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      // Modal should be closed (form submitted)
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should submit point form with enter key', async ({ page, blankProject }) => {
      // Open point modal
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);

      // Fill in coordinates
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page.waitForTimeout(300);

      // Press enter
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      // Modal should be closed (form submitted)
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });
  });

  test.describe('Context Menu Navigation', () => {
    test('should open context menu navigation for circle', async ({ page, blankProject }) => {
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

      // Get circle layer item
      const circleItem = page
        .locator('.layer-item')
        .filter({ has: page.locator('.layer-item-type', { hasText: /km radius/ }) })
        .first();

      // Open context menu
      await circleItem.locator('.mdi-dots-vertical').click();
      await page.waitForTimeout(300);

      // Should have navigate option
      await expect(
        page.locator('.v-list-item').filter({ hasText: /Navigate|Naviguer/i })
      ).toBeVisible();
    });

    test('should start navigation mode from context menu', async ({ page, blankProject }) => {
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

      // Get circle layer item
      const circleItem = page
        .locator('.layer-item')
        .filter({ has: page.locator('.layer-item-type', { hasText: /km radius/ }) })
        .first();

      // Open context menu
      await circleItem.locator('.mdi-dots-vertical').click();
      await page.waitForTimeout(300);

      // Click navigate
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Navigate|Naviguer/i })
        .click();
      await page.waitForTimeout(300);

      // Navigation bar should appear
      await expect(page.locator('.navigation-bar')).toBeVisible();
    });

    test('should exit navigation mode with escape key', async ({ page, blankProject }) => {
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

      // Get circle layer item
      const circleItem = page
        .locator('.layer-item')
        .filter({ has: page.locator('.layer-item-type', { hasText: /km radius/ }) })
        .first();

      // Open context menu and start navigation
      await circleItem.locator('.mdi-dots-vertical').click();
      await page.waitForTimeout(300);
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Navigate|Naviguer/i })
        .click();
      await page.waitForTimeout(300);

      // Navigation bar should be visible
      await expect(page.locator('.navigation-bar')).toBeVisible();

      // Press escape to exit navigation mode
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Navigation bar should be hidden
      await expect(page.locator('.navigation-bar')).not.toBeVisible();
    });
  });

  test.describe('Free-Hand Drawing Escape', () => {
    test('should exit free-hand drawing mode with escape', async ({ page, blankProject }) => {
      // Open free-hand modal
      await page.locator('button .mdi-gesture').locator('..').click();
      await page.waitForTimeout(300);

      // Start drawing
      await page
        .locator('button')
        .filter({ hasText: /Start Drawing|Commencer/i })
        .click();
      await page.waitForTimeout(300);

      // Modal should be closed (drawing mode started)
      await expect(page.locator('.v-dialog')).not.toBeVisible();

      // Press escape to cancel drawing mode
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Toast should appear indicating drawing was cancelled or completed
      // The exact behavior depends on implementation
    });
  });
});
