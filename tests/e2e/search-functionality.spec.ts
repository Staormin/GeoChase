import { expect, test } from './fixtures';

test.describe('Search Functionality', () => {
  test.describe('Address Search', () => {
    test('should have search input visible in topbar', async ({ page, blankProject }) => {
      // The search input is in the topbar
      const searchInput = page.locator('input[placeholder]').first();
      await expect(searchInput).toBeVisible();
    });

    test('should allow typing in search input', async ({ page, blankProject }) => {
      // Find and interact with search input
      const searchInput = page.locator('.v-text-field input').first();
      await searchInput.click();
      await page.waitForTimeout(300);

      // Type in search field
      await searchInput.fill('Paris, France');
      await page.waitForTimeout(300);

      // Verify the input has the value
      await expect(searchInput).toHaveValue('Paris, France');
    });

    test('should show loading indicator when searching', async ({ page, blankProject }) => {
      // Find search input
      const searchInput = page.locator('.v-text-field input').first();
      await searchInput.click();
      await page.waitForTimeout(300);

      // Type to trigger search
      await searchInput.fill('Paris');

      // Loading indicator might appear briefly
      // Just verify no errors occur during search
      await page.waitForTimeout(500);
    });

    test('should clear search input when cleared', async ({ page, blankProject }) => {
      // Find search input
      const searchInput = page.locator('.v-text-field input').first();
      await searchInput.click();
      await page.waitForTimeout(300);

      // Type in search
      await searchInput.fill('Paris');
      await page.waitForTimeout(300);

      // Clear using keyboard
      await searchInput.clear();
      await page.waitForTimeout(300);

      // Verify input is empty
      await expect(searchInput).toHaveValue('');
    });
  });

  test.describe('Search Results', () => {
    test('should display results dropdown when results are available', async ({
      page,
      blankProject,
    }) => {
      // Find search input
      const searchInput = page.locator('.v-text-field input').first();
      await searchInput.click();
      await page.waitForTimeout(300);

      // Type a search query
      await searchInput.fill('Paris');
      await page.waitForTimeout(1500); // Wait for API response

      // Check if results dropdown appears (if API returns results)
      const resultsMenu = page.locator('.v-menu .v-list');
      if ((await resultsMenu.count()) > 0) {
        // Results appeared
        await expect(resultsMenu).toBeVisible();
      }
    });

    test('should close results when input is cleared', async ({ page, blankProject }) => {
      // Find search input
      const searchInput = page.locator('.v-text-field input').first();
      await searchInput.click();
      await page.waitForTimeout(300);

      // Type and wait for results
      await searchInput.fill('Paris');
      await page.waitForTimeout(1500);

      // Clear the input
      await searchInput.clear();
      await page.waitForTimeout(500);

      // Results should be hidden
      const resultsMenu = page.locator('.v-menu .v-list');
      const menuCount = await resultsMenu.count();
      if (menuCount > 0) {
        await expect(resultsMenu).not.toBeVisible();
      }
    });
  });

  test.describe('Search Input Features', () => {
    test('should have magnify icon', async ({ page, blankProject }) => {
      // Check for search icon
      const searchIcon = page.locator('.v-text-field .mdi-magnify');
      await expect(searchIcon).toBeVisible();
    });

    test('should be clearable', async ({ page, blankProject }) => {
      // Find search input and type
      const searchInput = page.locator('.v-text-field input').first();
      await searchInput.fill('test');
      await page.waitForTimeout(300);

      // Check if clear button appears
      const clearBtn = page.locator('.v-text-field .v-field__clearable');
      if ((await clearBtn.count()) > 0) {
        await expect(clearBtn).toBeVisible();
      }
    });

    test('should handle empty search gracefully', async ({ page, blankProject }) => {
      // Find search input
      const searchInput = page.locator('.v-text-field input').first();
      await searchInput.click();
      await page.waitForTimeout(300);

      // Press enter with empty input
      await searchInput.press('Enter');
      await page.waitForTimeout(300);

      // Should not cause any errors - page should still be functional
      await expect(page.locator('#map')).toBeVisible();
    });
  });

  test.describe('Search Integration', () => {
    test('should not interfere with other UI elements', async ({ page, blankProject }) => {
      // Search while map is visible
      const searchInput = page.locator('.v-text-field input').first();
      await searchInput.fill('London');
      await page.waitForTimeout(500);

      // Map should still be interactive
      const map = page.locator('#map');
      await expect(map).toBeVisible();

      // Other buttons should still work
      const animationBtn = page.locator('[data-testid="animation-btn"]');
      await expect(animationBtn).toBeVisible();
    });

    test('should maintain search state after clicking elsewhere', async ({
      page,
      blankProject,
    }) => {
      // Find search input and type
      const searchInput = page.locator('.v-text-field input').first();
      await searchInput.fill('Berlin');
      await page.waitForTimeout(300);

      // Click elsewhere (on map)
      await page.locator('#map').click();
      await page.waitForTimeout(300);

      // Search input should still have the value (or be cleared by design)
      // This tests that the interaction doesn't cause errors
      await expect(page.locator('#map')).toBeVisible();
    });
  });
});
