import { expect, test } from '../fixtures';

test.describe('Line Drawing', () => {
  test.describe('Two Points Line', () => {
    test('should create a line between two points', async ({ page, blankProject }) => {
      // Click two-points line button (button index 1 in drawing tools)
      await page.locator('.v-btn-group').last().locator('button').nth(1).click();
      await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5000 });

      const dialog = page.locator('[role="dialog"]');

      // Fill in start point using combobox
      await dialog.locator('[role="combobox"]').first().locator('.v-select__menu-icon').click();
      await page.waitForTimeout(300);
      await page.locator('.v-select__content .v-list-item').first().click();
      // Wait for dropdown overlay to disappear and dialog to stabilize
      await page.locator('.v-select__content').waitFor({ state: 'hidden', timeout: 5000 });
      await page.waitForTimeout(500);

      // Fill in end point using second combobox (use .last() to get the actual end field)
      await dialog.locator('[role="combobox"]').last().waitFor({ state: 'visible', timeout: 5000 });
      await dialog.locator('[role="combobox"]').last().click({ force: true });
      await page.waitForTimeout(300);
      await page.locator('.v-select__content .v-list-item').nth(1).click();
      await page.waitForTimeout(300);

      // Submit form
      await page.click('button:has-text("Add")');
      await page.waitForTimeout(500);

      // Verify line appears in layers panel
      await expect(page.locator('.layer-item').filter({ hasText: /Line/i })).toBeVisible();
    });

    test('should create a line with custom name', async ({ page, blankProject }) => {
      // Click two-points line button (button index 1 in drawing tools)
      await page.locator('.v-btn-group').last().locator('button').nth(1).click();
      await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5000 });

      const dialog = page.locator('[role="dialog"]');

      // Fill in name (first text input)
      const nameInput = dialog.locator('input[type="text"]').first();
      await nameInput.pressSequentially('Paris to London');

      // Fill in start coordinates
      await dialog.locator('[role="combobox"]').first().locator('.v-select__menu-icon').click();
      await page.waitForTimeout(300);
      await page.locator('.v-select__content .v-list-item').first().click();
      // Wait for dropdown overlay to disappear and dialog to stabilize
      await page.locator('.v-select__content').waitFor({ state: 'hidden', timeout: 5000 });
      await page.waitForTimeout(500);

      // Fill in end coordinates (use .last() to get the actual end field)
      await dialog.locator('[role="combobox"]').last().waitFor({ state: 'visible', timeout: 5000 });
      await dialog.locator('[role="combobox"]').last().click({ force: true });
      await page.waitForTimeout(300);
      await page.locator('.v-select__content .v-list-item').nth(1).click();
      await page.waitForTimeout(300);

      // Submit form
      await page.click('button:has-text("Add")');
      await page.waitForTimeout(500);

      // Verify line appears with custom name
      await expect(
        page.locator('.layer-item-name').filter({ hasText: /Paris to London/i })
      ).toBeVisible();
    });
  });

  test.describe('Azimuth Line', () => {
    test('should create a line with azimuth and distance', async ({ page, blankProject }) => {
      // Click azimuth line button (button index 2 in drawing tools)
      await page.locator('.v-btn-group').last().locator('button').nth(2).click();
      await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5000 });

      const dialog = page.locator('[role="dialog"]');

      // Fill in start point using combobox
      await dialog.locator('[role="combobox"]').first().locator('.v-select__menu-icon').click();
      await page.waitForTimeout(300);
      await page.locator('.v-select__content .v-list-item').first().click();
      // Wait for dropdown overlay to disappear before clicking next dropdown
      await page.locator('.v-select__content').waitFor({ state: 'hidden', timeout: 5000 });

      // Fill in azimuth (first number field)
      await dialog.locator('input[type="number"]').first().pressSequentially('45');

      // Fill in distance (second number field)
      await dialog.locator('input[type="number"]').nth(1).pressSequentially('100');

      // Submit form
      await page.click('button:has-text("Add")');
      await page.waitForTimeout(500);

      // Verify line appears in layers panel (azimuth lines have descriptive names like "From Paris 45°")
      await expect(
        page.locator('.layer-item-name').filter({ hasText: /From Paris/i })
      ).toBeVisible();
    });

    test('should create azimuth line with custom name', async ({ page, blankProject }) => {
      // Click azimuth line button (button index 2 in drawing tools)
      await page.locator('.v-btn-group').last().locator('button').nth(2).click();
      await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5000 });

      const dialog = page.locator('[role="dialog"]');

      // Fill in name (first text input)
      const nameInput = dialog.locator('input[type="text"]').first();
      await nameInput.pressSequentially('Northeast Path');

      // Fill in start point
      await dialog.locator('[role="combobox"]').first().locator('.v-select__menu-icon').click();
      await page.waitForTimeout(300);
      await page.locator('.v-select__content .v-list-item').first().click();
      // Wait for dropdown overlay to disappear before clicking next dropdown
      await page.locator('.v-select__content').waitFor({ state: 'hidden', timeout: 5000 });

      // Fill in azimuth
      await dialog.locator('input[type="number"]').first().pressSequentially('45');

      // Fill in distance
      await dialog.locator('input[type="number"]').nth(1).pressSequentially('50');

      // Submit form
      await page.click('button:has-text("Add")');
      await page.waitForTimeout(500);

      // Verify line appears with custom name
      await expect(page.locator('text=Northeast Path')).toBeVisible();
    });
  });

  test.describe('Parallel Line', () => {
    test('should create a parallel line at specific latitude', async ({ page, blankProject }) => {
      // Click parallel line button (button index 4 in drawing tools)
      await page.locator('.v-btn-group').last().locator('button').nth(4).click();
      await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5000 });

      const dialog = page.locator('[role="dialog"]');

      // Fill in latitude using combobox
      await dialog.locator('[role="combobox"]').first().locator('.v-select__menu-icon').click();
      await page.waitForTimeout(300);
      await page.locator('.v-select__content .v-list-item').first().click();
      // Wait for dropdown overlay to disappear before clicking next dropdown
      await page.locator('.v-select__content').waitFor({ state: 'hidden', timeout: 5000 });

      // Submit form
      await page.click('button:has-text("Add")');
      await page.waitForTimeout(500);

      // Verify line appears in layers panel
      await expect(page.locator('.layer-item-name').filter({ hasText: /Parallel/i })).toBeVisible();
    });
  });

  test.describe('Line Management', () => {
    test('should delete a line', async ({ page, blankProject }) => {
      // Create a line first
      await page.locator('.v-btn-group').last().locator('button').nth(1).click();
      const dialog = page.locator('[role="dialog"]');
      await dialog.locator('[role="combobox"]').first().locator('.v-select__menu-icon').click();
      await page.waitForTimeout(300);
      await page.locator('.v-select__content .v-list-item').first().click();
      // Wait for dropdown overlay to disappear before clicking next dropdown
      await page.locator('.v-select__content').waitFor({ state: 'hidden', timeout: 5000 });
      await dialog.locator('[role="combobox"]').last().waitFor({ state: 'visible', timeout: 5000 });
      await dialog.locator('[role="combobox"]').last().click({ force: true });
      await page.waitForTimeout(300);
      await page.locator('.v-select__content .v-list-item').nth(1).click();
      await page.waitForTimeout(300);
      await page.click('button:has-text("Add")');
      await page.waitForTimeout(500);

      // Find and click the context menu button
      const contextMenuBtn = page.locator('.layer-item').locator('button').last();
      await contextMenuBtn.click();
      await page.waitForTimeout(200);

      // Click delete option
      page.on('dialog', (dialog) => dialog.accept());
      await page.click('text=Delete');
      await page.waitForTimeout(300);

      // Verify line is removed
      await expect(page.locator('.layer-item')).toHaveCount(0);
    });

    test('should toggle line visibility', async ({ page, blankProject }) => {
      // Create a line first
      await page.locator('.v-btn-group').last().locator('button').nth(1).click();
      const dialog = page.locator('[role="dialog"]');
      await dialog.locator('[role="combobox"]').first().locator('.v-select__menu-icon').click();
      await page.waitForTimeout(300);
      await page.locator('.v-select__content .v-list-item').first().click();
      // Wait for dropdown overlay to disappear before clicking next dropdown
      await page.locator('.v-select__content').waitFor({ state: 'hidden', timeout: 5000 });
      await dialog.locator('[role="combobox"]').last().waitFor({ state: 'visible', timeout: 5000 });
      await dialog.locator('[role="combobox"]').last().click({ force: true });
      await page.waitForTimeout(300);
      await page.locator('.v-select__content .v-list-item').nth(1).click();
      await page.waitForTimeout(300);
      await page.click('button:has-text("Add")');
      await page.waitForTimeout(500);

      // Click the visibility icon (first button in layer item)
      const visibilityBtn = page.locator('.layer-item').locator('button').first();
      await visibilityBtn.click();
      await page.waitForTimeout(200);

      // Line should still be in list
      await expect(page.locator('.layer-item').filter({ hasText: /Line/i })).toBeVisible();

      // Click again to show
      await visibilityBtn.click();
      await page.waitForTimeout(200);
      await expect(page.locator('.layer-item').filter({ hasText: /Line/i })).toBeVisible();
    });

    test('should create multiple lines', async ({ page, blankProject }) => {
      // Create first line (two-points)
      await page.locator('.v-btn-group').last().locator('button').nth(1).click();
      await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5000 });

      let dialog = page.locator('[role="dialog"]');

      // Select start coordinate from dropdown
      await dialog.locator('[role="combobox"]').first().locator('.v-select__menu-icon').click();
      await page.waitForTimeout(300);
      await page.locator('.v-select__content .v-list-item').first().click();
      // Wait for dropdown overlay to disappear before clicking next dropdown
      await page.locator('.v-select__content').waitFor({ state: 'hidden', timeout: 5000 });

      // Select end coordinate from dropdown
      await dialog.locator('[role="combobox"]').last().waitFor({ state: 'visible', timeout: 5000 });
      await dialog.locator('[role="combobox"]').last().click({ force: true });
      await page.waitForTimeout(300);
      await page.locator('.v-select__content .v-list-item').nth(1).click();
      await page.waitForTimeout(300);

      await page.click('button:has-text("Add")');
      await page.waitForTimeout(500);

      // Create second line (azimuth)
      await page.locator('.v-btn-group').last().locator('button').nth(2).click();
      await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5000 });

      dialog = page.locator('[role="dialog"]');
      await dialog.locator('[role="combobox"]').first().locator('.v-select__menu-icon').click();
      await page.waitForTimeout(300);
      await page.locator('.v-select__content .v-list-item').first().click();
      // Wait for dropdown overlay to disappear before clicking next dropdown
      await page.locator('.v-select__content').waitFor({ state: 'hidden', timeout: 5000 });
      await dialog.locator('input[type="number"]').first().fill('90');
      await dialog.locator('input[type="number"]').nth(1).fill('100');
      await page.click('button:has-text("Add")');
      await page.waitForTimeout(500);

      // Verify both lines appear
      const lineCount = await page.locator('.layer-item').count();
      expect(lineCount).toBeGreaterThanOrEqual(2);
    });
  });
});
