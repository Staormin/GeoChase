import { expect, test } from '../fixtures';

test.describe('Language Settings', () => {
  test.describe('Language Modal', () => {
    test('should open language modal from topbar', async ({ page, blankProject }) => {
      // Click the language button (translate icon)
      await page.locator('button .mdi-translate').locator('..').click();
      await page.waitForTimeout(300);

      // Verify language modal is open
      const modal = page.locator('.v-dialog');
      await expect(modal).toBeVisible();

      // Verify modal title contains language settings text
      await expect(
        page.locator('.v-card-title').filter({ hasText: /Language|Langue/i })
      ).toBeVisible();
    });

    test('should display both language options', async ({ page, blankProject }) => {
      // Open language modal
      await page.locator('button .mdi-translate').locator('..').click();
      await page.waitForTimeout(300);

      // Verify English option is visible
      await expect(page.locator('.language-card').filter({ hasText: /English/i })).toBeVisible();

      // Verify French option is visible
      await expect(page.locator('.language-card').filter({ hasText: /Français/i })).toBeVisible();
    });

    test('should highlight currently selected language', async ({ page, blankProject }) => {
      // Open language modal
      await page.locator('button .mdi-translate').locator('..').click();
      await page.waitForTimeout(300);

      // English should be selected (based on fixture setting)
      const englishCard = page.locator('.language-card').filter({ hasText: /English/i });
      await expect(englishCard).toHaveClass(/selected/);
    });

    test('should close language modal with close button', async ({ page, blankProject }) => {
      // Open language modal
      await page.locator('button .mdi-translate').locator('..').click();
      await page.waitForTimeout(300);

      // Verify modal is open
      await expect(page.locator('.v-dialog')).toBeVisible();

      // Click close button (X icon in title bar)
      const closeBtn = page.locator('.v-dialog .v-card-title button');
      await closeBtn.click();
      await page.waitForTimeout(300);

      // Modal should be closed
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });
  });

  test.describe('Language Switching', () => {
    test('should switch from English to French', async ({ page, blankProject }) => {
      // Open language modal
      await page.locator('button .mdi-translate').locator('..').click();
      await page.waitForTimeout(300);

      // Click French option
      await page
        .locator('.language-card')
        .filter({ hasText: /Français/i })
        .click();
      await page.waitForTimeout(300);

      // Click Confirm button
      await page
        .locator('button')
        .filter({ hasText: /Confirm/i })
        .click();
      await page.waitForTimeout(500);

      // Verify UI text changed to French (check topbar title)
      await expect(page.locator('.text-h6').filter({ hasText: /GeoChase/i })).toBeVisible();

      // Verify a French text element is present (button tooltips or menu items)
      // Open save menu and check for French text
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);

      // Should show French menu items (use first() to avoid strict mode violation)
      await expect(
        page
          .locator('.v-list-item')
          .filter({ hasText: /Nouveau projet/i })
          .first()
      ).toBeVisible();
    });

    test('should switch from French to English', async ({ page, blankProject }) => {
      // First switch to French
      await page.locator('button .mdi-translate').locator('..').click();
      await page.waitForTimeout(300);
      await page
        .locator('.language-card')
        .filter({ hasText: /Français/i })
        .click();
      await page.waitForTimeout(300);
      await page
        .locator('button')
        .filter({ hasText: /Confirm/i })
        .click();
      await page.waitForTimeout(500);

      // Now switch back to English
      await page.locator('button .mdi-translate').locator('..').click();
      await page.waitForTimeout(300);
      await page
        .locator('.language-card')
        .filter({ hasText: /English/i })
        .click();
      await page.waitForTimeout(300);
      await page
        .locator('button')
        .filter({ hasText: /Confirmer/i })
        .click();
      await page.waitForTimeout(500);

      // Open save menu and check for English text
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);

      // Should show English menu items (use first() to avoid strict mode violation)
      await expect(
        page
          .locator('.v-list-item')
          .filter({ hasText: /New Project/i })
          .first()
      ).toBeVisible();
    });

    test('should persist language after page reload', async ({ page, blankProject }) => {
      // Switch to French
      await page.locator('button .mdi-translate').locator('..').click();
      await page.waitForTimeout(300);
      await page
        .locator('.language-card')
        .filter({ hasText: /Français/i })
        .click();
      await page.waitForTimeout(300);
      await page
        .locator('button')
        .filter({ hasText: /Confirm/i })
        .click();
      await page.waitForTimeout(500);

      // Reload the page
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForSelector('#map', { state: 'visible', timeout: 60_000 });
      await page.waitForTimeout(500);

      // Open save menu and verify French text is still shown
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);

      // Should still show French menu items (use first() to avoid strict mode violation)
      await expect(
        page
          .locator('.v-list-item')
          .filter({ hasText: /Nouveau projet/i })
          .first()
      ).toBeVisible();
    });

    test('should show success toast when language is changed', async ({ page, blankProject }) => {
      // Open language modal
      await page.locator('button .mdi-translate').locator('..').click();
      await page.waitForTimeout(300);

      // Click French option
      await page
        .locator('.language-card')
        .filter({ hasText: /Français/i })
        .click();
      await page.waitForTimeout(300);

      // Click Confirm button
      await page
        .locator('button')
        .filter({ hasText: /Confirm/i })
        .click();
      await page.waitForTimeout(500);

      // Verify toast notification appeared (success snackbar)
      const toast = page.locator('.v-snackbar');
      await expect(toast).toBeVisible();
    });
  });

  test.describe('Language Selection UI', () => {
    test('should show check icon on selected language', async ({ page, blankProject }) => {
      // Open language modal
      await page.locator('button .mdi-translate').locator('..').click();
      await page.waitForTimeout(300);

      // English card should have check icon
      const englishCard = page.locator('.language-card').filter({ hasText: /English/i });
      await expect(englishCard.locator('.mdi-check-circle')).toBeVisible();

      // French card should not have check icon initially
      const frenchCard = page.locator('.language-card').filter({ hasText: /Français/i });
      await expect(frenchCard.locator('.mdi-check-circle')).not.toBeVisible();

      // Click French card
      await frenchCard.click();
      await page.waitForTimeout(300);

      // Now French should have check icon
      await expect(frenchCard.locator('.mdi-check-circle')).toBeVisible();

      // English should no longer have check icon
      await expect(englishCard.locator('.mdi-check-circle')).not.toBeVisible();
    });

    test('should enable confirm button only when language is selected', async ({
      page,
      blankProject,
    }) => {
      // Open language modal
      await page.locator('button .mdi-translate').locator('..').click();
      await page.waitForTimeout(300);

      // Confirm button should be enabled (English is already selected)
      const confirmBtn = page.locator('button').filter({ hasText: /Confirm/i });
      await expect(confirmBtn).not.toBeDisabled();
    });
  });
});
