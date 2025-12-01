import { expect, test } from '../fixtures';

// Create a simple test PDF as base64 (minimal valid PDF - 1 page)
const SIMPLE_PDF_BASE64 =
  'JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovUmVzb3VyY2VzIDw8Pj4KL0NvbnRlbnRzIDQgMCBSCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9MZW5ndGggMAo+PgpzdHJlYW0KZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTQ4IDAwMDAwIG4gCjAwMDAwMDAyNDcgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA1Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgoyOTYKJSVFT0YK';

// Create a 3-page test PDF as base64
const MULTI_PAGE_PDF_BASE64 =
  'JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUiA1IDAgUiA3IDAgUl0KL0NvdW50IDMKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovUmVzb3VyY2VzIDw8Pj4KL0NvbnRlbnRzIDQgMCBSCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9MZW5ndGggMAo+PgpzdHJlYW0KZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjw8Ci9UeXBlIC9QYWdlCi9QYXJlbnQgMiAwIFIKL1Jlc291cmNlcyA8PD4+Ci9Db250ZW50cyA2IDAgUgo+PgplbmRvYmoKNiAwIG9iago8PAovTGVuZ3RoIDAKPj4Kc3RyZWFtCmVuZHN0cmVhbQplbmRvYmoKNyAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDIgMCBSCi9SZXNvdXJjZXMgPDw+PgovQ29udGVudHMgOCAwIFIKPj4KZW5kb2JqCjggMCBvYmoKPDwKL0xlbmd0aCAwCj4+CnN0cmVhbQplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA5CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxNTYgMDAwMDAgbiAKMDAwMDAwMDI1NSAwMDAwMCBuIAowMDAwMDAwMzA0IDAwMDAwIG4gCjAwMDAwMDA0MDMgMDAwMDAgbiAKMDAwMDAwMDQ1MiAwMDAwMCBuIAowMDAwMDAwNTUxIDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgOQovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNjAwCiUlRU9GCg==';

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

    test('should close PDF panel when PDF button clicked again', async ({ page, blankProject }) => {
      await injectPdf(page, SIMPLE_PDF_BASE64);

      // Open PDF panel
      await page.locator('[data-testid="pdf-btn"]').click();
      await page.waitForTimeout(300);

      // Panel should be visible
      await expect(page.locator('.v-navigation-drawer--right')).toBeVisible();

      // Click PDF button again to close
      await page.locator('[data-testid="pdf-btn"]').click();
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
    test('should delete PDF when delete button clicked in toolbar', async ({
      page,
      blankProject,
    }) => {
      await injectPdf(page, SIMPLE_PDF_BASE64);

      // Open PDF panel
      await page.locator('[data-testid="pdf-btn"]').click();
      await page.waitForTimeout(300);

      // Panel should be visible
      await expect(page.locator('.v-navigation-drawer--right')).toBeVisible();

      // Click delete button in toolbar (now in PdfViewer component)
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

  test.describe('PDF Go To Page', () => {
    test('should show page input when clicking on page number', async ({ page, blankProject }) => {
      await injectPdf(page, MULTI_PAGE_PDF_BASE64, 'multi-page.pdf');

      // Open PDF panel
      await page.locator('[data-testid="pdf-btn"]').click();
      await page.waitForTimeout(500);

      // Click on the page number text (e.g., "1 / 3")
      await page.getByText('1 / 3').click();
      await page.waitForTimeout(300);

      // Input field should appear
      await expect(page.locator('.v-navigation-drawer--right input[type="number"]')).toBeVisible();
    });

    test('should navigate to entered page number', async ({ page, blankProject }) => {
      await injectPdf(page, MULTI_PAGE_PDF_BASE64, 'multi-page.pdf');

      // Open PDF panel
      await page.locator('[data-testid="pdf-btn"]').click();
      await page.waitForTimeout(500);

      // Click on the page number to show input
      await page.getByText('1 / 3').click();
      await page.waitForTimeout(300);

      // Clear and enter page 3
      const pageInput = page.locator('.v-navigation-drawer--right input[type="number"]');
      await pageInput.fill('3');
      await pageInput.press('Enter');
      await page.waitForTimeout(400);

      // Should now be on page 3
      await expect(page.getByText('3 / 3')).toBeVisible();
    });

    test('should cancel page input on Escape', async ({ page, blankProject }) => {
      await injectPdf(page, MULTI_PAGE_PDF_BASE64, 'multi-page.pdf');

      // Open PDF panel
      await page.locator('[data-testid="pdf-btn"]').click();
      await page.waitForTimeout(500);

      // Click on the page number to show input
      await page.getByText('1 / 3').click();
      await page.waitForTimeout(300);

      // Press Escape to cancel
      const pageInput = page.locator('.v-navigation-drawer--right input[type="number"]');
      await pageInput.press('Escape');
      await page.waitForTimeout(300);

      // Input should be hidden, page number text should be back
      await expect(pageInput).not.toBeVisible();
      await expect(page.getByText('1 / 3')).toBeVisible();
    });
  });

  test.describe('PDF Toolbar Buttons', () => {
    test('should have fit-to-page button with tooltip', async ({ page, blankProject }) => {
      await injectPdf(page, SIMPLE_PDF_BASE64);

      // Open PDF panel
      await page.locator('[data-testid="pdf-btn"]').click();
      await page.waitForTimeout(500);

      // Fit to page button should be visible
      const fitToPageBtn = page.locator(
        '.v-navigation-drawer--right button .mdi-fit-to-screen-outline'
      );
      await expect(fitToPageBtn).toBeVisible();

      // Hover to show tooltip
      await fitToPageBtn.hover();
      await page.waitForTimeout(300);

      // Tooltip should show
      await expect(page.getByText(/fit to page|ajuster à la page/i)).toBeVisible();
    });

    test('should have rotate button with tooltip', async ({ page, blankProject }) => {
      await injectPdf(page, SIMPLE_PDF_BASE64);

      // Open PDF panel
      await page.locator('[data-testid="pdf-btn"]').click();
      await page.waitForTimeout(500);

      // Rotate button should be visible
      const rotateBtn = page.locator('.v-navigation-drawer--right button .mdi-rotate-right');
      await expect(rotateBtn).toBeVisible();

      // Hover to show tooltip
      await rotateBtn.hover();
      await page.waitForTimeout(300);

      // Tooltip should show
      await expect(page.getByText(/rotate clockwise|rotation horaire/i)).toBeVisible();
    });

    test('should have download button with tooltip', async ({ page, blankProject }) => {
      await injectPdf(page, SIMPLE_PDF_BASE64);

      // Open PDF panel
      await page.locator('[data-testid="pdf-btn"]').click();
      await page.waitForTimeout(500);

      // Download button should be visible
      const downloadBtn = page.locator('.v-navigation-drawer--right button .mdi-download');
      await expect(downloadBtn).toBeVisible();

      // Hover to show tooltip
      await downloadBtn.hover();
      await page.waitForTimeout(300);

      // Tooltip should show
      await expect(page.getByText(/download pdf|télécharger/i)).toBeVisible();
    });

    test('should rotate PDF when clicking rotate button', async ({ page, blankProject }) => {
      await injectPdf(page, SIMPLE_PDF_BASE64);

      // Open PDF panel
      await page.locator('[data-testid="pdf-btn"]').click();
      await page.waitForTimeout(500);

      // Get initial canvas dimensions
      const canvas = page.locator('.v-navigation-drawer--right canvas').first();
      const initialBox = await canvas.boundingBox();

      // Click rotate button
      await page
        .locator('.v-navigation-drawer--right button')
        .filter({ has: page.locator('.mdi-rotate-right') })
        .click();
      await page.waitForTimeout(500);

      // Get new canvas dimensions - after 90° rotation, width and height should swap
      const rotatedBox = await canvas.boundingBox();

      // The aspect ratio should have changed (width/height ratio inverted)
      if (initialBox && rotatedBox) {
        const initialRatio = initialBox.width / initialBox.height;
        const rotatedRatio = rotatedBox.width / rotatedBox.height;
        // After 90° rotation, the ratio should be roughly inverted
        expect(Math.abs(initialRatio - 1 / rotatedRatio)).toBeLessThan(0.5);
      }
    });
  });

  test.describe('PDF Thumbnails', () => {
    test('should have thumbnails toggle button', async ({ page, blankProject }) => {
      await injectPdf(page, MULTI_PAGE_PDF_BASE64, 'multi-page.pdf');

      // Open PDF panel
      await page.locator('[data-testid="pdf-btn"]').click();
      await page.waitForTimeout(500);

      // Thumbnails button should be visible (outline icon when closed)
      const thumbnailsBtn = page.locator(
        '.v-navigation-drawer--right button .mdi-view-grid-outline'
      );
      await expect(thumbnailsBtn).toBeVisible();
    });

    test('should show thumbnails sidebar when toggle clicked', async ({ page, blankProject }) => {
      await injectPdf(page, MULTI_PAGE_PDF_BASE64, 'multi-page.pdf');

      // Open PDF panel
      await page.locator('[data-testid="pdf-btn"]').click();
      await page.waitForTimeout(500);

      // Click thumbnails toggle button
      await page
        .locator('.v-navigation-drawer--right button')
        .filter({ has: page.locator('.mdi-view-grid-outline') })
        .click();
      await page.waitForTimeout(500);

      // Thumbnails sidebar should appear with multiple canvas elements (one per page)
      const thumbnailCanvases = page.locator(
        '.v-navigation-drawer--right .bg-surface-light canvas'
      );
      await expect(thumbnailCanvases).toHaveCount(3); // 3 pages
    });

    test('should navigate to page when clicking thumbnail', async ({ page, blankProject }) => {
      await injectPdf(page, MULTI_PAGE_PDF_BASE64, 'multi-page.pdf');

      // Open PDF panel
      await page.locator('[data-testid="pdf-btn"]').click();
      await page.waitForTimeout(500);

      // Should start on page 1
      await expect(page.getByText('1 / 3')).toBeVisible();

      // Open thumbnails
      await page
        .locator('.v-navigation-drawer--right button')
        .filter({ has: page.locator('.mdi-view-grid-outline') })
        .click();
      await page.waitForTimeout(500);

      // Click on the third thumbnail (page 3)
      const thumbnails = page.locator('.v-navigation-drawer--right .bg-surface-light canvas');
      await thumbnails.nth(2).click();
      await page.waitForTimeout(400);

      // Should now be on page 3
      await expect(page.getByText('3 / 3')).toBeVisible();
    });

    test('should hide thumbnails sidebar when toggle clicked again', async ({
      page,
      blankProject,
    }) => {
      await injectPdf(page, MULTI_PAGE_PDF_BASE64, 'multi-page.pdf');

      // Open PDF panel
      await page.locator('[data-testid="pdf-btn"]').click();
      await page.waitForTimeout(500);

      // Open thumbnails
      await page
        .locator('.v-navigation-drawer--right button')
        .filter({ has: page.locator('.mdi-view-grid-outline') })
        .click();
      await page.waitForTimeout(500);

      // Thumbnails should be visible (use more specific selector for the thumbnails sidebar)
      const thumbnailCanvases = page.locator(
        '.v-navigation-drawer--right .bg-surface-light canvas'
      );
      await expect(thumbnailCanvases).toHaveCount(3);

      // Click toggle again (now has filled icon)
      await page
        .locator('.v-navigation-drawer--right button')
        .filter({ has: page.locator('.mdi-view-grid') })
        .click();
      await page.waitForTimeout(300);

      // Thumbnails should be hidden (no thumbnail canvases visible)
      await expect(thumbnailCanvases).toHaveCount(0);
    });
  });

  test.describe('PDF Wheel Navigation', () => {
    test('should go to next page when scrolling down on the page', async ({
      page,
      blankProject,
    }) => {
      await injectPdf(page, MULTI_PAGE_PDF_BASE64, 'multi-page.pdf');

      // Open PDF panel
      await page.locator('[data-testid="pdf-btn"]').click();
      await page.waitForTimeout(500);

      // Should start on page 1
      await expect(page.getByText('1 / 3')).toBeVisible();

      // Get the PDF canvas and scroll down on it
      const pdfCanvas = page.locator('.v-navigation-drawer--right canvas').first();
      await pdfCanvas.scrollIntoViewIfNeeded();

      // Scroll down (positive deltaY)
      await pdfCanvas.dispatchEvent('wheel', { deltaY: 100 });
      await page.waitForTimeout(400);

      // Should now be on page 2
      await expect(page.getByText('2 / 3')).toBeVisible();
    });

    test('should go to previous page when scrolling up on the page', async ({
      page,
      blankProject,
    }) => {
      await injectPdf(page, MULTI_PAGE_PDF_BASE64, 'multi-page.pdf');

      // Open PDF panel
      await page.locator('[data-testid="pdf-btn"]').click();
      await page.waitForTimeout(500);

      // Go to page 2 first using scroll down
      const pdfCanvas = page.locator('.v-navigation-drawer--right canvas').first();
      await pdfCanvas.dispatchEvent('wheel', { deltaY: 100 });
      await page.waitForTimeout(400);

      // Should be on page 2
      await expect(page.getByText('2 / 3')).toBeVisible();

      // Scroll up (negative deltaY)
      await pdfCanvas.dispatchEvent('wheel', { deltaY: -100 });
      await page.waitForTimeout(400);

      // Should now be back on page 1
      await expect(page.getByText('1 / 3')).toBeVisible();
    });

    test('should not go below page 1 when scrolling up on first page', async ({
      page,
      blankProject,
    }) => {
      await injectPdf(page, MULTI_PAGE_PDF_BASE64, 'multi-page.pdf');

      // Open PDF panel
      await page.locator('[data-testid="pdf-btn"]').click();
      await page.waitForTimeout(500);

      // Should start on page 1
      await expect(page.getByText('1 / 3')).toBeVisible();

      // Try to scroll up
      const pdfCanvas = page.locator('.v-navigation-drawer--right canvas').first();
      await pdfCanvas.dispatchEvent('wheel', { deltaY: -100 });
      await page.waitForTimeout(400);

      // Should still be on page 1
      await expect(page.getByText('1 / 3')).toBeVisible();
    });

    test('should not go beyond last page when scrolling down on last page', async ({
      page,
      blankProject,
    }) => {
      await injectPdf(page, MULTI_PAGE_PDF_BASE64, 'multi-page.pdf');

      // Open PDF panel
      await page.locator('[data-testid="pdf-btn"]').click();
      await page.waitForTimeout(500);

      // Navigate to page 3 (last page) - scroll down twice
      const pdfCanvas = page.locator('.v-navigation-drawer--right canvas').first();
      await pdfCanvas.dispatchEvent('wheel', { deltaY: 100 });
      await page.waitForTimeout(400);
      await pdfCanvas.dispatchEvent('wheel', { deltaY: 100 });
      await page.waitForTimeout(400);

      // Should be on page 3
      await expect(page.getByText('3 / 3')).toBeVisible();

      // Try to scroll down again
      await pdfCanvas.dispatchEvent('wheel', { deltaY: 100 });
      await page.waitForTimeout(400);

      // Should still be on page 3
      await expect(page.getByText('3 / 3')).toBeVisible();
    });
  });
});
