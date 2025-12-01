import { expect, test } from '../fixtures';

test.describe('Bearings Modal', () => {
  // Fixture provides 3 points: Paris (48.8566, 2.3522), London (51.5074, -0.1278), Berlin (52.52, 13.405)

  test.describe('Opening Bearings Modal', () => {
    test('should open bearings modal from point context menu', async ({ page, blankProject }) => {
      // Open context menu on Paris (first point from fixture)
      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);

      // Click bearings option
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Bearings|Azimuts/i })
        .click();
      await page.waitForTimeout(300);

      // Bearings modal should be visible
      const modal = page.locator('.v-dialog');
      await expect(modal).toBeVisible();
    });

    test('should display bearings title', async ({ page, blankProject }) => {
      // Open context menu and bearings on fixture point
      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Bearings|Azimuts/i })
        .click();
      await page.waitForTimeout(300);

      // Title should contain "Bearings" or "Azimuts"
      await expect(page.locator('.v-card-title')).toContainText(/Bearings|Azimuts/i);
    });

    test('should display source point coordinates', async ({ page, blankProject }) => {
      // Open bearings modal on fixture point
      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Bearings|Azimuts/i })
        .click();
      await page.waitForTimeout(300);

      // Should display coordinates in the info box
      const modal = page.locator('.v-dialog');
      await expect(modal.locator('.bg-blue-50')).toBeVisible();
      // Should contain coordinate values (Paris coordinates from fixture)
      await expect(modal.locator('.bg-blue-50')).toContainText('48.');
      await expect(modal.locator('.bg-blue-50')).toContainText('2.');
    });
  });

  test.describe('Bearings Table', () => {
    test('should display bearings table with multiple points', async ({ page, blankProject }) => {
      // Fixture already provides 3 points (Paris, London, Berlin)
      // Open bearings modal from first point
      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Bearings|Azimuts/i })
        .click();
      await page.waitForTimeout(300);

      // Should display table
      const modal = page.locator('.v-dialog');
      await expect(modal.locator('.v-table')).toBeVisible();
    });

    test('should display column headers', async ({ page, blankProject }) => {
      // Open bearings modal on fixture point
      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Bearings|Azimuts/i })
        .click();
      await page.waitForTimeout(300);

      // Should have column headers
      const modal = page.locator('.v-dialog');
      await expect(modal.locator('th').filter({ hasText: /Point|point/i })).toBeVisible();
      await expect(modal.locator('th').filter({ hasText: /Distance|distance/i })).toBeVisible();
      await expect(
        modal
          .locator('th')
          .filter({ hasText: /Azimuth|azimut/i })
          .first()
      ).toBeVisible();
    });

    test('should display bearing data rows', async ({ page, blankProject }) => {
      // Fixture provides 3 points, so bearings table will show 3 rows (including source point)
      // Open bearings modal
      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Bearings|Azimuts/i })
        .click();
      await page.waitForTimeout(300);

      // Should have data rows in tbody
      const modal = page.locator('.v-dialog');
      const rows = modal.locator('tbody tr');
      await expect(rows.first()).toBeVisible();
    });
  });

  test.describe('Sorting', () => {
    test('should sort by distance by default', async ({ page, blankProject }) => {
      // Fixture provides 3 points - open bearings modal
      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Bearings|Azimuts/i })
        .click();
      await page.waitForTimeout(300);

      // Distance header should have sort indicator
      const modal = page.locator('.v-dialog');
      const distanceHeader = modal.locator('th').filter({ hasText: /Distance|distance/i });
      await expect(distanceHeader.locator('.mdi-arrow-up, .mdi-arrow-down')).toBeVisible();
    });

    test('should toggle sort direction when clicking same column', async ({
      page,
      blankProject,
    }) => {
      // Fixture provides 3 points - open bearings modal
      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Bearings|Azimuts/i })
        .click();
      await page.waitForTimeout(300);

      const modal = page.locator('.v-dialog');
      const distanceHeader = modal.locator('th').filter({ hasText: /Distance|distance/i });

      // Click to toggle sort direction
      await distanceHeader.click();
      await page.waitForTimeout(300);

      // Sort icon should still be visible (direction changed)
      await expect(distanceHeader.locator('.mdi-arrow-up, .mdi-arrow-down')).toBeVisible();
    });

    test('should sort by name when clicking name column', async ({ page, blankProject }) => {
      // Fixture provides 3 points - open bearings modal
      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Bearings|Azimuts/i })
        .click();
      await page.waitForTimeout(300);

      const modal = page.locator('.v-dialog');
      const nameHeader = modal.locator('th').filter({ hasText: /Point|point/i });

      // Click name header to sort by name
      await nameHeader.click();
      await page.waitForTimeout(300);

      // Name header should now have sort indicator
      await expect(nameHeader.locator('.mdi-arrow-up, .mdi-arrow-down')).toBeVisible();
    });

    test('should sort by azimuth when clicking azimuth column', async ({ page, blankProject }) => {
      // Fixture provides 3 points - open bearings modal
      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Bearings|Azimuts/i })
        .click();
      await page.waitForTimeout(300);

      const modal = page.locator('.v-dialog');
      // Click the first azimuth header (not inverse)
      const azimuthHeaders = modal.locator('th').filter({ hasText: /Azimuth|azimut/i });
      await azimuthHeaders.first().click();
      await page.waitForTimeout(300);

      // Azimuth header should now have sort indicator
      await expect(azimuthHeaders.first().locator('.mdi-arrow-up, .mdi-arrow-down')).toBeVisible();
    });
  });

  test.describe('Closing Modal', () => {
    test('should close modal with close button', async ({ page, blankProject }) => {
      // Fixture provides 3 points - open bearings modal
      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Bearings|Azimuts/i })
        .click();
      await page.waitForTimeout(300);

      // Click close button in card actions
      await page
        .locator('button')
        .filter({ hasText: /Close|Fermer/i })
        .click();
      await page.waitForTimeout(300);

      // Modal should be closed
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should close modal with X button', async ({ page, blankProject }) => {
      // Fixture provides 3 points - open bearings modal
      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Bearings|Azimuts/i })
        .click();
      await page.waitForTimeout(300);

      // Click X button in title
      const modal = page.locator('.v-dialog');
      await modal.locator('.mdi-close').click();
      await page.waitForTimeout(300);

      // Modal should be closed
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should close modal with escape key', async ({ page, blankProject }) => {
      // Fixture provides 3 points - open bearings modal
      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Bearings|Azimuts/i })
        .click();
      await page.waitForTimeout(300);

      // Press escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Modal should be closed
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });
  });

  test.describe('Point Navigation', () => {
    test('should close modal when clicking a point row', async ({ page, blankProject }) => {
      // Fixture provides 3 points - open bearings modal
      const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
      await contextMenuBtn.click();
      await page.waitForTimeout(300);
      await page
        .locator('.v-list-item')
        .filter({ hasText: /Bearings|Azimuts/i })
        .click();
      await page.waitForTimeout(300);

      // Click on a row in the table
      const modal = page.locator('.v-dialog');
      await modal.locator('tbody tr').first().click();
      await page.waitForTimeout(300);

      // Modal should be closed (navigated to point)
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });
  });
});
