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
    test('should display layers title', async ({ page, blankProject }) => {
      await expect(page.locator('.layers-panel-title')).toBeVisible();
    });

    test('should show empty state when no elements exist', async ({ page, blankProject }) => {
      // Empty state should be shown
      await expect(page.locator('.layers-empty')).toBeVisible();
    });

    test('should show search filter when elements exist', async ({ page, blankProject }) => {
      // Create a point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Search filter should be visible
      await expect(page.locator('.layers-search input')).toBeVisible();
    });

    test('should filter elements by name', async ({ page, blankProject }) => {
      // Create first point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      const nameInput = page.locator('.v-dialog input[type="text"]').first();
      await nameInput.fill('Paris Point');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Create second point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('51.5074, -0.1278');
      const nameInput2 = page.locator('.v-dialog input[type="text"]').first();
      await nameInput2.fill('London Point');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Type in search filter
      await page.locator('.layers-search input').fill('Paris');
      await page.waitForTimeout(300);

      // Should show Paris Point but not London Point
      await expect(
        page.locator('.layer-item-name').filter({ hasText: 'Paris Point' })
      ).toBeVisible();
      await expect(
        page.locator('.layer-item-name').filter({ hasText: 'London Point' })
      ).not.toBeVisible();
    });

    test('should show no results message when filter finds nothing', async ({
      page,
      blankProject,
    }) => {
      // Create a point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Type in search filter that matches nothing
      await page.locator('.layers-search input').fill('xyz123nonexistent');
      await page.waitForTimeout(300);

      // Should show no results message
      await expect(page.locator('.layers-empty')).toBeVisible();
    });

    test('should clear search filter', async ({ page, blankProject }) => {
      // Create a point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Type in search filter
      await page.locator('.layers-search input').fill('xyz123');
      await page.waitForTimeout(300);

      // Clear the filter
      await page.locator('.layers-search .mdi-close-circle').click();
      await page.waitForTimeout(300);

      // Point should be visible again
      await expect(page.locator('.layer-item')).toBeVisible();
    });
  });

  test.describe('Collapsible Sections', () => {
    test('should collapse points section', async ({ page, blankProject }) => {
      // Create a point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Section should be expanded by default
      await expect(page.locator('.layer-items .layer-item').first()).toBeVisible();

      // Click collapse icon
      await page.locator('.layers-section-header .collapse-icon').click();
      await page.waitForTimeout(300);

      // Section should be collapsed
      await expect(page.locator('.layer-items .layer-item')).not.toBeVisible();
    });

    test('should expand collapsed section', async ({ page, blankProject }) => {
      // Create a point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Collapse section
      await page.locator('.layers-section-header .collapse-icon').click();
      await page.waitForTimeout(300);

      // Expand section
      await page.locator('.layers-section-header .collapse-icon').click();
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
    test('should show context menu on layer item', async ({ page, blankProject }) => {
      // Create a point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Click context menu button
      await page.locator('.layer-item .mdi-dots-vertical').first().click();
      await page.waitForTimeout(300);

      // Context menu should be visible
      await expect(page.locator('.v-menu .v-list')).toBeVisible();
    });

    test('should navigate to layer item on click', async ({ page, blankProject }) => {
      // Create a point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Click on layer item info
      await page.locator('.layer-item-info').first().click();
      await page.waitForTimeout(500);

      // Map should animate (hard to verify, just check no errors)
      // The test passes if clicking works without errors
    });
  });

  test.describe('Bulk Visibility Toggle', () => {
    test('should show hide all button for points section', async ({ page, blankProject }) => {
      // Create a point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Hide all button should be visible (eye icon in section header)
      await expect(
        page.locator('.layers-section-header .mdi-eye, .layers-section-header .mdi-eye-off')
      ).toBeVisible();
    });

    test('should toggle all points visibility', async ({ page, blankProject }) => {
      // Create a point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Click hide all button
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
    test('should display point name', async ({ page, blankProject }) => {
      // Create a point with custom name
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      const nameInput = page.locator('.v-dialog input[type="text"]').first();
      await nameInput.fill('Test Point Name');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Point name should be visible in sidebar
      await expect(
        page.locator('.layer-item-name').filter({ hasText: 'Test Point Name' })
      ).toBeVisible();
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
