import { expect, test } from './fixtures';

test.describe('Free-Hand Drawing', () => {
  test.describe('Free-Hand Line Modal', () => {
    test('should open free-hand line modal', async ({ page, blankProject }) => {
      // Click the free-hand line button (gesture icon)
      await page.locator('button .mdi-gesture').locator('..').click();
      await page.waitForTimeout(300);

      // Verify modal is open
      const modal = page.locator('.v-dialog');
      await expect(modal).toBeVisible();

      // Verify modal title
      await expect(page.locator('.v-card-title').filter({ hasText: /Free|Libre/i })).toBeVisible();
    });

    test('should display instructions alert', async ({ page, blankProject }) => {
      // Open free-hand line modal
      await page.locator('button .mdi-gesture').locator('..').click();
      await page.waitForTimeout(300);

      // Verify instructions alert is shown
      await expect(page.locator('.v-alert')).toBeVisible();
    });

    test('should have optional name field', async ({ page, blankProject }) => {
      // Open free-hand line modal
      await page.locator('button .mdi-gesture').locator('..').click();
      await page.waitForTimeout(300);

      // Verify name field is present (labeled as optional)
      const nameInput = page.locator('input[type="text"]').first();
      await expect(nameInput).toBeVisible();
    });

    test('should have optional start coordinate field', async ({ page, blankProject }) => {
      // Open free-hand line modal
      await page.locator('button .mdi-gesture').locator('..').click();
      await page.waitForTimeout(300);

      // Verify coordinate selector is present
      await expect(page.locator('.v-select').first()).toBeVisible();
    });

    test('should have optional azimuth field', async ({ page, blankProject }) => {
      // Open free-hand line modal
      await page.locator('button .mdi-gesture').locator('..').click();
      await page.waitForTimeout(300);

      // Verify azimuth number input is present
      const azimuthInput = page.locator('input[type="number"]').first();
      await expect(azimuthInput).toBeVisible();
    });

    test('should close modal with cancel button', async ({ page, blankProject }) => {
      // Open free-hand line modal
      await page.locator('button .mdi-gesture').locator('..').click();
      await page.waitForTimeout(300);

      // Click cancel button
      await page
        .locator('button')
        .filter({ hasText: /Cancel|Annuler/i })
        .click();
      await page.waitForTimeout(300);

      // Modal should be closed
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should close modal with escape key', async ({ page, blankProject }) => {
      // Open free-hand line modal
      await page.locator('button .mdi-gesture').locator('..').click();
      await page.waitForTimeout(300);

      // Press escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Modal should be closed
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });
  });

  test.describe('Free-Hand Drawing Mode', () => {
    test('should start drawing mode when clicking start button', async ({ page, blankProject }) => {
      // Open free-hand line modal
      await page.locator('button .mdi-gesture').locator('..').click();
      await page.waitForTimeout(300);

      // Click Start Drawing button
      await page
        .locator('button')
        .filter({ hasText: /Start Drawing|Commencer/i })
        .click();
      await page.waitForTimeout(500);

      // Modal should close
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should start with predefined start coordinate', async ({ page, blankProject }) => {
      // Open free-hand line modal
      await page.locator('button .mdi-gesture').locator('..').click();
      await page.waitForTimeout(300);

      // Select a start coordinate from dropdown (inside the dialog)
      const dialog = page.locator('.v-dialog');
      const coordSelector = dialog.locator('.v-select').first();
      await coordSelector.locator('.v-select__menu-icon').click();
      await page.waitForTimeout(300);

      // Select Paris from dropdown
      await page.locator('.v-select__content .v-list-item').first().click();
      await page.waitForTimeout(300);

      // Click Start Drawing button
      await page
        .locator('button')
        .filter({ hasText: /Start Drawing|Commencer/i })
        .click();
      await page.waitForTimeout(500);

      // Modal should close (drawing mode started)
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should start with predefined azimuth', async ({ page, blankProject }) => {
      // Open free-hand line modal
      await page.locator('button .mdi-gesture').locator('..').click();
      await page.waitForTimeout(300);

      // Enter an azimuth value
      const azimuthInput = page.locator('input[type="number"]').first();
      await azimuthInput.fill('45');
      await page.waitForTimeout(300);

      // Click Start Drawing button
      await page
        .locator('button')
        .filter({ hasText: /Start Drawing|Commencer/i })
        .click();
      await page.waitForTimeout(500);

      // Modal should close (drawing mode started with azimuth)
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should start with custom name', async ({ page, blankProject }) => {
      // Open free-hand line modal
      await page.locator('button .mdi-gesture').locator('..').click();
      await page.waitForTimeout(300);

      // Enter a custom name
      const nameInput = page.locator('input[type="text"]').first();
      await nameInput.fill('My Custom Line');
      await page.waitForTimeout(300);

      // Click Start Drawing button
      await page
        .locator('button')
        .filter({ hasText: /Start Drawing|Commencer/i })
        .click();
      await page.waitForTimeout(500);

      // Modal should close
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should validate azimuth range 0-360', async ({ page, blankProject }) => {
      // Open free-hand line modal
      await page.locator('button .mdi-gesture').locator('..').click();
      await page.waitForTimeout(300);

      // Verify azimuth input has min/max attributes
      const azimuthInput = page.locator('input[type="number"]').first();
      await expect(azimuthInput).toHaveAttribute('min', '0');
      await expect(azimuthInput).toHaveAttribute('max', '360');
    });
  });

  test.describe('Coordinate Selection', () => {
    test('should show saved coordinates in dropdown', async ({ page, blankProject }) => {
      // Open free-hand line modal
      await page.locator('button .mdi-gesture').locator('..').click();
      await page.waitForTimeout(300);

      // Open coordinate dropdown (inside the dialog)
      const dialog = page.locator('.v-dialog');
      const coordSelector = dialog.locator('.v-select').first();
      await coordSelector.locator('.v-select__menu-icon').click();
      await page.waitForTimeout(300);

      // Verify saved coordinates are shown (Paris, London, Berlin from fixture)
      await expect(page.locator('.v-select__content .v-list-item').first()).toBeVisible();

      // Should have at least 3 options (from fixture)
      const itemCount = await page.locator('.v-select__content .v-list-item').count();
      expect(itemCount).toBeGreaterThanOrEqual(3);
    });

    test('should select coordinate from dropdown', async ({ page, blankProject }) => {
      // Open free-hand line modal
      await page.locator('button .mdi-gesture').locator('..').click();
      await page.waitForTimeout(300);

      // Open coordinate dropdown (inside the dialog)
      const dialog = page.locator('.v-dialog');
      const coordSelector = dialog.locator('.v-select').first();
      await coordSelector.locator('.v-select__menu-icon').click();
      await page.waitForTimeout(300);

      // Select first option
      await page.locator('.v-select__content .v-list-item').first().click();
      await page.waitForTimeout(300);

      // Dropdown should close and value should be selected
      await expect(page.locator('.v-select__content')).not.toBeVisible();
    });
  });
});
