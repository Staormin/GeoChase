import { expect, test } from './fixtures';

// Helper to click the intersection button (has custom SVG icon, no mdi-* class)
async function clickIntersectionButton(page: any) {
  // The intersection button is the one with a custom SVG (not mdi-icon)
  // It's after compass-outline (azimuth) and before mdi-minus (parallel)
  // Click the button that contains an SVG with a circle element
  const intersectionBtn = page.locator('button:has(svg circle)').first();
  await intersectionBtn.click();
}

test.describe('Intersection Line', () => {
  test.describe('Intersection Line Modal', () => {
    test('should open intersection line modal', async ({ page, blankProject }) => {
      // Click the intersection line button
      await clickIntersectionButton(page);
      await page.waitForTimeout(300);

      // Verify modal is open
      const modal = page.locator('.v-dialog');
      await expect(modal).toBeVisible();

      // Verify modal title contains intersection
      await expect(
        page.locator('.v-card-title').filter({ hasText: /Intersection/i })
      ).toBeVisible();
    });

    test('should have coordinate selectors', async ({ page, blankProject }) => {
      // Open intersection line modal
      await clickIntersectionButton(page);
      await page.waitForTimeout(300);

      // Should have two coordinate selectors (start and intersection)
      const dialog = page.locator('.v-dialog');
      const selects = dialog.locator('[role="combobox"]');
      await expect(selects.first()).toBeVisible();

      // Should have at least 2 selects
      const count = await selects.count();
      expect(count).toBeGreaterThanOrEqual(2);
    });

    test('should have distance input', async ({ page, blankProject }) => {
      // Open intersection line modal
      await clickIntersectionButton(page);
      await page.waitForTimeout(300);

      // Should have distance input
      const dialog = page.locator('.v-dialog');
      const distanceInput = dialog.locator('input[type="number"]').first();
      await expect(distanceInput).toBeVisible();
    });

    test('should have name input', async ({ page, blankProject }) => {
      // Open intersection line modal
      await clickIntersectionButton(page);
      await page.waitForTimeout(300);

      // Should have name input (text field) - use first() to get the actual name input
      const dialog = page.locator('.v-dialog');
      const nameInput = dialog.locator('input[type="text"]').first();
      await expect(nameInput).toBeVisible();
    });

    test('should have create endpoint checkbox', async ({ page, blankProject }) => {
      // Open intersection line modal
      await clickIntersectionButton(page);
      await page.waitForTimeout(300);

      // Should have create endpoint checkbox
      const dialog = page.locator('.v-dialog');
      const checkbox = dialog.locator('.v-checkbox');
      await expect(checkbox).toBeVisible();
    });

    test('should close modal with cancel button', async ({ page, blankProject }) => {
      // Open intersection line modal
      await clickIntersectionButton(page);
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
      // Open intersection line modal
      await clickIntersectionButton(page);
      await page.waitForTimeout(300);

      // Press escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Modal should be closed
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });
  });

  test.describe('Creating Intersection Line', () => {
    test('should require both coordinates to submit', async ({ page, blankProject }) => {
      // Open intersection line modal
      await clickIntersectionButton(page);
      await page.waitForTimeout(300);

      // Try to add without selecting coordinates
      const addBtn = page.locator('button').filter({ hasText: /Add|Ajouter/i });
      await addBtn.click();
      await page.waitForTimeout(300);

      // Should show error toast or modal should still be open
      const modal = page.locator('.v-dialog');
      await expect(modal).toBeVisible();
    });

    test('should create intersection line with valid inputs', async ({ page, blankProject }) => {
      // Open intersection line modal
      await clickIntersectionButton(page);
      await page.waitForTimeout(300);

      const dialog = page.locator('.v-dialog');

      // Select start coordinate using the first select's menu icon
      await dialog.locator('.v-select').first().locator('.v-select__menu-icon').click();
      await page.waitForTimeout(300);
      await page.locator('.v-select__content .v-list-item').first().click();
      await page.locator('.v-select__content').waitFor({ state: 'hidden', timeout: 5000 });
      await page.waitForTimeout(300);

      // Select intersection coordinate using the second select
      await dialog.locator('.v-select').nth(1).click({ force: true });
      await page.waitForTimeout(300);
      await page.locator('.v-select__content .v-list-item').nth(1).click();
      await page.waitForTimeout(300);

      // Set distance (must be >= distance to intersection point)
      const distanceInput = dialog.locator('input[type="number"]').first();
      await distanceInput.fill('500');
      await page.waitForTimeout(300);

      // Click add
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Modal should close
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should show endpoint name field when checkbox is checked', async ({
      page,
      blankProject,
    }) => {
      // Open intersection line modal
      await clickIntersectionButton(page);
      await page.waitForTimeout(300);

      const dialog = page.locator('.v-dialog');

      // Checkbox should be visible
      const checkbox = dialog.locator('.v-checkbox');
      await expect(checkbox).toBeVisible();

      // Click the checkbox to enable endpoint creation
      await checkbox.click();
      await page.waitForTimeout(300);

      // Endpoint name field should now be visible
      // There should be 2 text inputs now (name + endpoint name)
      const textInputs = dialog.locator('input[type="text"]');
      const count = await textInputs.count();
      expect(count).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe('Coordinate Selection', () => {
    test('should show saved coordinates in dropdowns', async ({ page, blankProject }) => {
      // Open intersection line modal
      await clickIntersectionButton(page);
      await page.waitForTimeout(300);

      const dialog = page.locator('.v-dialog');

      // Open first dropdown
      const startSelect = dialog.locator('[role="combobox"]').first();
      await startSelect.locator('.v-select__menu-icon').click();
      await page.waitForTimeout(300);

      // Should show saved coordinates (Paris, London, Berlin from fixture)
      await expect(page.locator('.v-select__content .v-list-item').first()).toBeVisible();

      // Should have at least 3 options
      const itemCount = await page.locator('.v-select__content .v-list-item').count();
      expect(itemCount).toBeGreaterThanOrEqual(3);
    });

    test('should allow selecting different coordinates for start and intersection', async ({
      page,
      blankProject,
    }) => {
      // Open intersection line modal
      await clickIntersectionButton(page);
      await page.waitForTimeout(300);

      const dialog = page.locator('.v-dialog');

      // Select start coordinate (first option)
      await dialog.locator('.v-select').first().locator('.v-select__menu-icon').click();
      await page.waitForTimeout(300);
      await page.locator('.v-select__content .v-list-item').first().click();
      await page.locator('.v-select__content').waitFor({ state: 'hidden', timeout: 5000 });
      await page.waitForTimeout(300);

      // Select intersection coordinate (second option)
      await dialog.locator('.v-select').nth(1).click({ force: true });
      await page.waitForTimeout(300);
      await page.locator('.v-select__content .v-list-item').nth(1).click();
      await page.waitForTimeout(300);

      // Both selects should have values
      // Just verify no errors occurred and dialog is still open
      await expect(dialog).toBeVisible();
    });
  });
});
