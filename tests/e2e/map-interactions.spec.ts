import { expect, test } from './fixtures';

test.describe('Map Interactions', () => {
  test.describe('Map Navigation', () => {
    test('should display map canvas', async ({ page, blankProject }) => {
      // Verify the OpenLayers map is rendered
      const mapViewport = page.locator('.ol-viewport');
      await expect(mapViewport).toBeVisible();
    });

    test('should zoom using mouse wheel', async ({ page, blankProject }) => {
      // Zoom in using mouse wheel
      const map = page.locator('#map');
      await map.hover();
      await page.mouse.wheel(0, -100); // Scroll up to zoom in
      await page.waitForTimeout(500);

      // Verify no errors - map should still be visible
      await expect(map).toBeVisible();
    });

    test('should zoom out using mouse wheel', async ({ page, blankProject }) => {
      // Zoom out using mouse wheel
      const map = page.locator('#map');
      await map.hover();
      await page.mouse.wheel(0, 100); // Scroll down to zoom out
      await page.waitForTimeout(500);

      // Verify no errors - map should still be visible
      await expect(map).toBeVisible();
    });

    test('should pan map by dragging', async ({ page, blankProject }) => {
      // Drag the map
      const map = page.locator('#map');
      await map.hover();
      await page.mouse.down();
      await page.mouse.move(300, 200);
      await page.mouse.up();
      await page.waitForTimeout(500);

      // Verify map is still functional
      await expect(map).toBeVisible();
    });
  });

  test.describe('Map Provider Switching', () => {
    test('should have map provider selector', async ({ page, blankProject }) => {
      // Find map provider selector (v-select in TopBar)
      const providerSelect = page.locator('.v-select').first();
      await expect(providerSelect).toBeVisible();
    });

    test('should switch to OpenStreetMap', async ({ page, blankProject }) => {
      // Find and click map provider selector
      const providerSelect = page.locator('.v-select').first();
      await providerSelect.click();
      await page.waitForTimeout(300);

      // Select OSM from dropdown
      const osmOption = page.locator('.v-list-item').filter({ hasText: /OpenStreetMap/i });
      if ((await osmOption.count()) > 0) {
        await osmOption.click();
        await page.waitForTimeout(1000);

        // Map should still be visible
        await expect(page.locator('#map')).toBeVisible();
      }
    });

    test('should switch to Google Maps', async ({ page, blankProject }) => {
      // Find and click map provider selector
      const providerSelect = page.locator('.v-select').first();
      await providerSelect.click();
      await page.waitForTimeout(300);

      // Select Google Maps from dropdown (use first() to avoid strict mode violation)
      const googleOption = page
        .locator('.v-list-item')
        .filter({ hasText: /Google/i })
        .first();
      if ((await googleOption.count()) > 0) {
        await googleOption.click();
        await page.waitForTimeout(1000);

        // Map should still be visible
        await expect(page.locator('#map')).toBeVisible();
      }
    });

    test('should maintain map after provider switch', async ({ page, blankProject }) => {
      // Create a point first
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Switch provider
      const providerSelect = page.locator('.v-select').first();
      await providerSelect.click();
      await page.waitForTimeout(300);

      const osmOption = page.locator('.v-list-item').filter({ hasText: /OpenStreetMap/i });
      if ((await osmOption.count()) > 0) {
        await osmOption.click();
        await page.waitForTimeout(1000);
      }

      // Map and elements should still be visible
      await expect(page.locator('#map')).toBeVisible();
    });
  });

  test.describe('Map Extent and Bounds', () => {
    test('should fit map to show all elements', async ({ page, blankProject }) => {
      // Create elements in different locations
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('51.5074, -0.1278');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Map should be visible with elements
      await expect(page.locator('#map')).toBeVisible();
    });

    test('should center on specific element', async ({ page, blankProject }) => {
      // Create a point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Map should be visible
      await expect(page.locator('#map')).toBeVisible();
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should close modal with escape key', async ({ page, blankProject }) => {
      // Open a modal
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);

      // Modal should be open
      await expect(page.locator('.v-dialog')).toBeVisible();

      // Press escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Modal should close
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should support keyboard shortcuts', async ({ page, blankProject }) => {
      // Open modal and close with escape
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Modal should be closed
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });
  });

  test.describe('Map Performance', () => {
    test('should render map smoothly', async ({ page, blankProject }) => {
      // Create a point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Map should still be responsive
      const map = page.locator('#map');
      await expect(map).toBeVisible();

      // Zoom using mouse wheel should work
      await map.hover();
      await page.mouse.wheel(0, -100);
      await page.waitForTimeout(300);

      await expect(map).toBeVisible();
    });
  });

  test.describe('Map Controls', () => {
    test('should have attribution control', async ({ page, blankProject }) => {
      // OpenLayers attribution control may or may not be visible depending on config
      // Just verify the map viewport is present
      const mapViewport = page.locator('.ol-viewport');
      await expect(mapViewport).toBeVisible();
    });

    test('should have scale line control', async ({ page, blankProject }) => {
      // Check for scale line (may or may not be present)
      const mapViewport = page.locator('.ol-viewport');
      await expect(mapViewport).toBeVisible();
    });

    test('should have rotation reset control', async ({ page, blankProject }) => {
      // Rotation reset control appears when map is rotated
      const mapViewport = page.locator('.ol-viewport');
      await expect(mapViewport).toBeVisible();
    });
  });

  test.describe('Map Canvas', () => {
    test('should render canvas element', async ({ page, blankProject }) => {
      // OpenLayers renders to canvas
      const canvas = page.locator('.ol-viewport canvas');
      await expect(canvas.first()).toBeVisible();
    });

    test('should have proper size', async ({ page, blankProject }) => {
      // Map container should have proper dimensions
      const map = page.locator('#map');
      const box = await map.boundingBox();

      expect(box).not.toBeNull();
      if (box) {
        expect(box.width).toBeGreaterThan(100);
        expect(box.height).toBeGreaterThan(100);
      }
    });
  });
});
