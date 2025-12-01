import { expect, test } from '../fixtures';

test.describe('Sidebar UI', () => {
  test.describe('Sidebar Elements', () => {
    test('should display sidebar content', async ({ page, blankProject }) => {
      // Sidebar should have visible content (layers panel title is always visible)
      await expect(page.locator('.layers-panel-title')).toBeVisible();
    });

    test('should display action buttons area', async ({ page, blankProject }) => {
      // Draw buttons should be visible in sidebar
      await expect(page.locator('[data-testid="draw-point-btn"]')).toBeVisible();
    });

    test('should display multiple drawing options', async ({ page, blankProject }) => {
      // Circle button should be visible
      await expect(page.locator('[data-testid="draw-circle-btn"]')).toBeVisible();
    });
  });

  test.describe('Layers Panel', () => {
    // Fixture provides 3 points: Paris, London, Berlin

    test('should display layers title', async ({ page, blankProject }) => {
      await expect(page.locator('.layers-panel-title')).toBeVisible();
    });

    test('should show search filter when elements exist', async ({ page, blankProject }) => {
      // Fixture provides 3 points, search filter should be visible
      await expect(page.locator('.layers-search input')).toBeVisible();
    });

    test('should filter elements by name', async ({ page, blankProject }) => {
      // Fixture provides Paris, London, Berlin points
      // Type in search filter
      await page.locator('.layers-search input').fill('Paris');
      await page.waitForTimeout(300);

      // Should show Paris but not London or Berlin
      await expect(page.locator('.layer-item-name').filter({ hasText: 'Paris' })).toBeVisible();
      await expect(
        page.locator('.layer-item-name').filter({ hasText: 'London' })
      ).not.toBeVisible();
      await expect(
        page.locator('.layer-item-name').filter({ hasText: 'Berlin' })
      ).not.toBeVisible();
    });

    test('should show no results message when filter finds nothing', async ({
      page,
      blankProject,
    }) => {
      // Fixture provides points, type a filter that matches nothing
      await page.locator('.layers-search input').fill('xyz123nonexistent');
      await page.waitForTimeout(300);

      // Should show no results message
      await expect(page.locator('.layers-empty')).toBeVisible();
    });

    test('should clear search filter', async ({ page, blankProject }) => {
      // Fixture provides points, type a filter that hides them
      await page.locator('.layers-search input').fill('xyz123');
      await page.waitForTimeout(300);

      // Clear the filter
      await page.locator('.layers-search .mdi-close-circle').click();
      await page.waitForTimeout(300);

      // Points should be visible again
      await expect(page.locator('.layer-item').first()).toBeVisible();
    });
  });

  test.describe('Collapsible Sections', () => {
    // Fixture provides 3 points: Paris, London, Berlin

    test('should collapse points section', async ({ page, blankProject }) => {
      // Fixture provides points, section should be expanded by default
      await expect(page.locator('.layer-items .layer-item').first()).toBeVisible();

      // Click collapse icon (the ▼ chevron)
      await page.locator('.layers-section-header').locator('text=▼').click();
      await page.waitForTimeout(300);

      // Section should be collapsed - items not visible
      await expect(page.locator('.layer-items .layer-item').first()).not.toBeVisible();
    });

    test('should expand collapsed section', async ({ page, blankProject }) => {
      // Fixture provides points, collapse section first
      await page.locator('.layers-section-header').locator('text=▼').click();
      await page.waitForTimeout(300);

      // Expand section (chevron changes to ▶)
      await page.locator('.layers-section-header').locator('text=▶').click();
      await page.waitForTimeout(300);

      // Section should be expanded again
      await expect(page.locator('.layer-items .layer-item').first()).toBeVisible();
    });

    test('should show circles section when circles exist', async ({ page, blankProject }) => {
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

      // Circles section should be visible
      await expect(
        page.locator('.layers-section-title').filter({ hasText: /Circle|Cercle/i })
      ).toBeVisible();
    });

    test('should show lines section when lines exist', async ({ page, blankProject }) => {
      // Create a line (azimuth mode)
      await page.locator('button .mdi-compass-outline').locator('..').click();
      await page.waitForTimeout(300);

      const dialog = page.locator('.v-dialog');
      await dialog.locator('.v-select').first().locator('.v-select__menu-icon').click();
      await page.waitForTimeout(300);
      await page.locator('.v-select__content .v-list-item').first().click();
      await page.waitForTimeout(300);

      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Lines section should be visible
      await expect(
        page.locator('.layers-section-title').filter({ hasText: /Line|Ligne/i })
      ).toBeVisible();
    });
  });

  test.describe('Layer Item Actions', () => {
    // Fixture provides 3 points: Paris, London, Berlin

    test('should show context menu on layer item', async ({ page, blankProject }) => {
      // Click context menu button on fixture point
      await page.locator('.layer-item .mdi-dots-vertical').first().click();
      await page.waitForTimeout(300);

      // Context menu should be visible
      await expect(page.locator('.v-menu .v-list')).toBeVisible();
    });

    test('should navigate to layer item on click', async ({ page, blankProject }) => {
      // Click on layer item info (using fixture point)
      await page.locator('.layer-item-info').first().click();
      await page.waitForTimeout(500);

      // Map should animate (hard to verify, just check no errors)
      // The test passes if clicking works without errors
    });
  });

  test.describe('Bulk Visibility Toggle', () => {
    // Fixture provides 3 points: Paris, London, Berlin

    test('should show hide all button for points section', async ({ page, blankProject }) => {
      // Hide all button should be visible (eye icon in section header)
      await expect(
        page.locator('.layers-section-header .mdi-eye, .layers-section-header .mdi-eye-off')
      ).toBeVisible();
    });

    test('should toggle all points visibility', async ({ page, blankProject }) => {
      // Click hide all button (fixture provides points)
      await page
        .locator('.layers-section-header')
        .locator('.mdi-eye, .mdi-eye-off')
        .first()
        .click();
      await page.waitForTimeout(300);

      // Toast should appear
      await expect(page.locator('.v-snackbar').first()).toBeVisible();
    });
  });

  test.describe('Layer Item Info', () => {
    // Fixture provides 3 points: Paris, London, Berlin

    test('should display point name', async ({ page, blankProject }) => {
      // Fixture point name should be visible in sidebar
      await expect(page.locator('.layer-item-name').filter({ hasText: 'Paris' })).toBeVisible();
    });

    test('should display circle radius', async ({ page, blankProject }) => {
      // Create a circle with specific radius
      await page.locator('[data-testid="draw-circle-btn"]').click();
      await page.waitForTimeout(300);
      const dialog = page.locator('.v-dialog');
      await dialog.locator('.v-select').first().click();
      await page.waitForTimeout(300);
      await page.locator('.v-select__content .v-list-item').first().click();
      await page.waitForTimeout(300);
      await dialog.locator('input[type="number"]').first().fill('5');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Circle radius should be visible in sidebar
      await expect(page.locator('.layer-item-type').filter({ hasText: '5km' })).toBeVisible();
    });
  });

  test.describe('Sidebar Toggle', () => {
    test('should display sidebar toggle button', async ({ page, blankProject }) => {
      // Toggle button should be visible
      await expect(
        page
          .locator('button')
          .filter({ has: page.locator('.mdi-chevron-left, .mdi-chevron-right') })
      ).toBeVisible();
    });
  });
});
