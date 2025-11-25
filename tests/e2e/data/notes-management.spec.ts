import { expect, test } from '../fixtures';

/**
 * E2E tests for notes management functionality
 * Tests: creation, editing, deletion, linking to elements, and validation
 */

test.describe('Notes Management', () => {
  test('should create a simple note with title and content', async ({ page, blankProject }) => {
    // Click create note button
    await page.getByTestId('create-note-btn').evaluate((el) => (el as HTMLElement).click());

    // Wait for modal to appear - verify form fields are visible
    await expect(page.getByTestId('note-title-input')).toBeVisible();

    // Fill in note details
    await page.getByTestId('note-title-input').locator('input').fill('My First Note');
    await page
      .getByTestId('note-content-input')
      .locator('textarea')
      .fill('This is the content of my first note.');

    // Submit the note
    await page.getByTestId('submit-note-btn').evaluate((el) => (el as HTMLElement).click());

    // Verify success toast
    await expect(page.locator('text=Note created').first()).toBeVisible();

    // Wait for sidebar to update and note to appear
    await page.waitForTimeout(500);

    // Verify note appears in layers panel
    await expect(page.locator('text=My First Note')).toBeVisible();
  });

  test('should not create a note without a title', async ({ page, blankProject }) => {
    // Click create note button
    await page.getByTestId('create-note-btn').evaluate((el) => (el as HTMLElement).click());

    // Wait for modal to appear
    await expect(page.getByTestId('note-title-input')).toBeVisible();

    // Try to submit without title
    await page.getByTestId('note-content-input').locator('textarea').fill('Content without title');
    await page.getByTestId('submit-note-btn').evaluate((el) => (el as HTMLElement).click());

    // Verify error toast
    await expect(page.locator('text=This field is required').first()).toBeVisible();
  });

  test('should create multiple notes', async ({ page, blankProject }) => {
    const noteTitles = ['Note 1', 'Note 2', 'Note 3'];

    for (const title of noteTitles) {
      await page.getByTestId('create-note-btn').evaluate((el) => (el as HTMLElement).click());
      await expect(page.getByTestId('note-title-input')).toBeVisible();
      await page.getByTestId('note-title-input').locator('input').fill(title);
      await page.getByTestId('note-content-input').locator('textarea').fill(`Content for ${title}`);
      await page.getByTestId('submit-note-btn').evaluate((el) => (el as HTMLElement).click());

      await expect(page.locator(`text=Note created`).first()).toBeVisible();
      await page.waitForTimeout(500);
    }

    // Verify all notes appear in the panel
    for (const title of noteTitles) {
      await expect(page.locator(`text=${title}`)).toBeVisible();
    }
  });

  test('should edit an existing note', async ({ page, blankProject }) => {
    // Create a note first
    await page.getByTestId('create-note-btn').evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId('note-title-input')).toBeVisible();
    await page.getByTestId('note-title-input').locator('input').fill('Original Title');
    await page.getByTestId('note-content-input').locator('textarea').fill('Original content');
    await page.getByTestId('submit-note-btn').evaluate((el) => (el as HTMLElement).click());
    await expect(page.locator('text=Note created').first()).toBeVisible();
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
    await expect(page.locator('text=Note updated').first()).toBeVisible();

    // Verify updated title appears
    await expect(page.locator('text=Updated Title')).toBeVisible();
  });

  test('should delete a note with confirmation', async ({ page, blankProject }) => {
    // Create a note
    await page.getByTestId('create-note-btn').evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId('note-title-input')).toBeVisible();
    await page.getByTestId('note-title-input').locator('input').fill('Note to Delete');
    await page.getByTestId('note-content-input').locator('textarea').fill('This will be deleted');
    await page.getByTestId('submit-note-btn').evaluate((el) => (el as HTMLElement).click());
    await expect(page.locator('text=Note created').first()).toBeVisible();
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
      expect(dialog.message()).toContain('Note deleted');
      dialog.accept();
    });

    // Click delete button
    await page.getByTestId('delete-note-btn').evaluate((el) => (el as HTMLElement).click());

    // Verify success toast
    await expect(page.locator('text=Note deleted').first()).toBeVisible();

    // Verify note no longer appears
    await expect(page.locator('text=Note to Delete')).not.toBeVisible();
  });

  test('should cancel note deletion when dialog is dismissed', async ({ page, blankProject }) => {
    // Create a note
    await page.getByTestId('create-note-btn').evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId('note-title-input')).toBeVisible();
    await page.getByTestId('note-title-input').locator('input').fill('Persistent Note');
    await page.getByTestId('note-content-input').locator('textarea').fill('This should persist');
    await page.getByTestId('submit-note-btn').evaluate((el) => (el as HTMLElement).click());
    await expect(page.locator('text=Note created').first()).toBeVisible();
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

  test('should cancel note creation', async ({ page, blankProject }) => {
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

  test('should show link type selector when creating a note', async ({ page, blankProject }) => {
    // Open create note modal
    await page.getByTestId('create-note-btn').evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId('note-title-input')).toBeVisible();

    // Verify link type selector is present
    await expect(page.getByTestId('note-link-type-select')).toBeVisible();

    // Cancel the note
    await page.getByTestId('cancel-note-btn').evaluate((el) => (el as HTMLElement).click());
  });

  test('should reset form when canceling note creation', async ({ page, blankProject }) => {
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
    const contentValue = await page
      .getByTestId('note-content-input')
      .locator('textarea')
      .inputValue();

    expect(titleValue).toBe('');
    expect(contentValue).toBe('');
  });

  test('should handle long note content', async ({ page, blankProject }) => {
    const longContent = 'A'.repeat(1000);

    await page.getByTestId('create-note-btn').evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId('note-title-input')).toBeVisible();
    await page.getByTestId('note-title-input').locator('input').fill('Long Note');
    await page.getByTestId('note-content-input').locator('textarea').fill(longContent);
    await page.getByTestId('submit-note-btn').evaluate((el) => (el as HTMLElement).click());

    await expect(page.locator('text=Note created').first()).toBeVisible();
    await expect(page.locator('text=Long Note')).toBeVisible();
  });

  test('should trim whitespace from title and content', async ({ page, blankProject }) => {
    await page.getByTestId('create-note-btn').evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId('note-title-input')).toBeVisible();
    await page.getByTestId('note-title-input').locator('input').fill('  Trimmed Title  ');
    await page.getByTestId('note-content-input').locator('textarea').fill('  Trimmed Content  ');
    await page.getByTestId('submit-note-btn').evaluate((el) => (el as HTMLElement).click());

    await expect(page.locator('text=Note created').first()).toBeVisible();
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

  test('should show correct button text for create vs edit', async ({ page, blankProject }) => {
    // Create mode
    await page.getByTestId('create-note-btn').evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId('note-title-input')).toBeVisible();
    await expect(page.getByTestId('submit-note-btn')).toContainText('Add');
    await page.getByTestId('cancel-note-btn').evaluate((el) => (el as HTMLElement).click());

    // Edit mode - create a note first
    await page.getByTestId('create-note-btn').evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId('note-title-input')).toBeVisible();
    await page.getByTestId('note-title-input').locator('input').fill('Test Note');
    await page.getByTestId('submit-note-btn').evaluate((el) => (el as HTMLElement).click());
    await expect(page.locator('text=Note created').first()).toBeVisible();
    await page.waitForTimeout(500);

    // Find the note in the sidebar and click the context menu
    const noteItem = page.locator('.layer-item').filter({ hasText: 'Test Note' });
    await noteItem.getByTestId('note-context-menu-btn').click();

    // Click Edit from the dropdown
    await page.locator('text=Edit').click();

    // Verify edit mode UI
    await expect(page.getByTestId('note-title-input')).toBeVisible();
    await expect(page.getByTestId('submit-note-btn')).toContainText('Save');
    await expect(page.getByTestId('delete-note-btn')).toBeVisible();
  });
});
