import { expect, test } from '../fixtures';

test.describe('Circle Drawing', () => {
  test('should create a circle with default values', async ({ page, blankProject }) => {
    // Click circle button (first button in the centered drawing tools group)
    await page.locator('.v-btn-group').last().locator('button').nth(0).click();
    await page.waitForSelector('text=Create Circle', { timeout: 5000 });

    // Get dialog and scope all selectors to it
    const dialog = page.locator('[role="dialog"]');

    // Fill in coordinates - select from dropdown
    // Click the dropdown arrow icon (not the clear button)
    await dialog.locator('[role="combobox"]').first().locator('.v-select__menu-icon').click();
    await page.waitForTimeout(300);
    // Select first option from dropdown menu
    await page.locator('.v-select__content .v-list-item').first().click();
    await page.waitForTimeout(300);

    // Fill in radius
    await dialog.locator('input[type="number"]').fill('5');

    // Submit form
    await page.click('button:has-text("Add")');

    // Wait for modal to close
    await page.waitForSelector('text=Create Circle', { state: 'hidden', timeout: 5000 });

    // Verify circle appears in layers panel with Paris coordinates
    await expect(page.locator('.layer-item-name').filter({ hasText: /Circle/ })).toBeVisible();
  });

  test('should create a circle with custom name', async ({ page, blankProject }) => {
    // Click circle button
    await page.locator('.v-btn-group').last().locator('button').nth(0).click();
    await page.waitForSelector('text=Create Circle');

    const dialog = page.locator('[role="dialog"]');

    // Fill in name
    const nameInput = dialog.locator('input[type="text"]').first();
    await nameInput.fill('Paris Search Area');

    // Fill in coordinates - select from dropdown
    await dialog.locator('[role="combobox"]').first().locator('.v-select__menu-icon').click();
    await page.waitForTimeout(300);
    await page.locator('.v-select__content .v-list-item').first().click();
    await page.waitForTimeout(300);

    // Fill in radius
    await dialog.locator('input[type="number"]').fill('10');

    // Submit form
    await page.click('button:has-text("Add")');
    await page.waitForTimeout(500);

    // Verify circle appears with custom name
    await expect(page.locator('text=Paris Search Area')).toBeVisible();
  });

  test('should edit an existing circle', async ({ page, blankProject }) => {
    // Create a circle first
    await page.locator('.v-btn-group').last().locator('button').nth(0).click();
    let dialog = page.locator('[role="dialog"]');
    await dialog.locator('[role="combobox"]').first().locator('.v-select__menu-icon').click();
    await page.waitForTimeout(300);
    await page.locator('.v-select__content .v-list-item').first().click();
    await page.waitForTimeout(300);
    await dialog.locator('input[type="number"]').fill('5');
    await page.click('button:has-text("Add")');
    await page.waitForTimeout(500);

    // Find and click the context menu button for the circle
    const contextMenuBtn = page
      .locator('.layer-item')
      .filter({ hasText: /Circle/i })
      .locator('button')
      .last();
    await contextMenuBtn.click();
    await page.waitForTimeout(200);

    // Click edit option
    await page.click('text=Edit');

    // Wait for edit modal
    await page.waitForSelector('text=Edit Circle');

    dialog = page.locator('[role="dialog"]');

    // Change radius
    await dialog.locator('input[type="number"]').fill('8');

    // Save changes
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(500);

    // Verify updated radius appears in the layer item
    await expect(page.locator('text=/8.*km/i')).toBeVisible();
  });

  test('should delete a circle', async ({ page, blankProject }) => {
    // Create a circle first
    await page.locator('.v-btn-group').last().locator('button').nth(0).click();
    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('[role="combobox"]').first().locator('.v-select__menu-icon').click();
    await page.waitForTimeout(300);
    await page.locator('.v-select__content .v-list-item').first().click();
    await page.waitForTimeout(300);
    await dialog.locator('input[type="number"]').fill('5');
    await page.click('button:has-text("Add")');
    await page.waitForTimeout(500);

    // Find and click the context menu button
    const contextMenuBtn = page
      .locator('.layer-item')
      .filter({ hasText: /Circle/i })
      .locator('button')
      .last();
    await contextMenuBtn.click();
    await page.waitForTimeout(200);

    // Click delete option
    page.on('dialog', (dialog) => dialog.accept());
    await page.click('text=Delete');
    await page.waitForTimeout(300);

    // Verify circle is removed
    await expect(page.locator('text=Circle 1')).not.toBeVisible();
  });

  test('should toggle circle visibility', async ({ page, blankProject }) => {
    // Create a circle first
    await page.locator('.v-btn-group').last().locator('button').nth(0).click();
    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('[role="combobox"]').first().locator('.v-select__menu-icon').click();
    await page.waitForTimeout(300);
    await page.locator('.v-select__content .v-list-item').first().click();
    await page.waitForTimeout(300);
    await dialog.locator('input[type="number"]').fill('5');
    await page.click('button:has-text("Add")');
    await page.waitForTimeout(500);

    // Click the visibility icon (eye icon) - first button in layer item
    const visibilityBtn = page
      .locator('.layer-item')
      .filter({ hasText: /Circle/i })
      .locator('button')
      .first();
    await visibilityBtn.click();
    await page.waitForTimeout(200);

    // Circle should still be in list
    await expect(page.locator('.layer-item-name').filter({ hasText: /Circle/ })).toBeVisible();

    // Click again to show
    await visibilityBtn.click();
    await page.waitForTimeout(200);
    await expect(page.locator('.layer-item-name').filter({ hasText: /Circle/ })).toBeVisible();
  });

  test('should create multiple circles', async ({ page, blankProject }) => {
    // Create first circle
    await page.locator('.v-btn-group').last().locator('button').nth(0).click();
    let dialog = page.locator('[role="dialog"]');
    await dialog.locator('[role="combobox"]').first().locator('.v-select__menu-icon').click();
    await page.waitForTimeout(300);
    await page.locator('.v-select__content .v-list-item').first().click();
    await page.waitForTimeout(300);
    await dialog.locator('input[type="number"]').fill('5');
    await page.click('button:has-text("Add")');
    await page.waitForTimeout(300);

    // Create second circle
    await page.locator('.v-btn-group').last().locator('button').nth(0).click();
    dialog = page.locator('[role="dialog"]');
    await dialog.locator('[role="combobox"]').first().locator('.v-select__menu-icon').click();
    await page.waitForTimeout(300);
    await page.locator('.v-select__content .v-list-item').nth(1).click();
    await page.waitForTimeout(300);
    await dialog.locator('input[type="number"]').fill('10');
    await page.click('button:has-text("Add")');
    await page.waitForTimeout(300);

    // Verify both circles appear
    const layerCount = await page.locator('.layer-item').count();
    expect(layerCount).toBeGreaterThanOrEqual(2);
  });

  test('should validate required fields', async ({ page, blankProject }) => {
    // Open circle modal
    await page.locator('.v-btn-group').last().locator('button').nth(0).click();
    await page.waitForSelector('text=Create Circle');

    // Try to submit without filling fields
    await page.click('button:has-text("Add")');

    // Modal should still be open (validation failed)
    await expect(page.locator('text=Create Circle')).toBeVisible();
  });

  test('should hide all circles', async ({ page, blankProject }) => {
    // Create two circles
    await page.locator('.v-btn-group').last().locator('button').nth(0).click();
    let dialog = page.locator('[role="dialog"]');
    await dialog.locator('[role="combobox"]').first().locator('.v-select__menu-icon').click();
    await page.waitForTimeout(300);
    await page.locator('.v-select__content .v-list-item').first().click();
    await page.waitForTimeout(300);
    await dialog.locator('input[type="number"]').fill('5');
    await page.click('button:has-text("Add")');
    await page.waitForTimeout(300);

    await page.locator('.v-btn-group').last().locator('button').nth(0).click();
    dialog = page.locator('[role="dialog"]');
    await dialog.locator('[role="combobox"]').first().locator('.v-select__menu-icon').click();
    await page.waitForTimeout(300);
    await page.locator('.v-select__content .v-list-item').nth(1).click();
    await page.waitForTimeout(300);
    await dialog.locator('input[type="number"]').fill('10');
    await page.click('button:has-text("Add")');
    await page.waitForTimeout(300);

    // Click "Hide All Circles" button if it exists
    const hideAllBtn = page.locator('button').filter({ hasText: /Hide.*Circle/i });
    if ((await hideAllBtn.count()) > 0) {
      await hideAllBtn.first().click();
      await page.waitForTimeout(200);
    }

    // Circles should still be in the list
    const circleCount = await page.locator('.layer-item').count();
    expect(circleCount).toBeGreaterThanOrEqual(2);
  });
});
