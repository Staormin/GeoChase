import { expect, test } from './fixtures';

/**
 * E2E tests for project management functionality
 * Tests: creation, naming, loading, and deletion
 */

test.describe('Project Management', () => {
  test('should create a new project with a custom name', async ({ page, cleanState }) => {
    // Open the save menu using JavaScript click to bypass Vuetify overlay interception
    await page.getByTestId('save-menu-btn').evaluate((el) => (el as HTMLElement).click());

    // Verify dropdown is visible
    await expect(page.getByTestId('save-menu-dropdown')).toBeVisible();

    // Click "New Project" using JavaScript click
    await page.getByTestId('new-project-btn').evaluate((el) => (el as HTMLElement).click());

    // Wait for modal to appear
    await expect(page.locator('text=New Project').first()).toBeVisible();

    // Enter project name (find input within the v-text-field wrapper)
    const projectName = 'Test Treasure Hunt';
    await page.getByTestId('project-name-input').locator('input').fill(projectName);

    // Create the project using JavaScript click
    await page.getByTestId('create-project-btn').evaluate((el) => (el as HTMLElement).click());

    // Verify success toast appears
    await expect(page.locator(`text=Project created`).first()).toBeVisible();

    // Verify the project is stored in localStorage
    const projects = await page.evaluate(() => {
      const stored = localStorage.getItem('geochase_projects');
      return stored ? JSON.parse(stored) : [];
    });

    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe(projectName);
  });

  test('should not create a project with empty name', async ({ page, cleanState }) => {
    // Open the save menu and click New Project using JavaScript click
    await page.getByTestId('save-menu-btn').evaluate((el) => (el as HTMLElement).click());
    await page.getByTestId('new-project-btn').evaluate((el) => (el as HTMLElement).click());

    // Try to create without entering a name
    await page.getByTestId('create-project-btn').evaluate((el) => (el as HTMLElement).click());

    // Verify error toast appears
    await expect(page.locator('text=Project name is required')).toBeVisible();

    // Verify no project was created
    const projects = await page.evaluate(() => {
      const stored = localStorage.getItem('geochase_projects');
      return stored ? JSON.parse(stored) : [];
    });

    expect(projects).toHaveLength(0);
  });

  test('should create multiple projects with different names', async ({ page, cleanState }) => {
    const projectNames = ['Project Alpha', 'Project Beta', 'Project Gamma'];

    for (const name of projectNames) {
      // Open save menu and create new project using JavaScript click
      await page.getByTestId('save-menu-btn').evaluate((el) => (el as HTMLElement).click());
      await page.getByTestId('new-project-btn').evaluate((el) => (el as HTMLElement).click());
      await page.getByTestId('project-name-input').locator('input').fill(name);
      await page.getByTestId('create-project-btn').evaluate((el) => (el as HTMLElement).click());

      // Wait for success toast
      await expect(page.locator(`text=Project created`).first()).toBeVisible();
      await page.waitForTimeout(500); // Brief pause for toast to disappear
    }

    // Verify all projects were created
    const projects = await page.evaluate(() => {
      const stored = localStorage.getItem('geochase_projects');
      return stored ? JSON.parse(stored) : [];
    });

    expect(projects).toHaveLength(3);
    const storedNames = projects.map((p: any) => p.name);
    expect(storedNames).toEqual(expect.arrayContaining(projectNames));
  });

  test('should load a saved project', async ({ page, cleanState }) => {
    // Create a test project first using JavaScript click
    const projectName = 'Load Test Project';
    await page.getByTestId('save-menu-btn').evaluate((el) => (el as HTMLElement).click());
    await page.getByTestId('new-project-btn').evaluate((el) => (el as HTMLElement).click());
    await page.getByTestId('project-name-input').locator('input').fill(projectName);
    await page.getByTestId('create-project-btn').evaluate((el) => (el as HTMLElement).click());
    await page.waitForTimeout(500);

    // Get the project ID from localStorage
    const projectId = await page.evaluate(() => {
      const stored = localStorage.getItem('geochase_projects');
      const projects = stored ? JSON.parse(stored) : [];
      return projects[0]?.id;
    });

    // Open load project modal using JavaScript click
    await page.getByTestId('save-menu-btn').evaluate((el) => (el as HTMLElement).click());
    await page.getByTestId('load-project-btn').evaluate((el) => (el as HTMLElement).click());

    // Verify modal shows the project
    await expect(page.locator('[data-testid="projects-list"]')).toBeVisible();
    await expect(page.locator(`[data-testid="project-name-${projectId}"]`)).toContainText(
      projectName
    );

    // Click load button
    await page.click(`[data-testid="load-project-${projectId}"]`);

    // Verify success toast
    await expect(page.locator(`text=Project loaded`)).toBeVisible();
  });

  test('should display project statistics in load modal', async ({ page, cleanState }) => {
    // Create a project using JavaScript click
    await page.getByTestId('save-menu-btn').evaluate((el) => (el as HTMLElement).click());
    await page.getByTestId('new-project-btn').evaluate((el) => (el as HTMLElement).click());
    await page.getByTestId('project-name-input').locator('input').fill('Stats Test');
    await page.getByTestId('create-project-btn').evaluate((el) => (el as HTMLElement).click());
    await page.waitForTimeout(500);

    // Open load modal using JavaScript click
    await page.getByTestId('save-menu-btn').evaluate((el) => (el as HTMLElement).click());
    await page.getByTestId('load-project-btn').evaluate((el) => (el as HTMLElement).click());

    // Verify project statistics are shown (empty project)
    await expect(page.locator('text=Circles: 0')).toBeVisible();
    await expect(page.locator('text=Lines: 0')).toBeVisible();
    await expect(page.locator('text=Points: 0')).toBeVisible();
  });

  test('should delete a project', async ({ page, cleanState }) => {
    // Create a test project using JavaScript click
    const projectName = 'Delete Test Project';
    await page.getByTestId('save-menu-btn').evaluate((el) => (el as HTMLElement).click());
    await page.getByTestId('new-project-btn').evaluate((el) => (el as HTMLElement).click());
    await page.getByTestId('project-name-input').locator('input').fill(projectName);
    await page.getByTestId('create-project-btn').evaluate((el) => (el as HTMLElement).click());
    await page.waitForTimeout(500);

    // Get project ID
    const projectId = await page.evaluate(() => {
      const stored = localStorage.getItem('geochase_projects');
      const projects = stored ? JSON.parse(stored) : [];
      return projects[0]?.id;
    });

    // Open load modal using JavaScript click
    await page.getByTestId('save-menu-btn').evaluate((el) => (el as HTMLElement).click());
    await page.getByTestId('load-project-btn').evaluate((el) => (el as HTMLElement).click());

    // Setup dialog handler to confirm deletion
    page.on('dialog', (dialog) => {
      expect(dialog.message()).toContain(`Delete "${projectName}"?`);
      dialog.accept();
    });

    // Click delete button
    await page.click(`[data-testid="delete-project-${projectId}"]`);

    // Verify success toast
    await expect(page.locator('text=Project deleted')).toBeVisible();

    // Verify project is removed from localStorage
    const projects = await page.evaluate(() => {
      const stored = localStorage.getItem('geochase_projects');
      return stored ? JSON.parse(stored) : [];
    });

    expect(projects).toHaveLength(0);
  });

  test('should cancel project deletion when dialog is dismissed', async ({ page, cleanState }) => {
    // Create a test project using JavaScript click
    const projectName = 'Persist Test Project';
    await page.getByTestId('save-menu-btn').evaluate((el) => (el as HTMLElement).click());
    await page.getByTestId('new-project-btn').evaluate((el) => (el as HTMLElement).click());
    await page.getByTestId('project-name-input').locator('input').fill(projectName);
    await page.getByTestId('create-project-btn').evaluate((el) => (el as HTMLElement).click());
    await page.waitForTimeout(500);

    // Get project ID
    const projectId = await page.evaluate(() => {
      const stored = localStorage.getItem('geochase_projects');
      const projects = stored ? JSON.parse(stored) : [];
      return projects[0]?.id;
    });

    // Open load modal using JavaScript click
    await page.getByTestId('save-menu-btn').evaluate((el) => (el as HTMLElement).click());
    await page.getByTestId('load-project-btn').evaluate((el) => (el as HTMLElement).click());

    // Setup dialog handler to CANCEL deletion
    page.on('dialog', (dialog) => {
      dialog.dismiss();
    });

    // Click delete button
    await page.click(`[data-testid="delete-project-${projectId}"]`);

    // Verify project still exists
    const projects = await page.evaluate(() => {
      const stored = localStorage.getItem('geochase_projects');
      return stored ? JSON.parse(stored) : [];
    });

    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe(projectName);
  });

  test('should show "No projects" when no projects exist', async ({ page, cleanState }) => {
    // Open load modal using JavaScript click
    await page.getByTestId('save-menu-btn').evaluate((el) => (el as HTMLElement).click());
    await page.getByTestId('load-project-btn').evaluate((el) => (el as HTMLElement).click());

    // Verify empty state message
    await expect(page.locator('text=No projects')).toBeVisible();
    await expect(page.locator('[data-testid="projects-list"]')).not.toBeVisible();
  });

  test('should close new project modal with cancel button', async ({ page, cleanState }) => {
    // Open new project modal using JavaScript click
    await page.getByTestId('save-menu-btn').evaluate((el) => (el as HTMLElement).click());
    await page.getByTestId('new-project-btn').evaluate((el) => (el as HTMLElement).click());

    // Verify modal is open
    await expect(page.locator('text=New Project').first()).toBeVisible();

    // Click cancel
    await page.click('[data-testid="cancel-project-btn"]');

    // Verify modal is closed
    await expect(page.locator('text=New Project').first()).not.toBeVisible();
  });

  test('should close load project modal with close button', async ({ page, cleanState }) => {
    // Create a project first using JavaScript click
    await page.getByTestId('save-menu-btn').evaluate((el) => (el as HTMLElement).click());
    await page.getByTestId('new-project-btn').evaluate((el) => (el as HTMLElement).click());
    await page.getByTestId('project-name-input').locator('input').fill('Test');
    await page.getByTestId('create-project-btn').evaluate((el) => (el as HTMLElement).click());
    await page.waitForTimeout(500);

    // Open load modal using JavaScript click
    await page.getByTestId('save-menu-btn').evaluate((el) => (el as HTMLElement).click());
    await page.getByTestId('load-project-btn').evaluate((el) => (el as HTMLElement).click());

    // Verify modal is open by checking for the close button
    await expect(page.getByTestId('close-load-modal-btn')).toBeVisible();

    // Click close
    await page.click('[data-testid="close-load-modal-btn"]');

    // Verify modal is closed by checking the close button is not visible
    await expect(page.getByTestId('close-load-modal-btn')).not.toBeVisible();
  });

  test('should persist projects across page reloads', async ({ page, cleanState }) => {
    // Create a project using JavaScript click
    const projectName = 'Persistence Test';
    await page.getByTestId('save-menu-btn').evaluate((el) => (el as HTMLElement).click());
    await page.getByTestId('new-project-btn').evaluate((el) => (el as HTMLElement).click());
    await page.getByTestId('project-name-input').locator('input').fill(projectName);
    await page.getByTestId('create-project-btn').evaluate((el) => (el as HTMLElement).click());
    await page.waitForTimeout(500);

    // Reload the page
    await page.reload();
    await page.waitForSelector('#map', { state: 'visible' });

    // Open load modal and verify project still exists using JavaScript click
    await page.getByTestId('save-menu-btn').evaluate((el) => (el as HTMLElement).click());
    await page.getByTestId('load-project-btn').evaluate((el) => (el as HTMLElement).click());

    await expect(page.locator(`text=${projectName}`)).toBeVisible();
  });
});
