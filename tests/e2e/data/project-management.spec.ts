import { expect, test } from '../fixtures';

test.describe('Project Management', () => {
  test.describe('Save Menu', () => {
    test('should display save menu button', async ({ page, blankProject }) => {
      await expect(page.locator('[data-testid="save-menu-btn"]')).toBeVisible();
    });

    test('should open save menu dropdown', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);

      await expect(page.locator('[data-testid="save-menu-dropdown"]')).toBeVisible();
    });

    test('should show new project option in menu', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);

      await expect(page.locator('[data-testid="new-project-btn"]')).toBeVisible();
    });

    test('should show load project option in menu', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);

      await expect(page.locator('[data-testid="load-project-btn"]')).toBeVisible();
    });

    test('should show export JSON option in menu', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);

      await expect(page.locator('[data-testid="export-json-btn"]')).toBeVisible();
    });

    test('should show import JSON option in menu', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);

      await expect(page.locator('[data-testid="import-json-btn"]')).toBeVisible();
    });
  });

  test.describe('New Project Modal', () => {
    test('should open new project modal from menu', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="new-project-btn"]').click();
      await page.waitForTimeout(300);

      await expect(page.locator('.v-dialog')).toBeVisible();
    });

    test('should have project name input', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="new-project-btn"]').click();
      await page.waitForTimeout(300);

      await expect(page.locator('[data-testid="project-name-input"]')).toBeVisible();
    });

    test('should have cancel and create buttons', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="new-project-btn"]').click();
      await page.waitForTimeout(300);

      await expect(page.locator('[data-testid="cancel-project-btn"]')).toBeVisible();
      await expect(page.locator('[data-testid="create-project-btn"]')).toBeVisible();
    });

    test('should close modal with cancel button', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="new-project-btn"]').click();
      await page.waitForTimeout(300);

      await page.locator('[data-testid="cancel-project-btn"]').click();
      await page.waitForTimeout(300);

      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should close modal with escape key', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="new-project-btn"]').click();
      await page.waitForTimeout(300);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should show error when creating project without name', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="new-project-btn"]').click();
      await page.waitForTimeout(300);

      // Leave name empty and click create
      await page.locator('[data-testid="create-project-btn"]').click();
      await page.waitForTimeout(300);

      // Should show error toast
      await expect(page.locator('.v-snackbar').first()).toBeVisible();
    });

    test('should create project with valid name', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="new-project-btn"]').click();
      await page.waitForTimeout(300);

      await page.locator('[data-testid="project-name-input"] input').fill('My Test Project');
      await page.locator('[data-testid="create-project-btn"]').click();
      await page.waitForTimeout(500);

      // Modal should close and success toast should appear
      await expect(page.locator('.v-dialog')).not.toBeVisible();
      await expect(page.locator('.v-snackbar').first()).toBeVisible();
    });

    test('should submit with enter key', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="new-project-btn"]').click();
      await page.waitForTimeout(300);

      await page.locator('[data-testid="project-name-input"] input').fill('Enter Key Project');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      // Modal should close
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });
  });

  test.describe('Load Project Modal', () => {
    test('should open load project modal from menu', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="load-project-btn"]').click();
      await page.waitForTimeout(300);

      await expect(page.locator('.v-dialog')).toBeVisible();
    });

    test('should display load project title', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="load-project-btn"]').click();
      await page.waitForTimeout(300);

      await expect(
        page.locator('.v-card-title').filter({ hasText: /Load Project|Charger/i })
      ).toBeVisible();
    });

    test('should show project from fixture in list', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="load-project-btn"]').click();
      await page.waitForTimeout(300);

      // Should show the fixture project "Test Project"
      await expect(page.locator('[data-testid="projects-list"]')).toBeVisible();
    });

    test('should close modal with close button', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="load-project-btn"]').click();
      await page.waitForTimeout(300);

      await page.locator('[data-testid="close-load-modal-btn"]').click();
      await page.waitForTimeout(300);

      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should close modal with escape key', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="load-project-btn"]').click();
      await page.waitForTimeout(300);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should show projects list after creating a project', async ({ page, blankProject }) => {
      // First create a project
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="new-project-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="project-name-input"] input').fill('Test Project');
      await page.locator('[data-testid="create-project-btn"]').click();
      await page.waitForTimeout(500);

      // Now open load project modal
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="load-project-btn"]').click();
      await page.waitForTimeout(300);

      // Should show projects list
      await expect(page.locator('[data-testid="projects-list"]')).toBeVisible();
    });

    test('should display project name in list', async ({ page, blankProject }) => {
      // First create a project
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="new-project-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="project-name-input"] input').fill('My Named Project');
      await page.locator('[data-testid="create-project-btn"]').click();
      await page.waitForTimeout(500);

      // Open load project modal
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="load-project-btn"]').click();
      await page.waitForTimeout(300);

      // Should show project name
      await expect(
        page.locator('.v-list-item').filter({ hasText: 'My Named Project' })
      ).toBeVisible();
    });

    test('should show load and delete buttons for project', async ({ page, blankProject }) => {
      // Open load project modal
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="load-project-btn"]').click();
      await page.waitForTimeout(300);

      // Should show load and delete buttons (folder-open and delete icons)
      await expect(page.locator('.v-dialog .mdi-folder-open').first()).toBeVisible();
      await expect(page.locator('.v-dialog .mdi-delete').first()).toBeVisible();
    });
  });

  test.describe('Coordinates Modal', () => {
    test('should display coordinates button', async ({ page, blankProject }) => {
      await expect(page.locator('[data-testid="coordinates-btn"]')).toBeVisible();
    });

    test('should open coordinates modal', async ({ page, blankProject }) => {
      await page.locator('[data-testid="coordinates-btn"]').click();
      await page.waitForTimeout(300);

      await expect(page.locator('.v-dialog')).toBeVisible();
    });

    test('should display saved coordinates from fixture', async ({ page, blankProject }) => {
      await page.locator('[data-testid="coordinates-btn"]').click();
      await page.waitForTimeout(300);

      // blankProject fixture has Paris, London, Berlin coordinates
      await expect(page.locator('.v-dialog').locator('text=Paris')).toBeVisible();
    });
  });

  test.describe('Note Creation', () => {
    test('should display create note button', async ({ page, blankProject }) => {
      await expect(page.locator('[data-testid="create-note-btn"]')).toBeVisible();
    });

    test('should open note modal', async ({ page, blankProject }) => {
      await page.locator('[data-testid="create-note-btn"]').click();
      await page.waitForTimeout(300);

      await expect(page.locator('.v-dialog')).toBeVisible();
    });
  });

  test.describe('Animation Button', () => {
    test('should display animation button', async ({ page, blankProject }) => {
      await expect(page.locator('[data-testid="animation-btn"]')).toBeVisible();
    });

    test('should open animation modal', async ({ page, blankProject }) => {
      await page.locator('[data-testid="animation-btn"]').click();
      await page.waitForTimeout(300);

      await expect(page.locator('.v-dialog')).toBeVisible();
    });
  });

  test.describe('Map Provider Selector', () => {
    test('should display map provider selector', async ({ page, blankProject }) => {
      await expect(page.locator('.v-navigation-drawer .v-select')).toBeVisible();
    });

    test('should show Geoportail as default', async ({ page, blankProject }) => {
      await expect(
        page.locator('.v-navigation-drawer .v-select__selection').filter({ hasText: 'Geoportail' })
      ).toBeVisible();
    });

    test('should allow changing map provider', async ({ page, blankProject }) => {
      await page.locator('.v-navigation-drawer .v-select .v-select__menu-icon').click();
      await page.waitForTimeout(300);

      // Should show map provider options
      await expect(
        page.locator('.v-select__content .v-list-item').filter({ hasText: 'OpenStreetMap' })
      ).toBeVisible();
    });
  });

  test.describe('Top Bar Toggle', () => {
    test('should have collapse button', async ({ page, blankProject }) => {
      await expect(page.locator('button .mdi-chevron-up').locator('..')).toBeVisible();
    });

    test('should collapse top bar', async ({ page, blankProject }) => {
      await page.locator('button .mdi-chevron-up').locator('..').click();
      await page.waitForTimeout(500);

      // Top bar should be collapsed - look for expand icon
      await expect(page.locator('button .mdi-chevron-down').locator('..')).toBeVisible();
    });

    test('should expand top bar after collapse', async ({ page, blankProject }) => {
      // Collapse
      await page.locator('button .mdi-chevron-up').locator('..').click();
      await page.waitForTimeout(500);

      // Expand
      await page.locator('button .mdi-chevron-down').locator('..').click();
      await page.waitForTimeout(500);

      // Should show collapse icon again
      await expect(page.locator('button .mdi-chevron-up').locator('..')).toBeVisible();
    });
  });
});
