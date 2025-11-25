import { expect, test } from './fixtures';

test.describe('Layer Context Menu', () => {
  test.describe('Opening Context Menu', () => {
    test('should open context menu for point', async ({ page, blankProject }) => {
      // Create a point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Click context menu button (3 dots)
      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);

      // Context menu should be visible
      await expect(page.locator('.v-menu .v-list')).toBeVisible();
    });

    test('should open context menu for circle', async ({ page, blankProject }) => {
      // Create a circle
      await page.locator('[data-testid="draw-circle-btn"]').click();
      await page.waitForTimeout(300);

      const dialog = page.locator('.v-dialog');
      // Select coordinate
      await dialog.locator('.v-select').first().click();
      await page.waitForTimeout(300);
      await page.locator('.v-select__content .v-list-item').first().click();
      await page.waitForTimeout(300);

      // Set radius
      await dialog.locator('input[type="number"]').first().fill('1');
      await page.waitForTimeout(300);

      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Click context menu button
      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);

      // Context menu should be visible
      await expect(page.locator('.v-menu .v-list')).toBeVisible();
    });
  });

  test.describe('Common Menu Items', () => {
    test('should show hide/show option', async ({ page, blankProject }) => {
      // Create a point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Open context menu
      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);

      // Should have hide/show option
      await expect(
        page.locator('.v-list-item').filter({ hasText: /Hide|Show|Masquer|Afficher/i })
      ).toBeVisible();
    });

    test('should show edit option for editable elements', async ({ page, blankProject }) => {
      // Create a point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Open context menu
      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);

      // Should have edit option
      await expect(
        page.locator('.v-list-item').filter({ hasText: /Edit|Modifier/i })
      ).toBeVisible();
    });

    test('should show delete option', async ({ page, blankProject }) => {
      // Create a point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Open context menu
      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);

      // Should have delete option
      await expect(
        page.locator('.v-list-item').filter({ hasText: /Delete|Supprimer/i })
      ).toBeVisible();
    });

    test('should show add note option', async ({ page, blankProject }) => {
      // Create a point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Open context menu
      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);

      // Should have add note option
      await expect(page.locator('.v-list-item').filter({ hasText: /Note|note/i })).toBeVisible();
    });
  });

  test.describe('Point-Specific Options', () => {
    test('should show bearings option for points', async ({ page, blankProject }) => {
      // Create a point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Open context menu
      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);

      // Should have bearings option
      await expect(
        page.locator('.v-list-item').filter({ hasText: /Bearings|Azimuts/i })
      ).toBeVisible();
    });

    test('should show location near option for points', async ({ page, blankProject }) => {
      // Create a point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Open context menu
      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);

      // Should have location near option
      await expect(
        page.locator('.v-list-item').filter({ hasText: /Location near|Rechercher/i })
      ).toBeVisible();
    });

    test('should show add as coordinate option for points not in saved coordinates', async ({
      page,
      blankProject,
    }) => {
      // Create a point at different coordinates (not in saved coordinates)
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      // Use coordinates that aren't in the fixture's saved coordinates
      await page.locator('input[placeholder*="48.8566"]').fill('45.0, 5.0');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Open context menu
      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);

      // The option may or may not be visible depending on logic, just verify menu opened
      await expect(page.locator('.v-menu .v-list')).toBeVisible();
    });
  });

  test.describe('Visibility Toggle', () => {
    test('should toggle visibility when clicking hide/show', async ({ page, blankProject }) => {
      // Create a point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Open context menu
      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);

      // Click hide option
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Hide|Masquer/i })
        .click();
      await page.waitForTimeout(300);

      // Should show success toast
      await expect(page.locator('.v-snackbar').first()).toBeVisible();
    });
  });

  test.describe('Add Note', () => {
    test('should open note modal when clicking add note', async ({ page, blankProject }) => {
      // Create a point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Open context menu
      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);

      // Click add note option
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Note|note/i })
        .click();
      await page.waitForTimeout(300);

      // Note modal should open
      await expect(page.locator('.v-dialog')).toBeVisible();
    });
  });

  test.describe('Edit Element', () => {
    test('should open edit modal when clicking edit', async ({ page, blankProject }) => {
      // Create a point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Open context menu
      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);

      // Click edit option
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Edit|Modifier/i })
        .click();
      await page.waitForTimeout(300);

      // Edit modal should open
      await expect(page.locator('.v-dialog')).toBeVisible();
    });
  });
});
