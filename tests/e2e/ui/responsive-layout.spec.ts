import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';

async function expectAccessibleToolbar(page: Page, minimumButtonSize = 32) {
  const toolbar = page.getByTestId('topbar');
  await expect(toolbar).toBeVisible();
  await expect(toolbar.locator('.v-btn')).toHaveCount(17);

  await expect
    .poll(() =>
      toolbar.evaluate((element, minimumSize) => {
        const controls = Array.from(element.querySelectorAll('.v-btn, .v-input'));
        const bounds = controls.map((control) => control.getBoundingClientRect());
        const issues: string[] = [];
        for (const [index, control] of controls.entries()) {
          const rect = bounds[index]!;
          const label = control.getAttribute('aria-label') || `control ${index}`;
          if (
            rect.left < 0 ||
            rect.right > innerWidth ||
            rect.top < 0 ||
            rect.bottom > innerHeight
          ) {
            issues.push(`${label} is outside the viewport`);
          }
          if (
            control.matches('.v-btn') &&
            (rect.width < minimumSize || rect.height < minimumSize)
          ) {
            issues.push(`${label} is too small`);
          }
          const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
          if (!hit || !control.contains(hit)) issues.push(`${label} is covered`);
          for (const other of bounds.slice(index + 1)) {
            if (
              rect.left < other.right &&
              rect.right > other.left &&
              rect.top < other.bottom &&
              rect.bottom > other.top
            ) {
              issues.push(`${label} overlaps another control`);
            }
          }
        }
        return issues;
      }, minimumButtonSize)
    )
    .toEqual([]);
}

async function expectSingleRowToolbar(page: Page) {
  await expect
    .poll(() =>
      page.getByTestId('topbar').evaluate((toolbar) => {
        const controls = Array.from(toolbar.querySelectorAll('.v-btn, .v-input'));
        const tops = controls.map((control) => control.getBoundingClientRect().top);
        return (
          toolbar.getBoundingClientRect().height <= 48 && Math.max(...tops) - Math.min(...tops) <= 1
        );
      })
    )
    .toBe(true);
}

async function openSidebar(page: Page) {
  const open = page.getByRole('button', { name: 'Open sidebar', exact: true });
  if (await open.count()) await open.click();
  await expect(page.getByRole('button', { name: 'Close sidebar', exact: true })).toBeInViewport();
}

for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 800, height: 450 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  test.describe(`${viewport.width} × ${viewport.height}`, () => {
    test.use({ viewport });

    test('keeps toolbar controls and sidebar toggle visible and clickable', async ({
      page,
      blankProject,
    }) => {
      await expectAccessibleToolbar(page);
      if (viewport.width >= 1024) await expectSingleRowToolbar(page);
      await openSidebar(page);
      await expectAccessibleToolbar(page);
      await expect
        .poll(async () => {
          const toolbar = await page.getByTestId('topbar').boundingBox();
          const sidebar = await page.getByTestId('layers-sidebar').boundingBox();
          return (
            !!toolbar &&
            !!sidebar &&
            Math.abs(sidebar.y - toolbar.height) <= 1 &&
            sidebar.x + sidebar.width <= viewport.width
          );
        })
        .toBe(true);

      await page.getByTestId('draw-circle-btn').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByTestId('save-menu-btn').click();
      await expect(page.getByTestId('new-project-btn')).toBeVisible();
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Close sidebar', exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Open sidebar', exact: true })
      ).toBeInViewport();
    });
  });
}

test('updates panel offsets when the toolbar wraps or collapses', async ({
  page,
  blankProject,
}) => {
  for (const width of [1920, 1366, 768, 390, 1920]) {
    await page.setViewportSize({ width, height: 844 });
    await expectAccessibleToolbar(page);
    await openSidebar(page);
    await expect
      .poll(async () => {
        const toolbar = await page.getByTestId('topbar').boundingBox();
        const sidebar = await page.getByTestId('layers-sidebar').boundingBox();
        return !!toolbar && !!sidebar && Math.abs(sidebar.y - toolbar.height) <= 1;
      })
      .toBe(true);
    await page.getByRole('button', { name: 'Collapse top bar', exact: true }).click();
    await expect
      .poll(async () => (await page.getByTestId('layers-sidebar').boundingBox())?.y)
      .toBe(0);
    await page.getByRole('button', { name: 'Expand top bar', exact: true }).click();
  }
  await expectAccessibleToolbar(page);
});

test.describe('Scaled desktop viewport', () => {
  test.use({ viewport: { width: 1155, height: 360 }, deviceScaleFactor: 1.6 });

  test('preserves a compact single row on a scaled display', async ({ page, blankProject }) => {
    await expectAccessibleToolbar(page);
    await expectSingleRowToolbar(page);
    await page.getByText('Geoportail (IGN)', { exact: true }).click();
    await page.getByRole('option', { name: 'OpenStreetMap', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Map Provider' })).toHaveValue('OpenStreetMap');
    await expectSingleRowToolbar(page);
    await page.getByTestId('save-menu-btn').click();
    await expect(page.getByTestId('new-project-btn')).toBeVisible();
  });
});

test.describe('High density touch screen', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
  });

  test('keeps touch targets large enough without overlapping', async ({ page, blankProject }) => {
    await expectAccessibleToolbar(page, 44);
  });
});
