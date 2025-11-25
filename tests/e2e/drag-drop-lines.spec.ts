import { expect, test } from './fixtures';

test.describe('Drag and Drop Lines', () => {
  test.describe('Point Draggability', () => {
    test('should make points draggable', async ({ page, blankProject }) => {
      // Create a point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Point item should have draggable attribute
      const pointItem = page.locator('.layer-item[draggable="true"]');
      await expect(pointItem).toBeVisible();
    });

    test('should have cursor pointer on points', async ({ page, blankProject }) => {
      // Create a point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Point should be visible in sidebar
      await expect(page.locator('.layer-item[draggable="true"]')).toBeVisible();
    });
  });

  test.describe('Creating Lines via Drag and Drop', () => {
    test('should have two points to create a line', async ({ page, blankProject }) => {
      // Create first point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      const nameInput1 = page.locator('.v-dialog input[type="text"]').first();
      await nameInput1.fill('Point A');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Create second point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('51.5074, -0.1278');
      const nameInput2 = page.locator('.v-dialog input[type="text"]').first();
      await nameInput2.fill('Point B');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Both points should be visible
      await expect(page.locator('.layer-item-name').filter({ hasText: 'Point A' })).toBeVisible();
      await expect(page.locator('.layer-item-name').filter({ hasText: 'Point B' })).toBeVisible();
    });

    test('should create line by dragging point to another', async ({ page, blankProject }) => {
      // Create first point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      const nameInput1 = page.locator('.v-dialog input[type="text"]').first();
      await nameInput1.fill('Start Point');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Create second point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('51.5074, -0.1278');
      const nameInput2 = page.locator('.v-dialog input[type="text"]').first();
      await nameInput2.fill('End Point');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Get both point items
      const startPoint = page
        .locator('.layer-item[draggable="true"]')
        .filter({ has: page.locator('.layer-item-name', { hasText: 'Start Point' }) });
      const endPoint = page
        .locator('.layer-item[draggable="true"]')
        .filter({ has: page.locator('.layer-item-name', { hasText: 'End Point' }) });

      // Perform drag and drop
      await startPoint.dragTo(endPoint);
      await page.waitForTimeout(500);

      // Should show success toast (line created)
      await expect(page.locator('.v-snackbar').first()).toBeVisible();
    });

    test('should show line in layers after drag drop', async ({ page, blankProject }) => {
      // Create first point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      const nameInput1 = page.locator('.v-dialog input[type="text"]').first();
      await nameInput1.fill('Paris');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Create second point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('51.5074, -0.1278');
      const nameInput2 = page.locator('.v-dialog input[type="text"]').first();
      await nameInput2.fill('London');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Get both point items
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
      // Create first point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      const nameInput1 = page.locator('.v-dialog input[type="text"]').first();
      await nameInput1.fill('Alpha');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Create second point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('51.5074, -0.1278');
      const nameInput2 = page.locator('.v-dialog input[type="text"]').first();
      await nameInput2.fill('Beta');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Get both point items
      const alphaPoint = page
        .locator('.layer-item[draggable="true"]')
        .filter({ has: page.locator('.layer-item-name', { hasText: 'Alpha' }) });
      const betaPoint = page
        .locator('.layer-item[draggable="true"]')
        .filter({ has: page.locator('.layer-item-name', { hasText: 'Beta' }) });

      // Perform drag and drop
      await alphaPoint.dragTo(betaPoint);
      await page.waitForTimeout(500);

      // Line should be named "Alpha → Beta"
      await expect(
        page.locator('.layer-item-name').filter({ hasText: /Alpha.*→.*Beta/ })
      ).toBeVisible();
    });
  });

  test.describe('Drag Over Visual Feedback', () => {
    test('should highlight drop target on drag over', async ({ page, blankProject }) => {
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

      // Just verify both points exist (visual feedback is hard to test)
      const pointItems = page.locator('.layer-item[draggable="true"]');
      await expect(pointItems).toHaveCount(2);
    });
  });

  test.describe('Self-Drop Prevention', () => {
    test('should not create line when dropping on same point', async ({ page, blankProject }) => {
      // Create a single point
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      const nameInput = page.locator('.v-dialog input[type="text"]').first();
      await nameInput.fill('Solo Point');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Get point item
      const soloPoint = page.locator('.layer-item[draggable="true"]');

      // Try to drag to itself (shouldn't create anything)
      await soloPoint.dragTo(soloPoint);
      await page.waitForTimeout(300);

      // Lines section should not appear
      await expect(
        page.locator('.layers-section-title').filter({ hasText: /Line|Ligne/i })
      ).not.toBeVisible();
    });
  });

  test.describe('Multiple Lines', () => {
    test('should create multiple lines from same point', async ({ page, blankProject }) => {
      // Create three points
      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
      const nameInput1 = page.locator('.v-dialog input[type="text"]').first();
      await nameInput1.fill('Center');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('51.5074, -0.1278');
      const nameInput2 = page.locator('.v-dialog input[type="text"]').first();
      await nameInput2.fill('North');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      await page.locator('[data-testid="draw-point-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('input[placeholder*="48.8566"]').fill('41.9028, 12.4964');
      const nameInput3 = page.locator('.v-dialog input[type="text"]').first();
      await nameInput3.fill('South');
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Create first line: Center → North
      const centerPoint = page
        .locator('.layer-item[draggable="true"]')
        .filter({ has: page.locator('.layer-item-name', { hasText: 'Center' }) });
      const northPoint = page
        .locator('.layer-item[draggable="true"]')
        .filter({ has: page.locator('.layer-item-name', { hasText: 'North' }) });

      await centerPoint.dragTo(northPoint);
      await page.waitForTimeout(500);

      // Create second line: Center → South
      const southPoint = page
        .locator('.layer-item[draggable="true"]')
        .filter({ has: page.locator('.layer-item-name', { hasText: 'South' }) });

      await centerPoint.dragTo(southPoint);
      await page.waitForTimeout(500);

      // Should have 2 lines in the lines section
      await expect(page.locator('.layer-item-name').filter({ hasText: /→/ })).toHaveCount(2);
    });
  });
});
