import type { MapContainer } from '../../../src/composables/useMap';
import type { useHistoryStore } from '../../../src/stores/history';
import type { ProjectData } from '../../../src/types/project';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { expect, test } from '../fixtures';

async function createPoint(page: Page, name: string) {
  await page.getByTestId('draw-point-btn').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Point Name', { exact: true }).fill(name);
  await dialog.getByLabel('Coordinates', { exact: true }).fill('48.8, 2.3');
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.layer-item-name').getByText(name, { exact: true })).toBeVisible();
}

async function mapState(page: Page) {
  return page.evaluate(() => {
    const element = document.querySelector('#map') as HTMLElement & {
      __vueParentComponent: { provides: Record<symbol, MapContainer> };
    };
    const provides = element.__vueParentComponent.provides;
    const key = Object.getOwnPropertySymbols(provides).find(
      (symbol) => symbol.description === 'mapContainer'
    )!;
    const map = provides[key]!;
    const points = map.pointsSource.value!.getFeatures();
    const polygons = map.polygonsSource.value!.getFeatures();
    const overlays = map.map.value!.getOverlays().getArray();
    return {
      points: points.map((feature) => feature.getId()).toSorted(),
      pointExtents: points.map((feature) => feature.getGeometry()!.getExtent()),
      polygons: polygons.map((feature) => feature.getId()).toSorted(),
      labels: overlays
        .filter((overlay) => String(overlay.get('id')).startsWith('label-'))
        .map((overlay) => overlay.getElement()?.textContent)
        .toSorted(),
      center: map.map.value!.getView().getCenter(),
      animating: map.map.value!.getView().getAnimating(),
    };
  });
}

async function stored(page: Page): Promise<ProjectData> {
  return page.evaluate(() => {
    const projects = JSON.parse(localStorage.getItem('geochase_projects')!) as ProjectData[];
    return projects.find(
      (project) => project.id === localStorage.getItem('geochase_activeProjectId')
    )!;
  });
}

async function flushHistory(page: Page) {
  return page.evaluate(async () => {
    const app = document.querySelector('#app') as HTMLElement & {
      __vue_app__: {
        config: {
          globalProperties: { $pinia: { _s: Map<string, ReturnType<typeof useHistoryStore>> } };
        };
      };
    };
    const history = app.__vue_app__.config.globalProperties.$pinia._s.get('history')!;
    await history.flush();
    return { undo: history.undoCount, redo: history.redoCount };
  });
}

async function openLinkedHistoryProject(page: Page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__linked_history_init__')) return;
    sessionStorage.setItem('__linked_history_init__', '1');
    localStorage.setItem('gpxCircle_language', 'en');
    localStorage.setItem('geochase_activeProjectId', 'linked-history');
    localStorage.setItem(
      'geochase_projects',
      JSON.stringify([
        {
          id: 'linked-history',
          name: 'Linked history',
          projection: 'mercator',
          data: {
            points: [
              { id: 'a', name: 'Endpoint A', coordinates: { lat: 48, lon: 2 }, lineId: 'line' },
            ],
            circles: [],
            lineSegments: [
              {
                id: 'line',
                name: 'Linked line',
                mode: 'coordinate',
                center: { lat: 48, lon: 2 },
                endpoint: { lat: 49, lon: 3 },
                startPointId: 'a',
                pointsOnLine: [],
              },
            ],
            polygons: [],
            notes: [],
          },
        },
      ])
    );
  });
  await page.goto('/');
}

test('reopening the active project preserves the redo branch and current map', async ({ page }) => {
  await openLinkedHistoryProject(page);
  const row = page.locator('[data-layer-id="a"]');
  await expect(row).toBeVisible();
  await flushHistory(page);
  for (const coordinates of ['48.5, 2.5', '48.6, 2.6']) {
    await row.locator('button').last().click();
    await page.locator('.v-menu .v-list:visible').getByText('Edit', { exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Coordinates', { exact: true }).fill(coordinates);
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).toBeHidden();
    await flushHistory(page);
  }
  const finalData = (await stored(page)).data;
  const finalMap = await mapState(page);
  await page.getByTestId('undo-btn').click();
  expect(await flushHistory(page)).toEqual({ undo: 1, redo: 1 });
  const before = (await stored(page)).data;
  await expect.poll(async () => (await mapState(page)).animating).toBe(false);
  const beforeMap = await mapState(page);

  await page.getByTestId('save-menu-btn').click();
  await page.getByTestId('load-project-btn').click();
  await page.getByTestId('load-project-linked-history').click();
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(await flushHistory(page)).toEqual({ undo: 1, redo: 1 });
  expect((await stored(page)).data).toEqual(before);
  expect(await mapState(page)).toEqual(beforeMap);

  await page.reload();
  await expect(page.getByTestId('redo-btn')).toBeEnabled();
  expect(await flushHistory(page)).toEqual({ undo: 1, redo: 1 });
  await page.getByTestId('redo-btn').click();
  expect(await flushHistory(page)).toEqual({ undo: 2, redo: 0 });
  expect((await stored(page)).data).toEqual(finalData);
  await expect.poll(async () => (await mapState(page)).pointExtents).toEqual(finalMap.pointExtents);
});

test('moving a line endpoint keeps exact undo and redo through repeated reloads', async ({
  page,
}) => {
  await openLinkedHistoryProject(page);
  const row = page.locator('[data-layer-id="a"]');
  await expect(row).toBeVisible();
  await flushHistory(page);
  const originalMap = await mapState(page);
  await row.locator('button').last().click();
  await page.locator('.v-menu .v-list:visible').getByText('Edit', { exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Coordinates', { exact: true }).fill('48.5, 2.5');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
  await flushHistory(page);
  const moved = (await stored(page)).data;
  const movedMap = await mapState(page);
  expect(moved.points[0]!.coordinates).toEqual({ lat: 48.5, lon: 2.5 });
  expect(moved.lineSegments[0]!.startPointId).toBe('a');

  for (let reload = 0; reload < 2; reload++) {
    await page.reload();
    await expect(row).toBeVisible();
    await flushHistory(page);
    await expect(page.getByTestId('undo-btn')).toBeEnabled();
    await expect(page.getByTestId('redo-btn')).toBeDisabled();
    // Let the real 500ms autosave debounce run before the next reload.
    await page.waitForTimeout(600);
    expect((await stored(page)).data).toEqual(moved);
  }
  await page.getByTestId('save-menu-btn').click();
  await page.getByTestId('new-project-btn').click();
  await page.getByTestId('project-name-input').locator('input').fill('Other project');
  await page.getByTestId('create-project-btn').click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByTestId('save-menu-btn').click();
  await page.getByTestId('load-project-btn').click();
  await page.getByTestId('load-project-linked-history').click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByTestId('undo-btn')).toBeEnabled();
  await page.getByTestId('undo-btn').click();
  await flushHistory(page);
  const undone = (await stored(page)).data;
  expect(undone.points[0]!.coordinates).toEqual({ lat: 48, lon: 2 });
  expect(undone.lineSegments[0]!.startPointId).toBe('a');
  await expect
    .poll(async () => (await mapState(page)).pointExtents)
    .toEqual(originalMap.pointExtents);
  await expect(page.getByTestId('undo-btn')).toBeDisabled();
  await page.reload();
  await expect(page.getByTestId('redo-btn')).toBeEnabled();
  await page.getByTestId('redo-btn').click();
  await flushHistory(page);
  expect((await stored(page)).data).toEqual(moved);
  await expect.poll(async () => (await mapState(page)).pointExtents).toEqual(movedMap.pointExtents);
  await expect.poll(async () => (await mapState(page)).points).toEqual(['a']);
});

for (const failure of ['QuotaExceededError', 'UnknownError']) {
  test(`reload discards stale history after a permanent ${failure}`, async ({
    page,
    blankProject,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await createPoint(page, 'Added A');
    await flushHistory(page);
    await createPoint(page, 'Added B');
    await flushHistory(page);
    await page.evaluate((errorName) => {
      const originalPut = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = new Proxy(originalPut, {
        apply(target, store: IDBObjectStore, args: Parameters<typeof originalPut>) {
          if (store.name === 'histories') throw new DOMException('Storage unavailable', errorName);
          return Reflect.apply(target, store, args);
        },
      });
    }, failure);

    const row = page.locator('.layer-item').filter({ hasText: 'Added A' });
    await row.locator('button').last().click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('.v-menu .v-list:visible').getByText('Delete', { exact: true }).click();
    await flushHistory(page);
    await expect.poll(async () => (await mapState(page)).labels).not.toContain('Added A');
    expect((await stored(page)).data.points.map((point) => point.name)).not.toContain('Added A');

    await page.reload();
    await expect(
      page.locator('.layer-item-name').getByText('Added B', { exact: true })
    ).toBeVisible();
    await flushHistory(page);
    await expect(page.getByTestId('undo-btn')).toBeDisabled();
    await expect(page.getByTestId('redo-btn')).toBeDisabled();
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await mapState(page)).points.length).toBe(4);

    // Further edits start a valid history from the surviving project contents.
    await createPoint(page, 'Added C');
    await flushHistory(page);
    await page.getByTestId('undo-btn').click();
    await flushHistory(page);
    await page.reload();
    await expect(page.getByTestId('redo-btn')).toBeEnabled();
    await page.getByTestId('redo-btn').click();
    await expect.poll(async () => (await mapState(page)).labels).toContain('Added C');
    await expect.poll(async () => (await mapState(page)).labels).not.toContain('Added A');
    expect(errors).toEqual([]);
  });
}

test('toolbar and shortcuts restore real map features, save the result and discard redo branches', async ({
  page,
  blankProject,
}) => {
  await expect(page.getByTestId('undo-btn')).toBeDisabled();
  await expect(page.getByTestId('redo-btn')).toBeDisabled();
  await createPoint(page, 'History point');
  await expect(page.getByTestId('undo-btn')).toBeEnabled();
  await expect.poll(async () => (await mapState(page)).points.length).toBe(4);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await mapState(page)).points.length).toBe(3);
  await expect(
    page.locator('.layer-item-name').getByText('History point', { exact: true })
  ).toHaveCount(0);
  await expect(page.locator('.precision-lens')).toHaveCount(0);
  await page.getByTestId('redo-btn').click();
  await expect.poll(async () => (await mapState(page)).labels).toContain('History point');
  await page.getByTestId('undo-btn').click();
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(async () => (await mapState(page)).points.length).toBe(4);
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await mapState(page)).points.length).toBe(3);
  await page.keyboard.press('Meta+Shift+z');
  await expect.poll(async () => (await mapState(page)).points.length).toBe(4);
  await page.keyboard.press('Control+z');
  await createPoint(page, 'New branch');
  await expect(page.getByTestId('redo-btn')).toBeDisabled();
  await page.keyboard.press('Control+y');
  await expect.poll(async () => (await mapState(page)).labels).not.toContain('History point');
  await page.getByTestId('undo-btn').click();
  await page.keyboard.press('Control+y');
  await expect.poll(async () => (await mapState(page)).labels).toContain('New branch');
  await expect
    .poll(async () => (await stored(page)).data.points.map((point) => point.name))
    .toContain('New branch');
  await page.reload();
  await expect(page.getByTestId('undo-btn')).toBeEnabled();
  await expect.poll(async () => (await mapState(page)).labels).toContain('New branch');
  await expect(page.getByTestId('redo-btn')).toBeDisabled();
  await page.getByTestId('undo-btn').click();
  await expect.poll(async () => (await mapState(page)).points.length).toBe(3);
  await page.reload();
  await expect(page.getByTestId('redo-btn')).toBeEnabled();
  await page.getByTestId('redo-btn').click();
  await expect.poll(async () => (await mapState(page)).labels).toContain('New branch');
});

test('undo keeps text editing native and restores group visibility', async ({
  page,
  blankProject,
}) => {
  await createPoint(page, 'Keep me');
  await page.getByTestId('draw-point-btn').click();
  const dialog = page.getByRole('dialog');
  const name = dialog.getByLabel('Point Name', { exact: true });
  await name.click();
  // One native insertion is one undo transaction; character grouping varies by browser timing.
  await page.keyboard.insertText('Temporary');
  await name.press('Control+z');
  await expect(name).toHaveValue('');
  await expect.poll(async () => (await mapState(page)).points.length).toBe(4);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByTitle('Create group', { exact: true }).click();
  await page.getByLabel('Group name', { exact: true }).fill('Hypothesis');
  await page.getByRole('checkbox', { name: 'Paris', exact: true }).check();
  await page.getByRole('checkbox', { name: 'London', exact: true }).check();
  await page.getByRole('button', { name: 'Save group', exact: true }).click();
  const group = page.locator('.element-group').filter({ hasText: 'Hypothesis' });
  await expect(group.locator('.layer-item-name')).toHaveText(['Paris', 'London']);
  await group.getByTitle('Hide all items in group', { exact: true }).click();
  await expect.poll(async () => (await mapState(page)).points.length).toBe(2);
  await page.getByTestId('undo-btn').click();
  await expect.poll(async () => (await mapState(page)).points.length).toBe(4);
  await page.getByTestId('undo-btn').click();
  await expect(group).toHaveCount(0);
  await page.getByTestId('redo-btn').click();
  await expect(group.locator('.layer-item-name')).toHaveText(['Paris', 'London']);
  await page.getByTestId('redo-btn').click();
  await expect.poll(async () => (await mapState(page)).points.length).toBe(2);
});

test('one undo restores a deleted point, its polygon and linked note on the map', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('gpxCircle_language', 'en');
    localStorage.setItem('geochase_activeProjectId', 'cascade');
    localStorage.setItem(
      'geochase_projects',
      JSON.stringify([
        {
          id: 'cascade',
          name: 'Cascade',
          projection: 'mercator',
          createdAt: 1,
          updatedAt: 1,
          data: {
            points: [
              { id: 'a', name: 'Alpha', coordinates: { lat: 48, lon: 2 } },
              { id: 'b', name: 'Bravo', coordinates: { lat: 49, lon: 2 } },
              { id: 'c', name: 'Charlie', coordinates: { lat: 48, lon: 3 } },
            ],
            circles: [],
            lineSegments: [],
            polygons: [{ id: 'triangle', name: 'Triangle', pointIds: ['a', 'b', 'c'] }],
            notes: [
              {
                id: 'clue',
                title: 'Clue',
                content: 'Linked note',
                linkedElementType: 'point',
                linkedElementId: 'a',
              },
            ],
          },
        },
      ])
    );
  });
  await page.goto('/');
  const row = page.locator('[data-layer-id="a"]');
  await expect(row).toBeVisible();
  await row.locator('button').last().click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('.v-menu .v-list:visible').getByText('Delete', { exact: true }).click();
  await expect.poll(async () => (await mapState(page)).polygons).toEqual([]);
  await expect(page.locator('[data-layer-id="clue"]')).toHaveCount(0);
  await page.getByTestId('undo-btn').click();
  await expect.poll(async () => (await mapState(page)).polygons).toEqual(['triangle']);
  await expect
    .poll(async () => (await mapState(page)).labels)
    .toEqual(['Alpha', 'Bravo', 'Charlie']);
  await expect(page.locator('[data-layer-id="clue"]')).toBeVisible();
  await expect(page.getByTestId('undo-btn')).toBeDisabled();
  await page.getByTestId('redo-btn').click();
  await expect.poll(async () => (await mapState(page)).points).toEqual(['b', 'c']);
  await expect.poll(async () => (await mapState(page)).polygons).toEqual([]);
});

test('each project retains its own history and buttons remain accessible on mobile', async ({
  page,
  blankProject,
}) => {
  await createPoint(page, 'Old project');
  await page.getByTestId('save-menu-btn').click();
  await page.getByTestId('new-project-btn').click();
  await page.getByTestId('project-name-input').locator('input').fill('New project');
  await page.getByTestId('create-project-btn').click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByTestId('undo-btn')).toBeDisabled();
  await expect(page.getByTestId('redo-btn')).toBeDisabled();
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await mapState(page)).points).toEqual([]);
  await page.getByTestId('save-menu-btn').click();
  await page.getByTestId('load-project-btn').click();
  await page.getByRole('dialog').getByText('Test Project', { exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByTestId('undo-btn')).toBeEnabled();
  await page.getByTestId('undo-btn').click();
  await expect.poll(async () => (await mapState(page)).points.length).toBe(3);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('undo-btn')).toBeInViewport();
  await expect(page.getByTestId('redo-btn')).toBeInViewport();
  await page.screenshot({ path: 'test-results/history-mobile.png' });
});

test('importing shared element IDs starts visible and preserves the original project visibility', async ({
  page,
  blankProject,
}) => {
  await page.getByTitle('Hide all points', { exact: true }).click();
  await expect.poll(async () => (await mapState(page)).points).toEqual([]);
  await expect(page.getByTestId('undo-btn')).toBeEnabled();
  await page.getByTestId('save-menu-btn').click();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByTestId('import-json-btn').click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'copy.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...blankProject, name: 'Imported copy' })),
  });
  const expectedIds = blankProject.data.points.map((point) => point.id).toSorted();
  await expect.poll(async () => (await stored(page)).name).toBe('Imported copy');
  await expect.poll(async () => (await mapState(page)).points).toEqual(expectedIds);
  await expect(page.locator('.layer-item-hidden')).toHaveCount(0);
  await expect(page.getByTestId('undo-btn')).toBeDisabled();
  await expect(page.getByTestId('redo-btn')).toBeDisabled();
  const imported = await stored(page);

  await page.getByTestId('save-menu-btn').click();
  await page.getByTestId('load-project-btn').click();
  await page.getByTestId(`load-project-${blankProject.id}`).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByTestId('undo-btn')).toBeEnabled();
  await expect.poll(async () => (await mapState(page)).points).toEqual([]);
  await page.reload();
  await expect(page.getByTestId('undo-btn')).toBeEnabled();
  await expect.poll(async () => (await mapState(page)).points).toEqual([]);

  await page.getByTestId('save-menu-btn').click();
  await page.getByTestId('load-project-btn').click();
  await page.getByTestId(`load-project-${imported.id}`).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect.poll(async () => (await mapState(page)).points).toEqual(expectedIds);
  await expect(page.getByTestId('undo-btn')).toBeDisabled();
});

test('Escape cancels freehand drawing and closes the precision lens together', async ({
  page,
  blankProject,
}) => {
  await page.getByTestId('advanced-tools-btn').click();
  await page.getByText('Free Hand', { exact: true }).click();
  await page.getByRole('button', { name: 'Start Drawing', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  const cancel = page.getByRole('button', { name: 'Cancel Drawing', exact: true });
  await expect(cancel).toBeVisible();
  await page.locator('#map').click({ position: { x: 850, y: 400 } });
  await page.keyboard.press('z');
  await page.mouse.move(900, 450);
  await expect(page.locator('.precision-lens')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(cancel).toBeHidden();
  await expect(page.locator('.precision-lens')).toBeHidden();
});

test('exports contain only the present project while its redo history survives locally', async ({
  page,
  blankProject,
}) => {
  await createPoint(page, 'Only in history');
  await page.getByTestId('undo-btn').click();
  for (const format of ['json', 'gpx']) {
    await page.getByTestId('save-menu-btn').click();
    const downloadEvent = page.waitForEvent('download');
    await page.getByTestId(`export-${format}-btn`).click();
    const download = await downloadEvent;
    const content = await readFile((await download.path())!, 'utf8');
    expect(content).not.toContain('Only in history');
    expect(content).not.toContain('history');
    if (format === 'json') expect(JSON.parse(content).data.points).toHaveLength(3);
  }
  await page.reload();
  await expect(page.getByTestId('redo-btn')).toBeEnabled();
  await page.getByTestId('redo-btn').click();
  await expect.poll(async () => (await mapState(page)).labels).toContain('Only in history');
  await expect(page.getByTestId('undo-btn')).toBeEnabled();
  await expect(page.getByTestId('redo-btn')).toBeDisabled();
  await page.screenshot({ path: 'test-results/history-desktop.png' });
});
