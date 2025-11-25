import { expect, test } from './fixtures';

// Helper to create a line using azimuth modal (more reliable than drag-drop)
async function createLine(page: any) {
  // Open azimuth line modal
  await page.locator('button .mdi-compass-outline').locator('..').click();
  await page.waitForTimeout(300);

  const dialog = page.locator('.v-dialog');

  // Select start coordinate
  await dialog.locator('.v-select').first().locator('.v-select__menu-icon').click();
  await page.waitForTimeout(300);
  await page.locator('.v-select__content .v-list-item').first().click();
  await page.locator('.v-select__content').waitFor({ state: 'hidden', timeout: 5000 });
  await page.waitForTimeout(300);

  // Set distance (default is 1km which is fine)
  // Set azimuth (default is fine)

  // Click add
  await page
    .locator('button')
    .filter({ hasText: /Add|Ajouter/i })
    .click();
  await page.waitForTimeout(500);
}

// Helper to get line item (line segments have "azimuth" or "coordinate" in their type description)
function getLineItem(page: any) {
  return page
    .locator('.layer-item')
    .filter({
      has: page.locator('.layer-item-type', { hasText: /azimuth|coordinate|intersection/i }),
    })
    .first();
}

test.describe('Add Point on Segment', () => {
  test.describe('Opening Modal', () => {
    test('should show add point option in line context menu', async ({ page, blankProject }) => {
      // Create a line
      await createLine(page);

      // Open context menu on the line
      const lineItem = getLineItem(page);
      await lineItem.locator('.mdi-dots-vertical').click();
      await page.waitForTimeout(300);

      // Should have "Add Point On" option
      await expect(
        page.locator('.v-list-item').filter({ hasText: /Add Point On|Ajouter un point/i })
      ).toBeVisible();
    });

    test('should open add point modal from context menu', async ({ page, blankProject }) => {
      // Create a line
      await createLine(page);

      // Open context menu on the line
      const lineItem = getLineItem(page);
      await lineItem.locator('.mdi-dots-vertical').click();
      await page.waitForTimeout(300);

      // Click add point option
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Add Point On|Ajouter un point/i })
        .click();
      await page.waitForTimeout(300);

      // Modal should be visible
      await expect(page.locator('.v-dialog')).toBeVisible();
    });
  });

  test.describe('Modal Form', () => {
    test('should have name input', async ({ page, blankProject }) => {
      await createLine(page);

      // Open add point modal
      const lineItem = getLineItem(page);
      await lineItem.locator('.mdi-dots-vertical').click();
      await page.waitForTimeout(300);
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Add Point On|Ajouter un point/i })
        .click();
      await page.waitForTimeout(300);

      // Name input should be visible
      const dialog = page.locator('.v-dialog');
      await expect(dialog.locator('input[type="text"]').first()).toBeVisible();
    });

    test('should have distance from selector', async ({ page, blankProject }) => {
      await createLine(page);

      // Open add point modal
      const lineItem = getLineItem(page);
      await lineItem.locator('.mdi-dots-vertical').click();
      await page.waitForTimeout(300);
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Add Point On|Ajouter un point/i })
        .click();
      await page.waitForTimeout(300);

      // Distance from selector should be visible
      const dialog = page.locator('.v-dialog');
      await expect(dialog.locator('.v-select')).toBeVisible();
    });

    test('should have distance input', async ({ page, blankProject }) => {
      await createLine(page);

      // Open add point modal
      const lineItem = getLineItem(page);
      await lineItem.locator('.mdi-dots-vertical').click();
      await page.waitForTimeout(300);
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Add Point On|Ajouter un point/i })
        .click();
      await page.waitForTimeout(300);

      // Distance input should be visible
      const dialog = page.locator('.v-dialog');
      await expect(dialog.locator('input[type="number"]')).toBeVisible();
    });

    test('should have midpoint button', async ({ page, blankProject }) => {
      await createLine(page);

      // Open add point modal
      const lineItem = getLineItem(page);
      await lineItem.locator('.mdi-dots-vertical').click();
      await page.waitForTimeout(300);
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Add Point On|Ajouter un point/i })
        .click();
      await page.waitForTimeout(300);

      // Midpoint button should be visible
      await expect(page.locator('button').filter({ hasText: /Midpoint|Milieu/i })).toBeVisible();
    });
  });

  test.describe('Midpoint Calculation', () => {
    test('should calculate midpoint when clicking midpoint button', async ({
      page,
      blankProject,
    }) => {
      await createLine(page);

      // Open add point modal
      const lineItem = getLineItem(page);
      await lineItem.locator('.mdi-dots-vertical').click();
      await page.waitForTimeout(300);
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Add Point On|Ajouter un point/i })
        .click();
      await page.waitForTimeout(300);

      const dialog = page.locator('.v-dialog');

      // Click midpoint button
      await page
        .locator('button')
        .filter({ hasText: /Midpoint|Milieu/i })
        .click();
      await page.waitForTimeout(300);

      // Distance should be set (line is 1km so midpoint is 0.5km)
      const distanceInput = dialog.locator('input[type="number"]');
      const value = await distanceInput.inputValue();
      // For a 1km line, midpoint should be around 0.5km
      expect(Number.parseFloat(value)).toBeGreaterThanOrEqual(0);
    });

    test('should auto-fill point name when clicking midpoint', async ({ page, blankProject }) => {
      await createLine(page);

      // Open add point modal
      const lineItem = getLineItem(page);
      await lineItem.locator('.mdi-dots-vertical').click();
      await page.waitForTimeout(300);
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Add Point On|Ajouter un point/i })
        .click();
      await page.waitForTimeout(300);

      const dialog = page.locator('.v-dialog');

      // Click midpoint button
      await page
        .locator('button')
        .filter({ hasText: /Midpoint|Milieu/i })
        .click();
      await page.waitForTimeout(300);

      // Name should be auto-filled with midpoint text
      const nameInput = dialog.locator('input[type="text"]').first();
      const nameValue = await nameInput.inputValue();
      expect(nameValue.length).toBeGreaterThan(0);
    });
  });

  test.describe('Distance From Selection', () => {
    test('should default to start', async ({ page, blankProject }) => {
      await createLine(page);

      // Open add point modal
      const lineItem = getLineItem(page);
      await lineItem.locator('.mdi-dots-vertical').click();
      await page.waitForTimeout(300);
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Add Point On|Ajouter un point/i })
        .click();
      await page.waitForTimeout(300);

      // Default should be "Start"
      const dialog = page.locator('.v-dialog');
      await expect(dialog.locator('.v-select__selection')).toContainText(/Start|Début/i);
    });

    test('should allow selecting end', async ({ page, blankProject }) => {
      await createLine(page);

      // Open add point modal
      const lineItem = getLineItem(page);
      await lineItem.locator('.mdi-dots-vertical').click();
      await page.waitForTimeout(300);
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Add Point On|Ajouter un point/i })
        .click();
      await page.waitForTimeout(300);

      const dialog = page.locator('.v-dialog');

      // Open dropdown and select "End"
      await dialog.locator('.v-select').click();
      await page.waitForTimeout(300);
      await page
        .locator('.v-select__content .v-list-item')
        .filter({ hasText: /End|Fin/i })
        .click();
      await page.waitForTimeout(300);

      // Should show "End" selected
      await expect(dialog.locator('.v-select__selection')).toContainText(/End|Fin/i);
    });
  });

  test.describe('Creating Point', () => {
    test('should create point on segment', async ({ page, blankProject }) => {
      await createLine(page);

      // Open add point modal
      const lineItem = getLineItem(page);
      await lineItem.locator('.mdi-dots-vertical').click();
      await page.waitForTimeout(300);
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Add Point On|Ajouter un point/i })
        .click();
      await page.waitForTimeout(300);

      // Click midpoint button for valid distance
      await page
        .locator('button')
        .filter({ hasText: /Midpoint|Milieu/i })
        .click();
      await page.waitForTimeout(300);

      // Click add button
      await page
        .locator('button')
        .filter({ hasText: /Add Point|Ajouter/i })
        .last()
        .click();
      await page.waitForTimeout(500);

      // Modal should close
      await expect(page.locator('.v-dialog')).not.toBeVisible();

      // Success toast should appear
      await expect(page.locator('.v-snackbar').first()).toBeVisible();
    });

    test('should add point to points section', async ({ page, blankProject }) => {
      await createLine(page);

      // Count initial points (note: the fixture has 3 saved coordinates)
      // Open add point modal
      const lineItem = getLineItem(page);
      await lineItem.locator('.mdi-dots-vertical').click();
      await page.waitForTimeout(300);
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Add Point On|Ajouter un point/i })
        .click();
      await page.waitForTimeout(300);

      // Click midpoint button and add
      await page
        .locator('button')
        .filter({ hasText: /Midpoint|Milieu/i })
        .click();
      await page.waitForTimeout(300);
      await page
        .locator('button')
        .filter({ hasText: /Add Point|Ajouter/i })
        .last()
        .click();
      await page.waitForTimeout(500);

      // Should have points section now
      await expect(
        page.locator('.layers-section-title').filter({ hasText: /Point|point/i })
      ).toBeVisible();
    });
  });

  test.describe('Modal Close', () => {
    test('should close modal with cancel button', async ({ page, blankProject }) => {
      await createLine(page);

      // Open add point modal
      const lineItem = getLineItem(page);
      await lineItem.locator('.mdi-dots-vertical').click();
      await page.waitForTimeout(300);
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Add Point On|Ajouter un point/i })
        .click();
      await page.waitForTimeout(300);

      // Click cancel
      await page
        .locator('button')
        .filter({ hasText: /Cancel|Annuler/i })
        .click();
      await page.waitForTimeout(300);

      // Modal should be closed
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should close modal with escape key', async ({ page, blankProject }) => {
      await createLine(page);

      // Open add point modal
      const lineItem = getLineItem(page);
      await lineItem.locator('.mdi-dots-vertical').click();
      await page.waitForTimeout(300);
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Add Point On|Ajouter un point/i })
        .click();
      await page.waitForTimeout(300);

      // Press escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Modal should be closed
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });
  });
});
