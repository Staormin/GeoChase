import { expect, test } from './fixtures';

test.describe('Search Along Path', () => {
  test.describe('Opening Search Panel', () => {
    test('should open search panel from point context menu', async ({ page, blankProject }) => {
      // Create a point first
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Open context menu on the point (3 dots button)
      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);

      // Click "Location near" option
      const locationNearOption = page
        .locator('.v-list-item')
        .filter({ hasText: /Location near|Rechercher/i });
      await locationNearOption.click();
      await page.waitForTimeout(1000);

      // Search panel should be visible (Results header)
      await expect(
        page.locator('.text-subtitle-2').filter({ hasText: /Results|Résultats/i })
      ).toBeVisible();
    });
  });

  test.describe('Search Panel UI', () => {
    test('should display back button', async ({ page, blankProject }) => {
      // Create a point and open search panel
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);

      const locationNearOption = page
        .locator('.v-list-item')
        .filter({ hasText: /Location near|Rechercher/i });
      await locationNearOption.click();
      await page.waitForTimeout(1000);

      // Back button should be visible
      await expect(page.locator('button .mdi-arrow-left').locator('..')).toBeVisible();
    });

    test('should close search panel with back button', async ({ page, blankProject }) => {
      // Create a point and open search panel
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);

      const locationNearOption = page
        .locator('.v-list-item')
        .filter({ hasText: /Location near|Rechercher/i });
      await locationNearOption.click();
      await page.waitForTimeout(1000);

      // Click back button
      await page.locator('button .mdi-arrow-left').locator('..').click();
      await page.waitForTimeout(500);

      // Search panel should be closed (Results text should not be visible)
      await expect(
        page.locator('.text-subtitle-2').filter({ hasText: /Results|Résultats/i })
      ).not.toBeVisible();
    });
  });

  test.describe('Search Results', () => {
    test('should show search panel after triggering search', async ({ page, blankProject }) => {
      // Create a point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);

      const locationNearOption = page
        .locator('.v-list-item')
        .filter({ hasText: /Location near|Rechercher/i });
      await locationNearOption.click();
      await page.waitForTimeout(2000);

      // Search panel should remain visible after triggering search
      await expect(
        page.locator('.text-subtitle-2').filter({ hasText: /Results|Résultats/i })
      ).toBeVisible();
    });

    test('should display search panel content area', async ({ page, blankProject }) => {
      // Create a point in Paris (likely to have results)
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);

      const locationNearOption = page
        .locator('.v-list-item')
        .filter({ hasText: /Location near|Rechercher/i });
      await locationNearOption.click();
      await page.waitForTimeout(3000);

      // Wait for search to complete - panel should have content
      await expect(
        page.locator('.text-subtitle-2').filter({ hasText: /Results|Résultats/i })
      ).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('Filter Interactions', () => {
    test('should have text filter input', async ({ page, blankProject }) => {
      // Create a point and open search panel
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);

      const locationNearOption = page
        .locator('.v-list-item')
        .filter({ hasText: /Location near|Rechercher/i });
      await locationNearOption.click();
      await page.waitForTimeout(2000);

      // Text filter input should be visible
      const filterInputs = page.locator('.v-text-field input');
      await expect(filterInputs.first()).toBeVisible();
    });

    test('should have filter controls visible', async ({ page, blankProject }) => {
      // Create a point and open search panel
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);

      const locationNearOption = page
        .locator('.v-list-item')
        .filter({ hasText: /Location near|Rechercher/i });
      await locationNearOption.click();
      await page.waitForTimeout(2000);

      // Search panel header should be visible
      await expect(
        page.locator('.text-subtitle-2').filter({ hasText: /Results|Résultats/i })
      ).toBeVisible();

      // There should be some form inputs visible
      const inputs = page.locator('input');
      await expect(inputs.first()).toBeVisible();
    });
  });
});
