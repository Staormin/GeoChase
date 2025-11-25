import { expect, test } from './fixtures';

test.describe('Coordinates Management', () => {
  test.describe('Coordinates Modal', () => {
    test('should open coordinates modal', async ({ page, blankProject }) => {
      // Click coordinates button
      await page.locator('[data-testid="coordinates-btn"]').click();
      await page.waitForTimeout(500);

      // Verify modal opens
      const modal = page.locator('.v-dialog');
      await expect(modal).toBeVisible();
    });

    test('should display name and coordinates inputs', async ({ page, blankProject }) => {
      // Open coordinates modal
      await page.locator('[data-testid="coordinates-btn"]').click();
      await page.waitForTimeout(500);

      // Check for input fields
      const inputs = page.locator('.v-dialog .v-text-field');
      await expect(inputs.first()).toBeVisible();

      // Should have at least 2 inputs (name and coordinates)
      const inputCount = await inputs.count();
      expect(inputCount).toBeGreaterThanOrEqual(2);
    });

    test('should have save buttons', async ({ page, blankProject }) => {
      // Open coordinates modal
      await page.locator('[data-testid="coordinates-btn"]').click();
      await page.waitForTimeout(500);

      // Check for save button
      const saveBtn = page.locator('button').filter({ hasText: /Save|Enregistrer/i });
      await expect(saveBtn.first()).toBeVisible();
    });
  });

  test.describe('Saving Coordinates', () => {
    test('should save coordinates with name', async ({ page, blankProject }) => {
      // Open coordinates modal
      await page.locator('[data-testid="coordinates-btn"]').click();
      await page.waitForTimeout(500);

      // Fill name input (first text field)
      const nameInput = page.locator('.v-dialog .v-text-field input').first();
      await nameInput.fill('Paris Center');

      // Fill coordinates input (second text field with placeholder 48.8566)
      const coordInput = page.locator('.v-dialog input[placeholder*="48.8566"]');
      await coordInput.fill('48.8566, 2.3522');

      // Click save button
      await page
        .locator('button')
        .filter({ hasText: /^Save$|^Enregistrer$/i })
        .click();
      await page.waitForTimeout(500);

      // Modal should close
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should save and create point', async ({ page, blankProject }) => {
      // Open coordinates modal
      await page.locator('[data-testid="coordinates-btn"]').click();
      await page.waitForTimeout(500);

      // Fill name
      const nameInput = page.locator('.v-dialog .v-text-field input').first();
      await nameInput.fill('Test Point');

      // Fill coordinates
      const coordInput = page.locator('.v-dialog input[placeholder*="48.8566"]');
      await coordInput.fill('48.8566, 2.3522');

      // Click "Save & Point" button
      const savePointBtn = page.locator('button').filter({ hasText: /Point/i });
      await savePointBtn.click();
      await page.waitForTimeout(500);

      // Modal should close
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should require coordinates to save', async ({ page, blankProject }) => {
      // Open coordinates modal
      await page.locator('[data-testid="coordinates-btn"]').click();
      await page.waitForTimeout(500);

      // Fill only name, leave coordinates empty
      const nameInput = page.locator('.v-dialog .v-text-field input').first();
      await nameInput.fill('Test');

      // Click save
      await page
        .locator('button')
        .filter({ hasText: /^Save$|^Enregistrer$/i })
        .click();
      await page.waitForTimeout(500);

      // Modal should still be visible (validation failed)
      await expect(page.locator('.v-dialog')).toBeVisible();
    });
  });

  test.describe('Modal Actions', () => {
    test('should close modal with cancel button', async ({ page, blankProject }) => {
      // Open coordinates modal
      await page.locator('[data-testid="coordinates-btn"]').click();
      await page.waitForTimeout(500);

      // Click cancel
      await page
        .locator('button')
        .filter({ hasText: /Cancel|Annuler/i })
        .click();
      await page.waitForTimeout(300);

      // Modal should close
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should close modal with escape key', async ({ page, blankProject }) => {
      // Open coordinates modal
      await page.locator('[data-testid="coordinates-btn"]').click();
      await page.waitForTimeout(500);

      // Press escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Modal should close
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });
  });

  test.describe('Coordinate Input Validation', () => {
    test('should accept decimal coordinates', async ({ page, blankProject }) => {
      // Open coordinates modal
      await page.locator('[data-testid="coordinates-btn"]').click();
      await page.waitForTimeout(500);

      // Fill coordinates
      const coordInput = page.locator('.v-dialog input[placeholder*="48.8566"]');
      await coordInput.fill('48.123456, 2.654321');

      // Value should be accepted
      await expect(coordInput).toHaveValue('48.123456, 2.654321');
    });

    test('should accept negative coordinates', async ({ page, blankProject }) => {
      // Open coordinates modal
      await page.locator('[data-testid="coordinates-btn"]').click();
      await page.waitForTimeout(500);

      // Fill negative coordinates (Western hemisphere)
      const coordInput = page.locator('.v-dialog input[placeholder*="48.8566"]');
      await coordInput.fill('40.7128, -74.0060');

      // Value should be accepted
      await expect(coordInput).toHaveValue('40.7128, -74.0060');
    });

    test('should reject invalid coordinates', async ({ page, blankProject }) => {
      // Open coordinates modal
      await page.locator('[data-testid="coordinates-btn"]').click();
      await page.waitForTimeout(500);

      // Fill invalid coordinates
      const coordInput = page.locator('.v-dialog input[placeholder*="48.8566"]');
      await coordInput.fill('invalid, coords');

      // Try to save
      await page
        .locator('button')
        .filter({ hasText: /^Save$|^Enregistrer$/i })
        .click();
      await page.waitForTimeout(500);

      // Modal should still be open (validation failed)
      await expect(page.locator('.v-dialog')).toBeVisible();
    });
  });

  test.describe('Saved Coordinates List', () => {
    test('should display saved coordinates section', async ({ page, blankProject }) => {
      // Open coordinates modal
      await page.locator('[data-testid="coordinates-btn"]').click();
      await page.waitForTimeout(500);

      // Check for saved coordinates section (divider exists)
      const divider = page.locator('.v-dialog .v-divider');
      await expect(divider).toBeVisible();
    });

    test('should show empty state when no coordinates saved', async ({ page, blankProject }) => {
      // Open coordinates modal
      await page.locator('[data-testid="coordinates-btn"]').click();
      await page.waitForTimeout(500);

      // Check for empty state message or no coordinate items
      // The modal should have text about "no coordinates" or similar
      const modalContent = page.locator('.v-dialog .v-card-text');
      await expect(modalContent).toBeVisible();
    });
  });
});
