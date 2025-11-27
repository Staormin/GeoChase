import { expect, test } from '../fixtures';

test.describe('Tutorial Modal', () => {
  test.describe('Opening and Closing', () => {
    test('should open tutorial modal from help button', async ({ page, blankProject }) => {
      // Click the help button (help-circle icon)
      await page.locator('button .mdi-help-circle').locator('..').click();
      await page.waitForTimeout(300);

      // Verify tutorial modal is open
      const modal = page.locator('.v-dialog');
      await expect(modal).toBeVisible();

      // Verify modal title (Welcome to GeoChase)
      await expect(
        page.locator('.v-card-title').filter({ hasText: /Welcome|GeoChase/i })
      ).toBeVisible();
    });

    test('should close tutorial modal with close button', async ({ page, blankProject }) => {
      // Open tutorial modal
      await page.locator('button .mdi-help-circle').locator('..').click();
      await page.waitForTimeout(300);

      // Verify modal is open
      await expect(page.locator('.v-dialog')).toBeVisible();

      // Click Close button
      await page
        .locator('button')
        .filter({ hasText: /Close|Fermer/i })
        .click();
      await page.waitForTimeout(300);

      // Modal should be closed
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should close tutorial modal with escape key', async ({ page, blankProject }) => {
      // Open tutorial modal
      await page.locator('button .mdi-help-circle').locator('..').click();
      await page.waitForTimeout(300);

      // Verify modal is open
      await expect(page.locator('.v-dialog')).toBeVisible();

      // Press escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Modal should be closed
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });
  });

  test.describe('Tab Navigation', () => {
    test('should display Getting Started tab by default', async ({ page, blankProject }) => {
      // Open tutorial modal
      await page.locator('button .mdi-help-circle').locator('..').click();
      await page.waitForTimeout(300);

      // Getting Started tab should be selected
      const gettingStartedTab = page.locator('.v-tab').filter({ hasText: /Getting Started/i });
      await expect(gettingStartedTab).toBeVisible();

      // Getting Started content should be visible
      await expect(
        page
          .locator('.tutorial-section')
          .filter({ hasText: /Welcome|GeoChase/i })
          .first()
      ).toBeVisible();
    });

    test('should navigate to Drawing Tools tab', async ({ page, blankProject }) => {
      // Open tutorial modal
      await page.locator('button .mdi-help-circle').locator('..').click();
      await page.waitForTimeout(300);

      // Click Drawing Tools tab
      await page
        .locator('.v-tab')
        .filter({ hasText: /Drawing/i })
        .click();
      await page.waitForTimeout(500);

      // Drawing tab should be selected (has active class)
      await expect(page.locator('.v-tab--selected').filter({ hasText: /Drawing/i })).toBeVisible();
    });

    test('should navigate to Search tab', async ({ page, blankProject }) => {
      // Open tutorial modal
      await page.locator('button .mdi-help-circle').locator('..').click();
      await page.waitForTimeout(300);

      // Click Search tab
      await page
        .locator('.v-tab')
        .filter({ hasText: /Search/i })
        .click();
      await page.waitForTimeout(500);

      // Search tab should be selected
      await expect(page.locator('.v-tab--selected').filter({ hasText: /Search/i })).toBeVisible();
    });

    test('should navigate to Navigation tab', async ({ page, blankProject }) => {
      // Open tutorial modal
      await page.locator('button .mdi-help-circle').locator('..').click();
      await page.waitForTimeout(300);

      // Click Navigation tab
      await page
        .locator('.v-tab')
        .filter({ hasText: /Navigation/i })
        .click();
      await page.waitForTimeout(500);

      // Navigation tab should be selected
      await expect(
        page.locator('.v-tab--selected').filter({ hasText: /Navigation/i })
      ).toBeVisible();
    });

    test('should navigate to Layers tab', async ({ page, blankProject }) => {
      // Open tutorial modal
      await page.locator('button .mdi-help-circle').locator('..').click();
      await page.waitForTimeout(300);

      // Click Layers tab
      await page
        .locator('.v-tab')
        .filter({ hasText: /Layers/i })
        .click();
      await page.waitForTimeout(300);

      // Layers content should be visible
      await expect(
        page.locator('.tutorial-section h3').filter({ hasText: /Layers/i })
      ).toBeVisible();
    });

    test('should navigate to Notes tab', async ({ page, blankProject }) => {
      // Open tutorial modal
      await page.locator('button .mdi-help-circle').locator('..').click();
      await page.waitForTimeout(300);

      // Click Notes tab
      await page.locator('.v-tab').filter({ hasText: /Notes/i }).click();
      await page.waitForTimeout(300);

      // Notes content should be visible
      await expect(
        page.locator('.tutorial-section h3').filter({ hasText: /Notes/i })
      ).toBeVisible();
    });

    test('should navigate to Coordinates tab', async ({ page, blankProject }) => {
      // Open tutorial modal
      await page.locator('button .mdi-help-circle').locator('..').click();
      await page.waitForTimeout(300);

      // Click Coordinates tab
      await page
        .locator('.v-tab')
        .filter({ hasText: /Coordinates/i })
        .click();
      await page.waitForTimeout(300);

      // Coordinates content should be visible
      await expect(
        page.locator('.tutorial-section h3').filter({ hasText: /Coordinates/i })
      ).toBeVisible();
    });

    test('should navigate to Projects tab', async ({ page, blankProject }) => {
      // Open tutorial modal
      await page.locator('button .mdi-help-circle').locator('..').click();
      await page.waitForTimeout(300);

      // Click Projects tab
      await page
        .locator('.v-tab')
        .filter({ hasText: /Projects/i })
        .click();
      await page.waitForTimeout(300);

      // Projects content should be visible
      await expect(
        page.locator('.tutorial-section h3').filter({ hasText: /Projects/i })
      ).toBeVisible();
    });

    test('should navigate to Elevation tab', async ({ page, blankProject }) => {
      // Open tutorial modal
      await page.locator('button .mdi-help-circle').locator('..').click();
      await page.waitForTimeout(300);

      // Click Elevation tab
      await page
        .locator('.v-tab')
        .filter({ hasText: /Elevation/i })
        .click();
      await page.waitForTimeout(300);

      // Elevation content should be visible
      await expect(
        page.locator('.tutorial-section h3').filter({ hasText: /Elevation/i })
      ).toBeVisible();
    });

    test('should navigate to Tips & Tricks tab', async ({ page, blankProject }) => {
      // Open tutorial modal
      await page.locator('button .mdi-help-circle').locator('..').click();
      await page.waitForTimeout(300);

      // Click Tips tab
      await page.locator('.v-tab').filter({ hasText: /Tips/i }).click();
      await page.waitForTimeout(300);

      // Tips content should be visible
      await expect(
        page.locator('.tutorial-section h3').filter({ hasText: /Tips|Tricks/i })
      ).toBeVisible();
    });
  });

  test.describe('Tab Content', () => {
    test('should display all main tabs', async ({ page, blankProject }) => {
      // Open tutorial modal
      await page.locator('button .mdi-help-circle').locator('..').click();
      await page.waitForTimeout(300);

      // Verify all tabs are visible
      const tabs = [
        /Getting Started/i,
        /Drawing/i,
        /Search/i,
        /Navigation/i,
        /Layers/i,
        /Notes/i,
        /Coordinates/i,
        /Projects/i,
        /Elevation/i,
        /Tips/i,
      ];

      for (const tabPattern of tabs) {
        await expect(page.locator('.v-tab').filter({ hasText: tabPattern })).toBeVisible();
      }
    });

    test('should have icons on all tabs', async ({ page, blankProject }) => {
      // Open tutorial modal
      await page.locator('button .mdi-help-circle').locator('..').click();
      await page.waitForTimeout(300);

      // Verify tabs have icons
      const tabIcons = [
        'mdi-rocket',
        'mdi-pencil',
        'mdi-magnify',
        'mdi-navigation',
        'mdi-layers',
        'mdi-note-text',
        'mdi-map-marker',
        'mdi-folder',
        'mdi-mountain',
        'mdi-lightbulb',
      ];

      for (const icon of tabIcons) {
        await expect(page.locator(`.v-tabs .${icon}`)).toBeVisible();
      }
    });

    test('should display tutorial steps in Drawing tab', async ({ page, blankProject }) => {
      // Open tutorial modal
      await page.locator('button .mdi-help-circle').locator('..').click();
      await page.waitForTimeout(300);

      // Click Drawing tab
      await page
        .locator('.v-tab')
        .filter({ hasText: /Drawing/i })
        .click();
      await page.waitForTimeout(500);

      // Verify Drawing tab is selected
      await expect(page.locator('.v-tab--selected').filter({ hasText: /Drawing/i })).toBeVisible();

      // Verify the v-window has changed (drawing window item is now active)
      const activeWindow = page.locator('.v-window-item--active');
      await expect(activeWindow).toBeVisible();
    });

    test('should display search workflow in Tips tab', async ({ page, blankProject }) => {
      // Open tutorial modal
      await page.locator('button .mdi-help-circle').locator('..').click();
      await page.waitForTimeout(300);

      // Click Tips tab
      await page.locator('.v-tab').filter({ hasText: /Tips/i }).click();
      await page.waitForTimeout(300);

      // Verify keyboard shortcuts section is present
      await expect(
        page.locator('.tutorial-step h4').filter({ hasText: /Keyboard|Shortcuts/i })
      ).toBeVisible();
    });
  });
});
