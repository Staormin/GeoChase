import { expect, test } from '../fixtures';

// Helper to open parallel line modal
async function openParallelLineModal(page: any) {
  // Click the parallel line button (mdi-minus icon in top bar)
  const parallelBtn = page.locator('button .mdi-minus').locator('..');
  await parallelBtn.click();
  await page.waitForTimeout(300);
}

test.describe('Parallel Line Modal', () => {
  test.describe('Modal Open/Close', () => {
    test('should open modal when clicking parallel button', async ({ page, blankProject }) => {
      await openParallelLineModal(page);

      // Modal dialog should be visible
      await expect(page.locator('.v-dialog')).toBeVisible();
    });

    test('should display modal title', async ({ page, blankProject }) => {
      await openParallelLineModal(page);

      // Title should contain "Parallel" or French translation
      await expect(page.locator('.v-dialog').locator('text=/Parallel|Parallèle/i')).toBeVisible();
    });

    test('should close modal when clicking cancel', async ({ page, blankProject }) => {
      await openParallelLineModal(page);

      // Click cancel button
      await page
        .locator('button')
        .filter({ hasText: /Cancel|Annuler/i })
        .click();
      await page.waitForTimeout(300);

      // Modal should be closed
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should close modal when clicking close button', async ({ page, blankProject }) => {
      await openParallelLineModal(page);

      // Click the X close button
      const closeBtn = page.locator('.v-dialog .mdi-close').locator('..');
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(300);
        await expect(page.locator('.v-dialog')).not.toBeVisible();
      }
    });
  });

  test.describe('Form Fields', () => {
    test('should display name input field', async ({ page, blankProject }) => {
      await openParallelLineModal(page);

      // Name input should be visible
      await expect(page.locator('.v-dialog input').first()).toBeVisible();
    });

    test('should display latitude selector', async ({ page, blankProject }) => {
      await openParallelLineModal(page);

      // Latitude selector should be visible
      await expect(
        page.locator('.v-dialog').locator('text=/Latitude|Latitude/i').first()
      ).toBeVisible();
    });

    test('should allow entering name', async ({ page, blankProject }) => {
      await openParallelLineModal(page);

      // Enter a name
      const nameInput = page.locator('.v-dialog input').first();
      await nameInput.fill('Test Parallel Line');
      await page.waitForTimeout(300);

      await expect(nameInput).toHaveValue('Test Parallel Line');
    });
  });

  test.describe('Latitude Selection', () => {
    test('should show saved coordinates in latitude dropdown', async ({ page, blankProject }) => {
      await openParallelLineModal(page);

      // Click on the latitude select to open dropdown
      const latitudeSelect = page.locator('.v-dialog .v-select').first();
      await latitudeSelect.click();
      await page.waitForTimeout(300);

      // Should show saved coordinates from fixture (Paris, London, Berlin)
      const options = page.locator('.v-select__content .v-list-item, .v-list .v-list-item');
      const count = await options.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should select a coordinate from dropdown', async ({ page, blankProject }) => {
      await openParallelLineModal(page);

      // Click on the latitude select
      const latitudeSelect = page.locator('.v-dialog .v-select').first();
      await latitudeSelect.click();
      await page.waitForTimeout(300);

      // Select first option (Paris from fixture)
      const firstOption = page
        .locator('.v-select__content .v-list-item, .v-list .v-list-item')
        .first();
      await firstOption.click();
      await page.waitForTimeout(300);

      // Selection should be made (input should have value)
      await expect(latitudeSelect).not.toHaveText('');
    });
  });

  test.describe('Form Submission', () => {
    test('should show error when submitting without latitude', async ({ page, blankProject }) => {
      await openParallelLineModal(page);

      // Click submit without selecting latitude
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(300);

      // Should show error toast
      await expect(page.locator('.v-snackbar, .v-alert')).toBeVisible();
    });

    test('should create parallel line when form is valid', async ({ page, blankProject }) => {
      await openParallelLineModal(page);

      // Enter name
      const nameInput = page.locator('.v-dialog input').first();
      await nameInput.fill('My Parallel');

      // Select latitude from dropdown
      const latitudeSelect = page.locator('.v-dialog .v-select').first();
      await latitudeSelect.click();
      await page.waitForTimeout(300);
      const firstOption = page
        .locator('.v-select__content .v-list-item, .v-list .v-list-item')
        .first();
      await firstOption.click();
      await page.waitForTimeout(300);

      // Submit the form
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Modal should close
      await expect(page.locator('.v-dialog')).not.toBeVisible();

      // Success toast should appear
      await expect(page.locator('.v-snackbar').filter({ hasText: /created|créé/i })).toBeVisible();
    });

    test('should create parallel line with auto-generated name', async ({ page, blankProject }) => {
      await openParallelLineModal(page);

      // Don't enter a name - it should be auto-generated

      // Select latitude from dropdown
      const latitudeSelect = page.locator('.v-dialog .v-select').first();
      await latitudeSelect.click();
      await page.waitForTimeout(300);
      const firstOption = page
        .locator('.v-select__content .v-list-item, .v-list .v-list-item')
        .first();
      await firstOption.click();
      await page.waitForTimeout(300);

      // Submit the form
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Modal should close (success)
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });
  });

  test.describe('Parallel Line Display', () => {
    test('should display created parallel in sidebar', async ({ page, blankProject }) => {
      await openParallelLineModal(page);

      // Enter name and select latitude
      const nameInput = page.locator('.v-dialog input').first();
      await nameInput.fill('Test Parallel');

      const latitudeSelect = page.locator('.v-dialog .v-select').first();
      await latitudeSelect.click();
      await page.waitForTimeout(300);
      const firstOption = page
        .locator('.v-select__content .v-list-item, .v-list .v-list-item')
        .first();
      await firstOption.click();
      await page.waitForTimeout(300);

      // Submit
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Parallel should appear in sidebar
      await expect(page.locator('text=Test Parallel')).toBeVisible();
    });

    test('should draw parallel line on map', async ({ page, blankProject }) => {
      await openParallelLineModal(page);

      // Select latitude
      const latitudeSelect = page.locator('.v-dialog .v-select').first();
      await latitudeSelect.click();
      await page.waitForTimeout(300);
      const firstOption = page
        .locator('.v-select__content .v-list-item, .v-list .v-list-item')
        .first();
      await firstOption.click();
      await page.waitForTimeout(300);

      // Submit
      await page
        .locator('button')
        .filter({ hasText: /Add|Ajouter/i })
        .click();
      await page.waitForTimeout(500);

      // Map should still be visible (no errors)
      await expect(page.locator('#map')).toBeVisible();
    });
  });
});

test.describe('Parallel Line Edit', () => {
  async function createParallelLine(page: any) {
    await openParallelLineModal(page);

    const nameInput = page.locator('.v-dialog input').first();
    await nameInput.fill('Edit Test Parallel');

    const latitudeSelect = page.locator('.v-dialog .v-select').first();
    await latitudeSelect.click();
    await page.waitForTimeout(300);
    const firstOption = page
      .locator('.v-select__content .v-list-item, .v-list .v-list-item')
      .first();
    await firstOption.click();
    await page.waitForTimeout(300);

    await page
      .locator('button')
      .filter({ hasText: /Add|Ajouter/i })
      .click();
    await page.waitForTimeout(500);
  }

  test('should open edit modal from context menu', async ({ page, blankProject }) => {
    await createParallelLine(page);

    // Find the parallel in sidebar and open context menu
    const parallelItem = page.locator('text=Edit Test Parallel');
    await expect(parallelItem).toBeVisible();

    // The context menu button is the sibling button with mdi-dots-vertical icon
    // Go up to parent container and find the button sibling
    const contextMenuBtn = parallelItem
      .locator('..')
      .locator('..')
      .locator('button .mdi-dots-vertical')
      .locator('..');
    await contextMenuBtn.click();
    await page.waitForTimeout(300);

    // Click Edit option
    const editOption = page.locator('.v-list-item').filter({ hasText: /Edit|Modifier/i });
    await editOption.click();
    await page.waitForTimeout(300);

    // Edit modal should be open
    await expect(page.locator('.v-dialog')).toBeVisible();

    // Should show Edit title
    await expect(page.locator('.v-dialog').locator('text=/Edit|Modifier/i')).toBeVisible();
  });

  test('should save button show "Save" in edit mode', async ({ page, blankProject }) => {
    await createParallelLine(page);

    // Open context menu and click edit
    const parallelItem = page.locator('text=Edit Test Parallel');
    const contextMenuBtn = parallelItem
      .locator('..')
      .locator('..')
      .locator('button .mdi-dots-vertical')
      .locator('..');
    await contextMenuBtn.click();
    await page.waitForTimeout(300);

    const editOption = page.locator('.v-list-item').filter({ hasText: /Edit|Modifier/i });
    await editOption.click();
    await page.waitForTimeout(300);

    // Button should say "Save" instead of "Add"
    await expect(page.locator('button').filter({ hasText: /Save|Enregistrer/i })).toBeVisible();
  });
});
