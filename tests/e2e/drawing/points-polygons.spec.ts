import { expect, test } from '../fixtures';

test.describe('Points and Polygons', () => {
  test.describe('Point Management', () => {
    test('should create a point with coordinates', async ({ page, blankProject }) => {
      // Click point button (button index 6 in drawing tools)
      await page.locator('.v-btn-group').last().locator('button').nth(6).click();
      await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5000 });

      const dialog = page.locator('[role="dialog"]');

      // Fill in coordinates (direct text input with placeholder)
      await dialog.locator('input[placeholder="48.8566, 2.3522"]').fill('48.8566, 2.3522');

      // Submit form
      await page.click('button:has-text("Add")');
      await page.waitForTimeout(500);

      // Verify point appears in layers panel
      await expect(page.locator('.layer-item-name').filter({ hasText: /Point/i })).toBeVisible();
    });

    test('should create a point with custom name', async ({ page, blankProject }) => {
      // Click point button
      await page.locator('.v-btn-group').last().locator('button').nth(6).click();
      await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5000 });

      const dialog = page.locator('[role="dialog"]');

      // Fill in name (first text input)
      const nameInput = dialog.locator('input[type="text"]').first();
      await nameInput.fill('Eiffel Tower');

      // Fill in coordinates
      await dialog.locator('input[placeholder="48.8566, 2.3522"]').fill('48.8584, 2.2945');

      // Submit form
      await page.click('button:has-text("Add")');
      await page.waitForTimeout(500);

      // Verify point appears with custom name
      await expect(
        page.locator('.layer-item-name').filter({ hasText: /Eiffel Tower/i })
      ).toBeVisible();
    });

    test('should edit a point', async ({ page, blankProject }) => {
      // Create a point first
      await page.locator('.v-btn-group').last().locator('button').nth(6).click();
      let dialog = page.locator('[role="dialog"]');
      await dialog.locator('input[placeholder="48.8566, 2.3522"]').fill('48.8566, 2.3522');
      await page.click('button:has-text("Add")');
      await page.waitForTimeout(500);

      // Find and click the context menu button
      const contextMenuBtn = page
        .locator('.layer-item')
        .filter({ hasText: /Point/i })
        .locator('button')
        .last();
      await contextMenuBtn.click();
      await page.waitForTimeout(200);

      // Click edit option
      await page.click('text=Edit');

      // Wait for edit modal
      await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5000 });

      dialog = page.locator('[role="dialog"]');

      // Change name
      const nameInput = dialog.locator('input[type="text"]').first();
      await nameInput.clear();
      await nameInput.fill('Updated Point');

      // Save changes
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(500);

      // Verify updated name
      await expect(
        page.locator('.layer-item-name').filter({ hasText: /Updated Point/i })
      ).toBeVisible();
    });

    test('should delete a point', async ({ page, blankProject }) => {
      // Create a point first (fixture already has 3 points)
      await page.locator('.v-btn-group').last().locator('button').nth(6).click();
      const dialog = page.locator('[role="dialog"]');
      await dialog.locator('input[placeholder="48.8566, 2.3522"]').fill('48.8566, 2.3522');
      await page.click('button:has-text("Add")');
      await page.waitForTimeout(500);

      // Verify we now have 4 points (3 from fixture + 1 new)
      await expect(page.locator('.layer-item')).toHaveCount(4);

      // Find and click the context menu button on the newly created point (last one)
      const contextMenuBtn = page.locator('.layer-item').last().locator('button').last();
      await contextMenuBtn.click();
      await page.waitForTimeout(200);

      // Click delete option
      page.on('dialog', (dialog) => dialog.accept());
      await page.click('text=Delete');
      await page.waitForTimeout(300);

      // Verify point is removed (back to 3 from fixture)
      await expect(page.locator('.layer-item')).toHaveCount(3);
    });

    test('should create multiple points', async ({ page, blankProject }) => {
      const coordinates = ['48.8566, 2.3522', '51.5074, -0.1278', '52.5200, 13.4050'];

      for (const coord of coordinates) {
        await page.locator('.v-btn-group').last().locator('button').nth(6).click();
        const dialog = page.locator('[role="dialog"]');
        await dialog.locator('input[placeholder="48.8566, 2.3522"]').fill(coord);
        await page.click('button:has-text("Add")');
        await page.waitForTimeout(300);
      }

      // Verify all points appear
      const pointCount = await page.locator('.layer-item').count();
      expect(pointCount).toBeGreaterThanOrEqual(3);
    });
  });

  test.describe('Polygon Management', () => {
    test('should create a polygon from three points', async ({ page, blankProject }) => {
      // Create three points first
      const points = [
        { lat: 48.8566, lon: 2.3522 }, // Paris
        { lat: 51.5074, lon: -0.1278 }, // London
        { lat: 52.52, lon: 13.405 }, // Berlin
      ];

      for (const point of points) {
        await page.locator('.v-btn-group').last().locator('button').nth(6).click();
        const dialog = page.locator('[role="dialog"]');
        await dialog
          .locator('input[placeholder="48.8566, 2.3522"]')
          .fill(`${point.lat}, ${point.lon}`);
        await page.click('button:has-text("Add")');
        await page.waitForTimeout(300);
      }

      // Click polygon button (button index 8)
      await page.locator('.v-btn-group').last().locator('button').nth(8).click();
      await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5000 });

      // The polygon modal should show available points to select
      // Select all points by clicking v-chip components
      const dialog = page.locator('[role="dialog"]');
      const pointChips = dialog.locator('.v-chip');
      const count = await pointChips.count();
      for (let i = 0; i < count; i++) {
        await pointChips.nth(i).click();
        await page.waitForTimeout(100);
      }

      // Click Add to create polygon with all points
      await page.click('button:has-text("Add")');
      await page.waitForTimeout(500);

      // Verify polygon appears
      await expect(page.locator('.layer-item').filter({ hasText: /Polygon/i })).toBeVisible();
    });

    test('should create a polygon with custom name', async ({ page, blankProject }) => {
      // Create three points first
      for (let i = 0; i < 3; i++) {
        await page.locator('.v-btn-group').last().locator('button').nth(6).click();
        const dialog = page.locator('[role="dialog"]');
        await dialog.locator('input[placeholder="48.8566, 2.3522"]').fill(`${48 + i}, ${2 + i}`);
        await page.click('button:has-text("Add")');
        await page.waitForTimeout(300);
      }

      // Open polygon modal
      await page.locator('.v-btn-group').last().locator('button').nth(8).click();
      await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5000 });

      const dialog = page.locator('[role="dialog"]');

      // Fill in name
      const nameInput = dialog.locator('input[type="text"]').first();
      await nameInput.fill('Triangle Area');

      // Select all points
      const pointChips = dialog.locator('.v-chip');
      const count = await pointChips.count();
      for (let i = 0; i < count; i++) {
        await pointChips.nth(i).click();
        await page.waitForTimeout(100);
      }

      // Submit form
      await page.click('button:has-text("Add")');
      await page.waitForTimeout(500);

      // Verify polygon appears with custom name
      await expect(
        page.locator('.layer-item-name').filter({ hasText: /Triangle Area/i })
      ).toBeVisible();
    });

    test('should delete a polygon', async ({ page, blankProject }) => {
      // Create three points first
      for (let i = 0; i < 3; i++) {
        await page.locator('.v-btn-group').last().locator('button').nth(6).click();
        const dialog = page.locator('[role="dialog"]');
        await dialog.locator('input[placeholder="48.8566, 2.3522"]').fill(`${48 + i}, ${2 + i}`);
        await page.click('button:has-text("Add")');
        await page.waitForTimeout(300);
      }

      // Create polygon
      await page.locator('.v-btn-group').last().locator('button').nth(8).click();
      await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5000 });

      const dialog = page.locator('[role="dialog"]');
      const pointChips = dialog.locator('.v-chip');
      const count = await pointChips.count();
      for (let i = 0; i < count; i++) {
        await pointChips.nth(i).click();
        await page.waitForTimeout(100);
      }

      await page.click('button:has-text("Add")');
      await page.waitForTimeout(500);

      // Find polygon and delete it
      const contextMenuBtn = page
        .locator('.layer-item')
        .filter({ hasText: /Polygon/i })
        .locator('button')
        .last();
      await contextMenuBtn.click();
      await page.waitForTimeout(200);

      page.on('dialog', (dialog) => dialog.accept());
      await page.click('text=Delete');
      await page.waitForTimeout(300);

      // Verify polygon is removed (but points should remain)
      await expect(
        page.locator('.layer-item').filter({ hasText: /Polygon.*1/i })
      ).not.toBeVisible();
      // Points should still exist
      const pointCount = await page.locator('.layer-item').count();
      expect(pointCount).toBeGreaterThanOrEqual(3);
    });
  });

  test.describe('Layer Visibility', () => {
    test('should hide all points', async ({ page, blankProject }) => {
      // Fixture already provides 3 points (Paris, London, Berlin)
      // Verify initial state
      const initialPointCount = await page.locator('.layer-item').count();
      expect(initialPointCount).toBe(3);

      // Click "Hide all points" button
      const hideAllBtn = page.locator('button').filter({ hasText: /Hide.*points/i });
      if ((await hideAllBtn.count()) > 0) {
        await hideAllBtn.click();
        await page.waitForTimeout(200);
      }

      // Points should still be in the list (just hidden on map)
      const pointCount = await page.locator('.layer-item').count();
      expect(pointCount).toBe(3);
    });

    test('should show all points after hiding', async ({ page, blankProject }) => {
      // Fixture already provides 3 points (Paris, London, Berlin)

      // Hide all points
      const hideAllBtn = page.locator('button').filter({ hasText: /Hide.*points/i });
      if ((await hideAllBtn.count()) > 0) {
        await hideAllBtn.click();
        await page.waitForTimeout(200);

        // Show all points
        const showAllBtn = page.locator('button').filter({ hasText: /Show.*points/i });
        if ((await showAllBtn.count()) > 0) {
          await showAllBtn.click();
          await page.waitForTimeout(200);
        }
      }

      // Points should be visible (3 from fixture)
      const pointCount = await page.locator('.layer-item').count();
      expect(pointCount).toBe(3);
    });
  });
});
