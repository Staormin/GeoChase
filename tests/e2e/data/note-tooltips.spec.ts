import type { MapContainer } from '../../../src/composables/useMap';
import type { ProjectData } from '../../../src/types/project';
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';

async function tooltipPosition(page: Page) {
  return page.evaluate(() => {
    const element = document.querySelector('#map') as HTMLElement & {
      __vueParentComponent?: { provides: Record<symbol, unknown> };
    };
    const providers = element.__vueParentComponent?.provides;
    if (!providers) throw new Error('Map provider was not initialized');
    const key = Object.getOwnPropertySymbols(providers).find(
      (key) => key.description === 'mapContainer'
    );
    if (!key) throw new Error('Map provider was not initialized');
    const container = providers[key] as MapContainer;
    const overlay = container.map.value
      ?.getOverlays()
      .getArray()
      .find((overlay) => overlay.getElement()?.querySelector('[data-note-id="editable-note"]'));
    return {
      actual: overlay?.getPosition(),
      expected: container.pointsSource.value
        ?.getFeatureById('second-point')
        ?.getGeometry()
        ?.getExtent()
        .slice(0, 2),
    };
  });
}

test('editing a visible note refreshes its text and moves it to the newly linked point', async ({
  page,
}) => {
  const project = {
    id: 'note-tooltip-project',
    name: 'Note tooltip project',
    viewData: {
      topPanelOpen: true,
      sidePanelOpen: true,
      mapView: { lat: 48.858, lon: 2.356, zoom: 14 },
    },
    data: {
      circles: [],
      lineSegments: [],
      polygons: [],
      points: [
        {
          id: 'first-point',
          name: 'First marker',
          coordinates: { lat: 48.8566, lon: 2.3522 },
          noteId: 'editable-note',
        },
        { id: 'second-point', name: 'Second marker', coordinates: { lat: 48.86, lon: 2.36 } },
      ],
      notes: [
        {
          id: 'editable-note',
          title: 'Before edit',
          content: 'Original content',
          linkedElementType: 'point',
          linkedElementId: 'first-point',
        },
      ],
    },
  } satisfies ProjectData;
  await page.addInitScript((project) => {
    if (sessionStorage.getItem('note-tooltip-initialized')) return;
    sessionStorage.setItem('note-tooltip-initialized', 'true');
    localStorage.setItem('geochase_projects', JSON.stringify([project]));
    localStorage.setItem('geochase_activeProjectId', project.id);
    localStorage.setItem('gpxCircle_language', 'en');
  }, project);
  await page.goto('./');
  const tooltip = page.locator('.note-tooltip-card[data-note-id="editable-note"]');
  await expect(tooltip).toBeVisible();
  await expect(tooltip.locator('.note-tooltip-title')).toHaveText('Before edit');
  const before = await tooltipPosition(page);
  expect(before.actual).toBeDefined();
  expect(before.actual).not.toEqual(before.expected);

  await tooltip.click();
  await page.getByTestId('note-title-input').locator('input').fill('After edit');
  await page.getByTestId('note-content-input').locator('textarea').fill('Updated content');
  await page
    .getByTestId('note-link-element-select')
    .locator('input[type="text"]')
    .fill('Second marker');
  await page.getByRole('option', { name: 'Second marker', exact: true }).click();
  await page.getByTestId('submit-note-btn').click();
  await expect(page.getByTestId('note-title-input')).not.toBeVisible();
  await expect(tooltip.locator('.note-tooltip-title')).toHaveText('After edit');
  await expect(tooltip.locator('.note-tooltip-text')).toHaveText('Updated content');
  await expect
    .poll(() => tooltipPosition(page))
    .toEqual({ actual: before.expected, expected: before.expected });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const projects: ProjectData[] = JSON.parse(localStorage.getItem('geochase_projects')!);
        return projects[0]?.data.notes[0];
      })
    )
    .toMatchObject({
      title: 'After edit',
      content: 'Updated content',
      linkedElementId: 'second-point',
    });
});
