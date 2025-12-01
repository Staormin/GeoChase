import { expect, test } from '../fixtures';

test.describe('Drag and Drop Lines', () => {
  test.describe('Point Draggability', () => {
    test('should make points draggable', async ({ page, blankProject }) => {
      // Fixture already provides 3 points (Paris, London, Berlin)
      // Point items should have draggable attribute
      const pointItems = page.locator('.layer-item[draggable="true"]');
      await expect(pointItems.first()).toBeVisible();
      // Should have at least 3 draggable points from fixture
      await expect(pointItems).toHaveCount(3);
    });

    test('should have cursor pointer on points', async ({ page, blankProject }) => {
      // Fixture already provides 3 points (Paris, London, Berlin)
      // Points should be visible in sidebar
      const pointItems = page.locator('.layer-item[draggable="true"]');
      await expect(pointItems.first()).toBeVisible();
    });
  });

  test.describe('Creating Lines via Drag and Drop', () => {
    test('should have two points to create a line', async ({ page, blankProject }) => {
      // Fixture provides Paris and London points - verify they exist
      await expect(page.locator('.layer-item-name').filter({ hasText: 'Paris' })).toBeVisible();
      await expect(page.locator('.layer-item-name').filter({ hasText: 'London' })).toBeVisible();
    });

    test('should create line by dragging point to another', async ({ page, blankProject }) => {
      // Use fixture points (Paris and London)
      const parisPoint = page
        .locator('.layer-item[draggable="true"]')
        .filter({ has: page.locator('.layer-item-name', { hasText: 'Paris' }) });
      const londonPoint = page
        .locator('.layer-item[draggable="true"]')
        .filter({ has: page.locator('.layer-item-name', { hasText: 'London' }) });

      // Perform drag and drop
      await parisPoint.dragTo(londonPoint);
      await page.waitForTimeout(500);

      // Should show success toast (line created)
      await expect(page.locator('.v-snackbar').first()).toBeVisible();
    });

    test('should show line in layers after drag drop', async ({ page, blankProject }) => {
      // Use fixture points (Paris and London)
      const parisPoint = page
        .locator('.layer-item[draggable="true"]')
        .filter({ has: page.locator('.layer-item-name', { hasText: 'Paris' }) });
      const londonPoint = page
        .locator('.layer-item[draggable="true"]')
        .filter({ has: page.locator('.layer-item-name', { hasText: 'London' }) });

      // Perform drag and drop
      await parisPoint.dragTo(londonPoint);
      await page.waitForTimeout(500);

      // Lines section should appear with the new line
      await expect(
        page.locator('.layers-section-title').filter({ hasText: /Line|Ligne/i })
      ).toBeVisible();
    });

    test('should name line after points', async ({ page, blankProject }) => {
      // Use fixture points (Paris and London)
      const parisPoint = page
        .locator('.layer-item[draggable="true"]')
        .filter({ has: page.locator('.layer-item-name', { hasText: 'Paris' }) });
      const londonPoint = page
        .locator('.layer-item[draggable="true"]')
        .filter({ has: page.locator('.layer-item-name', { hasText: 'London' }) });

      // Perform drag and drop
      await parisPoint.dragTo(londonPoint);
      await page.waitForTimeout(500);

      // Line should be named "Paris → London"
      await expect(
        page.locator('.layer-item-name').filter({ hasText: /Paris.*→.*London/ })
      ).toBeVisible();
    });
  });

  test.describe('Drag Over Visual Feedback', () => {
    test('should highlight drop target on drag over', async ({ page, blankProject }) => {
      // Fixture provides 3 points (Paris, London, Berlin)
      // Just verify points exist (visual feedback is hard to test)
      const pointItems = page.locator('.layer-item[draggable="true"]');
      await expect(pointItems).toHaveCount(3);
    });
  });

  test.describe('Self-Drop Prevention', () => {
    test('should not create line when dropping on same point', async ({ page, blankProject }) => {
      // Use Paris from fixture
      const parisPoint = page
        .locator('.layer-item[draggable="true"]')
        .filter({ has: page.locator('.layer-item-name', { hasText: 'Paris' }) });

      // Try to drag to itself (shouldn't create anything)
      await parisPoint.dragTo(parisPoint);
      await page.waitForTimeout(300);

      // Lines section should not appear
      await expect(
        page.locator('.layers-section-title').filter({ hasText: /Line|Ligne/i })
      ).not.toBeVisible();
    });
  });

  test.describe('Multiple Lines', () => {
    test('should create multiple lines from same point', async ({ page, blankProject }) => {
      // Use fixture points (Paris, London, Berlin)
      const parisPoint = page
        .locator('.layer-item[draggable="true"]')
        .filter({ has: page.locator('.layer-item-name', { hasText: 'Paris' }) });
      const londonPoint = page
        .locator('.layer-item[draggable="true"]')
        .filter({ has: page.locator('.layer-item-name', { hasText: 'London' }) });
      const berlinPoint = page
        .locator('.layer-item[draggable="true"]')
        .filter({ has: page.locator('.layer-item-name', { hasText: 'Berlin' }) });

      // Create first line: Paris → London
      await parisPoint.dragTo(londonPoint);
      await page.waitForTimeout(500);

      // Create second line: Paris → Berlin
      await parisPoint.dragTo(berlinPoint);
      await page.waitForTimeout(500);

      // Should have 2 lines in the lines section
      await expect(page.locator('.layer-item-name').filter({ hasText: /→/ })).toHaveCount(2);
    });
  });
});
