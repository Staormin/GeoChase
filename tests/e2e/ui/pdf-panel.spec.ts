import { expect, test } from '../fixtures';

// Create a simple test PDF as base64 (minimal valid PDF)
const SIMPLE_PDF_BASE64 =
  'JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovUmVzb3VyY2VzIDw8Pj4KL0NvbnRlbnRzIDQgMCBSCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9MZW5ndGggMAo+PgpzdHJlYW0KZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTQ4IDAwMDAwIG4gCjAwMDAwMDAyNDcgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA1Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgoyOTYKJSVFT0YK';

// Helper to inject PDF into IndexedDB
async function injectPdf(page: any, pdfData: string, pdfName = 'test.pdf') {
  await page.evaluate(
    async ({ data, name }: { data: string; name: string }) => {
      const DB_NAME = 'geochase_pdf_storage';
      const STORE_NAME = 'pdfs';

      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.addEventListener('upgradeneeded', (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'projectId' });
          }
        });

        request.addEventListener('success', () => {
          const db = request.result;
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          const store = transaction.objectStore(STORE_NAME);

          const activeProjectId = localStorage.getItem('geochase_activeProjectId');
          const record = {
            projectId: activeProjectId,
            data: 'data:application/pdf;base64,' + data,
            name,
            updatedAt: Date.now(),
          };

          store.put(record);
          transaction.addEventListener('complete', () => resolve());
          transaction.addEventListener('error', () => reject(transaction.error));
        });

        request.addEventListener('error', () => reject(request.error));
      });
    },
    { data: pdfData, name: pdfName }
  );

  // Reload to pick up the PDF
  await page.reload();
  await page.waitForSelector('#map', { state: 'visible' });
  await page.waitForTimeout(500);
}

test.describe('PDF Panel', () => {
  test.describe('PDF Upload Button', () => {
    test('should display PDF button in top bar', async ({ page, blankProject }) => {
      // PDF button should be visible next to tutorial button
      await expect(page.locator('[data-testid="pdf-btn"]')).toBeVisible();
    });

    test('should show PDF tooltip on hover', async ({ page, blankProject }) => {
      const pdfBtn = page.locator('[data-testid="pdf-btn"]');
      await pdfBtn.hover();
      await page.waitForTimeout(300);

      // Should show PDF title in tooltip (matches i18n pdf.title)
      await expect(page.getByText(/PDF Document|Document PDF/i)).toBeVisible();
    });
  });

  test.describe('PDF Panel Display', () => {
    test('should open PDF panel when PDF exists and button clicked', async ({
      page,
      blankProject,
    }) => {
      await injectPdf(page, SIMPLE_PDF_BASE64);

      // Click PDF button to open panel
      await page.locator('[data-testid="pdf-btn"]').click();
      await page.waitForTimeout(300);

      // Panel should be visible
      await expect(page.locator('.v-navigation-drawer--right')).toBeVisible();
    });

    test('should display PDF filename in panel header', async ({ page, blankProject }) => {
      await injectPdf(page, SIMPLE_PDF_BASE64, 'my-document.pdf');

      // Open PDF panel
      await page.locator('[data-testid="pdf-btn"]').click();
      await page.waitForTimeout(300);

      // Should show filename
      await expect(page.getByText('my-document.pdf')).toBeVisible();
    });

    test('should close PDF panel when close button clicked', async ({ page, blankProject }) => {
      await injectPdf(page, SIMPLE_PDF_BASE64);

      // Open PDF panel
      await page.locator('[data-testid="pdf-btn"]').click();
      await page.waitForTimeout(300);

      // Panel should be visible
      await expect(page.locator('.v-navigation-drawer--right')).toBeVisible();

      // Click close button (use icon button with mdi-close)
      await page.locator('.v-navigation-drawer--right .mdi-close').click();
      await page.waitForTimeout(500);

      // Panel should be hidden (check for the drawer being not visible)
      await expect(page.locator('.v-navigation-drawer--right:not([inert])')).not.toBeVisible();
    });
  });

  test.describe('PDF Panel Resize', () => {
    test('should have resize handle on left edge', async ({ page, blankProject }) => {
      await injectPdf(page, SIMPLE_PDF_BASE64);

      // Open PDF panel
      await page.locator('[data-testid="pdf-btn"]').click();
      await page.waitForTimeout(300);

      // Resize handle should be visible
      await expect(page.locator('.pdf-panel-resize-handle')).toBeVisible();
    });

    test('should change cursor on resize handle hover', async ({ page, blankProject }) => {
      await injectPdf(page, SIMPLE_PDF_BASE64);

      // Open PDF panel
      await page.locator('[data-testid="pdf-btn"]').click();
      await page.waitForTimeout(300);

      // Get the resize handle's cursor style
      const cursor = await page.locator('.pdf-panel-resize-handle').evaluate((el) => {
        return window.getComputedStyle(el).cursor;
      });

      expect(cursor).toBe('ew-resize');
    });

    test('should resize panel width when dragging', async ({ page, blankProject }) => {
      await injectPdf(page, SIMPLE_PDF_BASE64);

      // Open PDF panel
      await page.locator('[data-testid="pdf-btn"]').click();
      await page.waitForTimeout(300);

      // Get initial width
      const initialWidth = await page
        .locator('.v-navigation-drawer--right')
        .evaluate((el) => el.clientWidth);

      // Drag resize handle to the left (increase width)
      const resizeHandle = page.locator('.pdf-panel-resize-handle');
      const handleBox = await resizeHandle.boundingBox();

      if (handleBox) {
        await page.mouse.move(
          handleBox.x + handleBox.width / 2,
          handleBox.y + handleBox.height / 2
        );
        await page.mouse.down();
        await page.mouse.move(handleBox.x - 100, handleBox.y + handleBox.height / 2);
        await page.mouse.up();
      }

      await page.waitForTimeout(100);

      // Get new width
      const newWidth = await page
        .locator('.v-navigation-drawer--right')
        .evaluate((el) => el.clientWidth);

      // Width should have increased
      expect(newWidth).toBeGreaterThan(initialWidth);
    });
  });

  test.describe('PDF Delete', () => {
    test('should delete PDF when delete button clicked', async ({ page, blankProject }) => {
      await injectPdf(page, SIMPLE_PDF_BASE64);

      // Open PDF panel
      await page.locator('[data-testid="pdf-btn"]').click();
      await page.waitForTimeout(300);

      // Panel should be visible
      await expect(page.locator('.v-navigation-drawer--right')).toBeVisible();

      // Click delete button
      await page
        .locator('.v-navigation-drawer--right button')
        .filter({ has: page.locator('.mdi-delete') })
        .click();
      await page.waitForTimeout(300);

      // Panel should be hidden after delete
      await expect(page.locator('.v-navigation-drawer--right')).not.toBeVisible();

      // Success toast should appear
      await expect(page.getByText(/deleted|supprimé/i)).toBeVisible();
    });
  });
});
