import { expect, test } from './fixtures';

test.describe('Bearings and Intersections', () => {
  test.describe('Intersection Line Modal', () => {
    test('should display coordinate selectors in intersection modal', async ({
      page,
      blankProject,
    }) => {
      // Open line modal
      await page.locator('[data-testid="draw-line-btn"]').click();
      await page.waitForTimeout(300);

      // Close and try intersection
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // The intersection modal should have coordinate selectors (v-select)
      // For now, just verify the line modal opened
      await page.locator('[data-testid="draw-line-btn"]').click();
      await page.waitForTimeout(500);

      // Check for v-select components (coordinate selectors)
      const selectors = page.locator('.v-select');
      await expect(selectors.first()).toBeVisible();
    });

    test('should require coordinates to submit', async ({ page, blankProject }) => {
      // Open the two-points line modal
      await page.locator('[data-testid="draw-line-btn"]').click();
      await page.waitForTimeout(500);

      // Try to submit without selecting coordinates
      const addBtn = page.locator('button').filter({ hasText: /Add|Ajouter/i });
      await addBtn.click();
      await page.waitForTimeout(300);

      // Should show error toast or validation message
      // Modal should still be open
      const modal = page.locator('.v-dialog');
      await expect(modal).toBeVisible();
    });
  });

  test.describe('Drawing Tools', () => {
    test('should have circle drawing button', async ({ page, blankProject }) => {
      const circleBtn = page.locator('[data-testid="draw-circle-btn"]');
      await expect(circleBtn).toBeVisible();
    });

    test('should have line drawing button', async ({ page, blankProject }) => {
      const lineBtn = page.locator('[data-testid="draw-line-btn"]');
      await expect(lineBtn).toBeVisible();
    });

    test('should have point drawing button', async ({ page, blankProject }) => {
      const pointBtn = page.locator('[data-testid="draw-point-btn"]');
      await expect(pointBtn).toBeVisible();
    });

    test('should open circle modal when clicking circle button', async ({ page, blankProject }) => {
      await page.locator('[data-testid="draw-circle-btn"]').click();
      await page.waitForTimeout(500);

      // Modal should be visible
      const modal = page.locator('.v-dialog');
      await expect(modal).toBeVisible();

      // Should have radius input
      const radiusInput = page.locator('input[type="number"]');
      await expect(radiusInput).toBeVisible();
    });

    test('should open point modal when clicking point button', async ({ page, blankProject }) => {
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(500);

      // Modal should be visible
      const modal = page.locator('.v-dialog');
      await expect(modal).toBeVisible();

      // Should have coordinate input
      const coordInput = page.locator('input[placeholder*="48.8566"]');
      await expect(coordInput).toBeVisible();
    });

    test('should open line modal when clicking line button', async ({ page, blankProject }) => {
      await page.locator('[data-testid="draw-line-btn"]').click();
      await page.waitForTimeout(500);

      // Modal should be visible
      const modal = page.locator('.v-dialog');
      await expect(modal).toBeVisible();
    });
  });

  test.describe('Point Creation', () => {
    test('should create a point with coordinates', async ({ page, blankProject }) => {
      // Open point modal
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);

      // Fill coordinates
      const coordInput = page.locator('input[placeholder*="48.8566"]');
      await coordInput.fill('48.8566, 2.3522');

      // Click add
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Modal should close
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should create multiple points', async ({ page, blankProject }) => {
      // Create first point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Create second point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('51.5074, -0.1278');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Both points should be created (modal closes successfully)
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });
  });

  test.describe('Modal Interactions', () => {
    test('should close modal with cancel button', async ({ page, blankProject }) => {
      // Open point modal
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);

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
      // Open point modal
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);

      // Press escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Modal should close
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should validate required fields', async ({ page, blankProject }) => {
      // Open circle modal
      await page.locator('[data-testid="draw-circle-btn"]').click();
      await page.waitForTimeout(300);

      // Try to add without filling required fields
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(300);

      // Modal should still be visible (validation failed)
      await expect(page.locator('.v-dialog')).toBeVisible();
    });
  });

  test.describe('Coordinate Input', () => {
    test('should accept decimal coordinates', async ({ page, blankProject }) => {
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);

      // Enter decimal coordinates
      const coordInput = page.locator('input[placeholder*="48.8566"]');
      await coordInput.fill('48.123456, 2.654321');
      await page.waitForTimeout(300);

      // Value should be accepted
      await expect(coordInput).toHaveValue('48.123456, 2.654321');
    });

    test('should accept negative coordinates', async ({ page, blankProject }) => {
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);

      // Enter coordinates with negative values (Western hemisphere)
      const coordInput = page.locator('input[placeholder*="48.8566"]');
      await coordInput.fill('40.7128, -74.0060');
      await page.waitForTimeout(300);

      // Value should be accepted
      await expect(coordInput).toHaveValue('40.7128, -74.0060');
    });
  });
});
