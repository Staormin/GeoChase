import { expect, test } from '@playwright/test';

/**
 * E2E tests for notes management functionality
 * Tests: creation, editing, deletion, linking to elements, and validation
 */

test.describe('Notes Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app and wait for it to be ready
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('#map', { state: 'visible', timeout: 60_000 });
    await page.waitForTimeout(300);

    // Clear only notes from localStorage to start with a clean notes slate
    // but keep projects to avoid the New Project modal
    await page.evaluate(() => {
      const projects = localStorage.getItem('gpxCircle_projects');
      localStorage.clear();
      if (projects) {
        localStorage.setItem('gpxCircle_projects', projects);
      } else {
        // Create a default project if none exists
        const defaultProject = {
          id: 'test-project',
          name: 'Test Project',
          circles: [],
          lineSegments: [],
          points: [],
          polygons: [],
          notes: [],
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
        };
        localStorage.setItem('gpxCircle_projects', JSON.stringify([defaultProject]));
      }
    });

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#map', { state: 'visible', timeout: 60_000 });
    await page.waitForTimeout(300);

    // Close New Project modal if it appears
    const projectNameInput = page.getByTestId('project-name-input');
    if (await projectNameInput.isVisible().catch(() => false)) {
      await projectNameInput.locator('input').fill('Test Project');
      await page.getByTestId('create-project-btn').evaluate((el) => (el as HTMLElement).click());
      await page.waitForTimeout(500);
    }
  });

  test('should create a simple note with title and content', async ({ page }) => {
    // Click create note button
    await page.getByTestId('create-note-btn').evaluate((el) => (el as HTMLElement).click());

    // Wait for modal to appear - verify form fields are visible
    await expect(page.getByTestId('note-title-input')).toBeVisible();

    // Fill in note details
    await page.getByTestId('note-title-input').locator('input').fill('My First Note');
    await page.getByTestId('note-content-input').locator('textarea').fill('This is the content of my first note.');

    // Submit the note
    await page.getByTestId('submit-note-btn').evaluate((el) => (el as HTMLElement).click());

    // Verify success toast
    await expect(page.locator('text=Note created successfully!').first()).toBeVisible();

    // Wait for sidebar to update and note to appear
    await page.waitForTimeout(500);

    // Verify note appears in layers panel
    await expect(page.locator('text=My First Note')).toBeVisible();
  });

  test('should not create a note without a title', async ({ page }) => {
    // Click create note button
    await page.getByTestId('create-note-btn').evaluate((el) => (el as HTMLElement).click());

    // Wait for modal to appear
    await expect(page.getByTestId('note-title-input')).toBeVisible();

    // Try to submit without title
    await page.getByTestId('note-content-input').locator('textarea').fill('Content without title');
    await page.getByTestId('submit-note-btn').evaluate((el) => (el as HTMLElement).click());

    // Verify error toast
    await expect(page.locator('text=Title is required').first()).toBeVisible();
  });

  test('should create multiple notes', async ({ page }) => {
    const noteTitles = ['Note 1', 'Note 2', 'Note 3'];

    for (const title of noteTitles) {
      await page.getByTestId('create-note-btn').evaluate((el) => (el as HTMLElement).click());
      await expect(page.getByTestId('note-title-input')).toBeVisible();
      await page.getByTestId('note-title-input').locator('input').fill(title);
      await page.getByTestId('note-content-input').locator('textarea').fill(`Content for ${title}`);
      await page.getByTestId('submit-note-btn').evaluate((el) => (el as HTMLElement).click());

      await expect(page.locator(`text=Note created successfully!`).first()).toBeVisible();
      await page.waitForTimeout(500);
    }

    // Verify all notes appear in the panel
    for (const title of noteTitles) {
      await expect(page.locator(`text=${title}`)).toBeVisible();
    }
  });

  test('should edit an existing note', async ({ page }) => {
    // Create a note first
    await page.getByTestId('create-note-btn').evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId('note-title-input')).toBeVisible();
    await page.getByTestId('note-title-input').locator('input').fill('Original Title');
    await page.getByTestId('note-content-input').locator('textarea').fill('Original content');
    await page.getByTestId('submit-note-btn').evaluate((el) => (el as HTMLElement).click());
    await expect(page.locator('text=Note created successfully!').first()).toBeVisible();
    await page.waitForTimeout(500);

    // Find the note in the sidebar and click the context menu
    const noteItem = page.locator('.layer-item').filter({ hasText: 'Original Title' });
    await noteItem.getByTestId('note-context-menu-btn').click();

    // Click Edit from the dropdown
    await page.locator('text=Edit').click();

    // Wait for edit modal
    await expect(page.getByTestId('note-title-input')).toBeVisible();

    // Update the note
    await page.getByTestId('note-title-input').locator('input').fill('Updated Title');
    await page.getByTestId('note-content-input').locator('textarea').fill('Updated content');
    await page.getByTestId('submit-note-btn').evaluate((el) => (el as HTMLElement).click());

    // Verify success toast
    await expect(page.locator('text=Note updated successfully!').first()).toBeVisible();

    // Verify updated title appears
    await expect(page.locator('text=Updated Title')).toBeVisible();
  });

  test('should delete a note with confirmation', async ({ page }) => {
    // Create a note
    await page.getByTestId('create-note-btn').evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId('note-title-input')).toBeVisible();
    await page.getByTestId('note-title-input').locator('input').fill('Note to Delete');
    await page.getByTestId('note-content-input').locator('textarea').fill('This will be deleted');
    await page.getByTestId('submit-note-btn').evaluate((el) => (el as HTMLElement).click());
    await expect(page.locator('text=Note created successfully!').first()).toBeVisible();
    await page.waitForTimeout(500);

    // Find the note in the sidebar and click the context menu
    const noteItem = page.locator('.layer-item').filter({ hasText: 'Note to Delete' });
    await noteItem.getByTestId('note-context-menu-btn').click();

    // Click Edit from the dropdown
    await page.locator('text=Edit').click();

    // Wait for edit modal
    await expect(page.getByTestId('note-title-input')).toBeVisible();

    // Setup dialog handler to confirm deletion
    page.on('dialog', (dialog) => {
      expect(dialog.message()).toContain('Are you sure you want to delete this note?');
      dialog.accept();
    });

    // Click delete button
    await page.getByTestId('delete-note-btn').evaluate((el) => (el as HTMLElement).click());

    // Verify success toast
    await expect(page.locator('text=Note deleted successfully!').first()).toBeVisible();

    // Verify note no longer appears
    await expect(page.locator('text=Note to Delete')).not.toBeVisible();
  });

  test('should cancel note deletion when dialog is dismissed', async ({ page }) => {
    // Create a note
    await page.getByTestId('create-note-btn').evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId('note-title-input')).toBeVisible();
    await page.getByTestId('note-title-input').locator('input').fill('Persistent Note');
    await page.getByTestId('note-content-input').locator('textarea').fill('This should persist');
    await page.getByTestId('submit-note-btn').evaluate((el) => (el as HTMLElement).click());
    await expect(page.locator('text=Note created successfully!').first()).toBeVisible();
    await page.waitForTimeout(500);

    // Find the note in the sidebar and click the context menu
    const noteItem = page.locator('.layer-item').filter({ hasText: 'Persistent Note' });
    await noteItem.getByTestId('note-context-menu-btn').click();

    // Click Edit from the dropdown
    await page.locator('text=Edit').click();

    // Wait for edit modal
    await expect(page.getByTestId('note-title-input')).toBeVisible();

    // Setup dialog handler to CANCEL deletion
    page.on('dialog', (dialog) => {
      dialog.dismiss();
    });

    // Try to delete
    await page.getByTestId('delete-note-btn').evaluate((el) => (el as HTMLElement).click());

    // Verify note still exists
    await expect(page.locator('text=Persistent Note')).toBeVisible();
  });

  test('should cancel note creation', async ({ page }) => {
    // Open create note modal
    await page.getByTestId('create-note-btn').evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId('note-title-input')).toBeVisible();

    // Fill in some data
    await page.getByTestId('note-title-input').locator('input').fill('Cancelled Note');

    // Cancel
    await page.getByTestId('cancel-note-btn').evaluate((el) => (el as HTMLElement).click());

    // Verify modal is closed (input should not be visible)
    await expect(page.getByTestId('note-title-input')).not.toBeVisible();

    // Verify note was not created
    await expect(page.locator('text=Cancelled Note')).not.toBeVisible();
  });

  test('should show link type selector when creating a note', async ({ page }) => {
    // Open create note modal
    await page.getByTestId('create-note-btn').evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId('note-title-input')).toBeVisible();

    // Verify link type selector is present
    await expect(page.getByTestId('note-link-type-select')).toBeVisible();

    // Cancel the note
    await page.getByTestId('cancel-note-btn').evaluate((el) => (el as HTMLElement).click());
  });

  test('should reset form when canceling note creation', async ({ page }) => {
    // Open create note modal
    await page.getByTestId('create-note-btn').evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId('note-title-input')).toBeVisible();

    // Fill in data
    const title = 'Test Title';
    const content = 'Test Content';
    await page.getByTestId('note-title-input').locator('input').fill(title);
    await page.getByTestId('note-content-input').locator('textarea').fill(content);

    // Cancel
    await page.getByTestId('cancel-note-btn').evaluate((el) => (el as HTMLElement).click());

    // Reopen modal
    await page.getByTestId('create-note-btn').evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId('note-title-input')).toBeVisible();

    // Verify fields are empty (form should be reset)
    const titleValue = await page.getByTestId('note-title-input').locator('input').inputValue();
    const contentValue = await page.getByTestId('note-content-input').locator('textarea').inputValue();

    expect(titleValue).toBe('');
    expect(contentValue).toBe('');
  });

  test('should handle long note content', async ({ page }) => {
    const longContent = 'A'.repeat(1000);

    await page.getByTestId('create-note-btn').evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId('note-title-input')).toBeVisible();
    await page.getByTestId('note-title-input').locator('input').fill('Long Note');
    await page.getByTestId('note-content-input').locator('textarea').fill(longContent);
    await page.getByTestId('submit-note-btn').evaluate((el) => (el as HTMLElement).click());

    await expect(page.locator('text=Note created successfully!').first()).toBeVisible();
    await expect(page.locator('text=Long Note')).toBeVisible();
  });

  test('should trim whitespace from title and content', async ({ page }) => {
    await page.getByTestId('create-note-btn').evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId('note-title-input')).toBeVisible();
    await page.getByTestId('note-title-input').locator('input').fill('  Trimmed Title  ');
    await page.getByTestId('note-content-input').locator('textarea').fill('  Trimmed Content  ');
    await page.getByTestId('submit-note-btn').evaluate((el) => (el as HTMLElement).click());

    await expect(page.locator('text=Note created successfully!').first()).toBeVisible();
    await page.waitForTimeout(500);

    // Find the note in the sidebar and click the context menu
    const noteItem = page.locator('.layer-item').filter({ hasText: 'Trimmed Title' });
    await noteItem.getByTestId('note-context-menu-btn').click();

    // Click Edit from the dropdown
    await page.locator('text=Edit').click();

    // Wait for edit modal
    await expect(page.getByTestId('note-title-input')).toBeVisible();

    const titleValue = await page.getByTestId('note-title-input').locator('input').inputValue();
    expect(titleValue).toBe('Trimmed Title');
  });

  test('should show correct button text for create vs edit', async ({ page }) => {
    // Create mode
    await page.getByTestId('create-note-btn').evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId('note-title-input')).toBeVisible();
    await expect(page.getByTestId('submit-note-btn')).toContainText('Create');
    await page.getByTestId('cancel-note-btn').evaluate((el) => (el as HTMLElement).click());

    // Edit mode - create a note first
    await page.getByTestId('create-note-btn').evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId('note-title-input')).toBeVisible();
    await page.getByTestId('note-title-input').locator('input').fill('Test Note');
    await page.getByTestId('submit-note-btn').evaluate((el) => (el as HTMLElement).click());
    await expect(page.locator('text=Note created successfully!').first()).toBeVisible();
    await page.waitForTimeout(500);

    // Find the note in the sidebar and click the context menu
    const noteItem = page.locator('.layer-item').filter({ hasText: 'Test Note' });
    await noteItem.getByTestId('note-context-menu-btn').click();

    // Click Edit from the dropdown
    await page.locator('text=Edit').click();

    // Verify edit mode UI
    await expect(page.getByTestId('note-title-input')).toBeVisible();
    await expect(page.getByTestId('submit-note-btn')).toContainText('Update');
    await expect(page.getByTestId('delete-note-btn')).toBeVisible();
  });
});
