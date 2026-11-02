import type { useHistoryStore } from '../../../src/stores/history';
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';

async function setup(page: Page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__note_visibility_init__')) return;
    sessionStorage.setItem('__note_visibility_init__', '1');
    localStorage.setItem('gpxCircle_language', 'en');
    localStorage.setItem('geochase_activeProjectId', 'notes');
    localStorage.setItem(
      'geochase_projects',
      JSON.stringify([
        {
          id: 'notes',
          name: 'Notes',
          createdAt: 1,
          updatedAt: 1,
          data: {
            points: [
              { id: 'a', name: 'Alpha', coordinates: { lat: 48, lon: 2 }, noteId: 'clue' },
              { id: 'b', name: 'Bravo', coordinates: { lat: 48.001, lon: 2.001 }, noteId: 'hint' },
            ],
            circles: [],
            lineSegments: [],
            polygons: [],
            notes: [
              {
                id: 'clue',
                title: 'Clue',
                content: 'First',
                linkedElementType: 'point',
                linkedElementId: 'a',
              },
              {
                id: 'hint',
                title: 'Hint',
                content: 'Second',
                linkedElementType: 'point',
                linkedElementId: 'b',
              },
            ],
          },
        },
      ])
    );
  });
  await page.goto('/');
  await page.waitForSelector('#map', { state: 'visible' });
}

async function flushHistory(page: Page) {
  await page.evaluate(async () => {
    const app = document.querySelector('#app') as HTMLElement & {
      __vue_app__: {
        config: {
          globalProperties: { $pinia: { _s: Map<string, ReturnType<typeof useHistoryStore>> } };
        };
      };
    };
    await app.__vue_app__.config.globalProperties.$pinia._s.get('history')!.flush();
  });
}

function tooltip(page: Page, id: string) {
  return page.locator(`.note-tooltip-card[data-note-id="${id}"]`);
}

test('notes hide individually and by category, with undo and persistence', async ({ page }) => {
  await setup(page);
  await expect(tooltip(page, 'clue')).toBeVisible();
  await expect(tooltip(page, 'hint')).toBeVisible();

  const row = page.locator('[data-layer-id="clue"]');
  await row.getByTestId('note-context-menu-btn').click();
  await page.getByTestId('note-toggle-visibility').click();
  await expect(tooltip(page, 'clue')).toHaveCount(0);
  await expect(tooltip(page, 'hint')).toBeVisible();
  await expect(row).toHaveClass(/layer-item-hidden/);

  await page.getByTestId('undo-btn').click();
  await expect(tooltip(page, 'clue')).toBeVisible();
  await expect(row).not.toHaveClass(/layer-item-hidden/);

  const control = page.locator('[data-visibility-category="note"]');
  await expect(control).toHaveAttribute('aria-keyshortcuts', 'Alt+N');
  await control.click();
  await expect(control).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.note-tooltip-card')).toHaveCount(0);
  await page.keyboard.press('Alt+n');
  await expect(control).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.note-tooltip-card')).toHaveCount(2);

  await page.getByTitle('Hide all notes', { exact: true }).click();
  await expect(page.locator('.note-tooltip-card')).toHaveCount(0);
  await flushHistory(page);
  await page.reload();
  await page.waitForSelector('#map', { state: 'visible' });
  await expect(page.locator('[data-layer-id="hint"]')).toHaveClass(/layer-item-hidden/);
  await expect(control).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.note-tooltip-card')).toHaveCount(0);
  // Hidden notes keep their linked points on the map.
  await expect(page.locator('[data-layer-id="a"]')).not.toHaveClass(/layer-item-hidden/);
});
