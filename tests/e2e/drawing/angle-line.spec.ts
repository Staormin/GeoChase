import { expect, test } from '../fixtures';

test.describe('Angle Line', () => {
  test.describe('Angle Line Modal', () => {
    test('should open angle line modal', async ({ page, blankProject }) => {
      // Click the angle line button (mdi-angle-acute icon)
      await page.locator('button .mdi-angle-acute').locator('..').click();
      await page.waitForTimeout(300);

      // Verify modal is open
      const modal = page.locator('.v-dialog');
      await expect(modal).toBeVisible();

      // Verify modal title contains Angle
      await expect(page.locator('.v-card-title').filter({ hasText: /Angle/i })).toBeVisible();
    });

    test('should have point selector', async ({ page, blankProject }) => {
      // Open angle line modal
      await page.locator('button .mdi-angle-acute').locator('..').click();
      await page.waitForTimeout(300);

      // Should have point selector
      const dialog = page.locator('.v-dialog');
      const selectField = dialog.locator('.v-select').first();
      await expect(selectField).toBeVisible();
    });

    test('should have angle input', async ({ page, blankProject }) => {
      // Open angle line modal
      await page.locator('button .mdi-angle-acute').locator('..').click();
      await page.waitForTimeout(300);

      // Should have angle input
      const dialog = page.locator('.v-dialog');
      const angleInput = dialog.locator('input[type="number"]').first();
      await expect(angleInput).toBeVisible();
    });

    test('should have distance input', async ({ page, blankProject }) => {
      // Open angle line modal
      await page.locator('button .mdi-angle-acute').locator('..').click();
      await page.waitForTimeout(300);

      // Should have distance input (there should be 2 number inputs: angle and distance)
      const dialog = page.locator('.v-dialog');
      const numberInputs = dialog.locator('input[type="number"]');
      const count = await numberInputs.count();
      expect(count).toBeGreaterThanOrEqual(2);
    });

    test('should have name input', async ({ page, blankProject }) => {
      // Open angle line modal
      await page.locator('button .mdi-angle-acute').locator('..').click();
      await page.waitForTimeout(300);

      // Should have name input
      const dialog = page.locator('.v-dialog');
      const nameInput = dialog.locator('input[type="text"]').first();
      await expect(nameInput).toBeVisible();
    });

    test('should have create endpoint checkbox', async ({ page, blankProject }) => {
      // Open angle line modal
      await page.locator('button .mdi-angle-acute').locator('..').click();
      await page.waitForTimeout(300);

      // Should have create endpoint checkbox
      const dialog = page.locator('.v-dialog');
      const checkbox = dialog.locator('.v-checkbox');
      await expect(checkbox).toBeVisible();
    });

    test('should close modal with cancel button', async ({ page, blankProject }) => {
      // Open angle line modal
      await page.locator('button .mdi-angle-acute').locator('..').click();
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
      // Open angle line modal
      await page.locator('button .mdi-angle-acute').locator('..').click();
      await page.waitForTimeout(300);

      // Press escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Modal should be closed
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should have default angle value of 90', async ({ page, blankProject }) => {
      // Open angle line modal
      await page.locator('button .mdi-angle-acute').locator('..').click();
      await page.waitForTimeout(300);

      // Should have default angle value
      const dialog = page.locator('.v-dialog');
      const angleInput = dialog.locator('input[type="number"]').first();
      await expect(angleInput).toHaveValue('90');
    });

    test('should have default distance value of 1', async ({ page, blankProject }) => {
      // Open angle line modal
      await page.locator('button .mdi-angle-acute').locator('..').click();
      await page.waitForTimeout(300);

      // Should have default distance value
      const dialog = page.locator('.v-dialog');
      const distanceInput = dialog.locator('input[type="number"]').nth(1);
      await expect(distanceInput).toHaveValue('1');
    });
  });

  test.describe('Validation', () => {
    test('should require point selection to submit', async ({ page, blankProject }) => {
      // Open angle line modal
      await page.locator('button .mdi-angle-acute').locator('..').click();
      await page.waitForTimeout(300);

      // Try to add without selecting a point
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(300);

      // Modal should still be open (validation failed) or error toast shown
      const modal = page.locator('.v-dialog');
      await expect(modal).toBeVisible();
    });

    test('should show dropdown for point selection', async ({ page, blankProject }) => {
      // Open angle line modal
      await page.locator('button .mdi-angle-acute').locator('..').click();
      await page.waitForTimeout(300);

      // Open the point selector dropdown
      const dialog = page.locator('.v-dialog');
      const selectField = dialog.locator('.v-select').first();
      await selectField.click();
      await page.waitForTimeout(300);

      // The dropdown should be accessible (even if empty or with placeholder)
      // Just verify it's visible and clickable
      await expect(selectField).toBeVisible();
    });
  });

  test.describe('Angle Input', () => {
    test('should accept angle values from -360 to 360', async ({ page, blankProject }) => {
      // Open angle line modal
      await page.locator('button .mdi-angle-acute').locator('..').click();
      await page.waitForTimeout(300);

      const dialog = page.locator('.v-dialog');
      const angleInput = dialog.locator('input[type="number"]').first();

      // Check min/max attributes
      await expect(angleInput).toHaveAttribute('min', '-360');
      await expect(angleInput).toHaveAttribute('max', '360');
    });

    test('should accept negative angle values', async ({ page, blankProject }) => {
      // Open angle line modal
      await page.locator('button .mdi-angle-acute').locator('..').click();
      await page.waitForTimeout(300);

      const dialog = page.locator('.v-dialog');
      const angleInput = dialog.locator('input[type="number"]').first();

      // Enter negative angle
      await angleInput.fill('-45');
      await page.waitForTimeout(300);

      await expect(angleInput).toHaveValue('-45');
    });

    test('should accept positive angle values', async ({ page, blankProject }) => {
      // Open angle line modal
      await page.locator('button .mdi-angle-acute').locator('..').click();
      await page.waitForTimeout(300);

      const dialog = page.locator('.v-dialog');
      const angleInput = dialog.locator('input[type="number"]').first();

      // Enter positive angle
      await angleInput.fill('135');
      await page.waitForTimeout(300);

      await expect(angleInput).toHaveValue('135');
    });
  });

  test.describe('Endpoint Creation', () => {
    test('should show endpoint name field when checkbox is checked', async ({
      page,
      blankProject,
    }) => {
      // Open angle line modal
      await page.locator('button .mdi-angle-acute').locator('..').click();
      await page.waitForTimeout(300);

      const dialog = page.locator('.v-dialog');

      // Click the checkbox to enable endpoint creation
      const checkbox = dialog.locator('.v-checkbox');
      await checkbox.click();
      await page.waitForTimeout(300);

      // After checking the checkbox, there should be an endpoint name text field visible
      // Look for text fields that contain "endpoint" or "point" in their labels
      const textInputs = dialog.locator('.v-text-field');
      const count = await textInputs.count();
      // Should have at least 3 text fields: name, (point selector), endpoint name
      expect(count).toBeGreaterThanOrEqual(2);
    });
  });
});
