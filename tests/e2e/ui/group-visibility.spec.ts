import type { MapContainer } from '../../../src/composables/useMap';
import type { ProjectLayerData } from '../../../src/types/project';
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';

const sections = [
  { type: 'point', title: 'points', source: 'pointsSource' },
  { type: 'circle', title: 'Circles', source: 'circlesSource' },
  { type: 'lineSegment', title: 'lines', source: 'linesSource' },
  { type: 'polygon', title: 'polygons', source: 'polygonsSource' },
  { type: 'route', title: 'routes', source: 'routesSource' },
] as const;

async function setup(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('gpxCircle_language', 'en');
    localStorage.setItem('geochase_activeProjectId', 'visibility');
    const data: ProjectLayerData = {
      elementGroups: [
        { id: 'group', name: 'Investigation' },
        { id: 'other', name: 'Independent group' },
        { id: 'notes', name: 'Notes only' },
      ],
      points: [],
      circles: [],
      lineSegments: [],
      polygons: [],
      routes: [],
      notes: [
        { id: 'note', title: 'Clue', content: '', groupId: 'group' },
        { id: 'note-only', title: 'Text', content: '', groupId: 'notes' },
      ],
    };
    for (const suffix of ['outside', 'group', 'other']) {
      const groupId = suffix === 'outside' ? undefined : suffix;
      const base = { groupId, name: suffix };
      for (let i = 0; i < 3; i++) {
        data.points!.push({
          ...base,
          id: `point-${suffix}-${i}`,
          name: `${suffix} ${i}`,
          coordinates: { lat: 48 + i * 0.1, lon: 2 + (i % 2) * 0.1 },
        });
      }
      data.circles!.push({
        ...base,
        id: `circle-${suffix}`,
        center: { lat: 48, lon: 2 },
        radius: 5,
      });
      data.lineSegments!.push({
        ...base,
        id: `lineSegment-${suffix}`,
        mode: 'coordinate',
        center: { lat: 48, lon: 2 },
        endpoint: { lat: 49, lon: 3 },
      });
      data.polygons!.push({
        ...base,
        id: `polygon-${suffix}`,
        pointIds: [0, 1, 2].map((i) => `point-${suffix}-${i}`),
      });
      data.routes!.push({
        ...base,
        id: `route-${suffix}`,
        start: { lat: 48, lon: 2 },
        end: { lat: 49, lon: 3 },
        coordinates: [
          [2, 48],
          [3, 49],
        ],
        distance: 1000,
        duration: 60,
        profile: 'pedestrian',
        optimization: 'shortest',
      });
    }
    localStorage.setItem(
      'geochase_projects',
      JSON.stringify([{ id: 'visibility', name: 'Visibility', createdAt: 1, updatedAt: 1, data }])
    );
  });
  await page.goto('/');
  await page.waitForSelector('#map', { state: 'visible' });
}

async function expectMapFeature(page: Page, source: string, id: string, visible: boolean) {
  await expect
    .poll(() =>
      page.evaluate(
        ({ source, id }) => {
          const element = document.querySelector('#map') as HTMLElement & {
            __vueParentComponent: { provides: Record<symbol, MapContainer> };
          };
          const provides = element.__vueParentComponent.provides;
          const key = Object.getOwnPropertySymbols(provides).find(
            (key) => key.description === 'mapContainer'
          )!;
          const container = provides[key]!;
          const vectorSource = container[source as 'pointsSource'].value;
          return !!vectorSource?.getFeatureById(id);
        },
        { source, id }
      )
    )
    .toBe(visible);
  await expect(page.locator(`[data-layer-id="${id}"]`)).toHaveClass(
    visible ? /^(?!.*layer-item-hidden).*$/ : /layer-item-hidden/
  );
}

for (const { type, title, source } of sections) {
  test(`${type}: section and mixed group visibility remain independent on the real map`, async ({
    page,
  }) => {
    await setup(page);
    const id = (suffix: string) => `${type}-${suffix}${type === 'point' ? '-0' : ''}`;
    const group = page.locator('[data-element-group-id="group"]');
    const hideTitle = type === 'circle' ? 'Hide All Circles' : `Hide all ${title}`;
    const showTitle = type === 'circle' ? 'Show All Circles' : `Show all ${title}`;
    await expectMapFeature(page, source, id('group'), true);
    await page.getByTitle(hideTitle, { exact: true }).click();
    await expectMapFeature(page, source, id('outside'), false);
    await expectMapFeature(page, source, id('group'), true);
    await group.getByTitle('Hide all items in group', { exact: true }).click();
    await expectMapFeature(page, source, id('group'), false);
    await expectMapFeature(page, source, id('other'), true);
    await expect(group.locator('[data-layer-id="note"]')).toHaveClass(/layer-item-hidden/);
    await page.getByTitle(showTitle, { exact: true }).click();
    await expectMapFeature(page, source, id('outside'), true);
    await expectMapFeature(page, source, id('group'), false);
    await expectMapFeature(page, source, id('other'), true);
    await expect(page.getByTitle(hideTitle, { exact: true })).toBeVisible();
    await group.getByTitle('Show all items in group', { exact: true }).click();
    await expectMapFeature(page, source, id('group'), true);
    await expect(group.locator('[data-layer-id="note"]')).not.toHaveClass(/layer-item-hidden/);
    await expect(
      page.locator('[data-element-group-id="notes"] .layers-section-actions button').first()
    ).toBeEnabled();
  });
}

test('individual toggles, search scopes and ungrouping keep visibility consistent', async ({
  page,
}) => {
  await setup(page);
  const group = page.locator('[data-element-group-id="group"]');
  const row = page.locator('[data-layer-id="point-group-0"]');
  await row.locator('.layer-item-actions button').click();
  await page.getByText('Hide', { exact: true }).click();
  await expectMapFeature(page, 'pointsSource', 'point-group-0', false);
  await expect(group.getByTitle('Show all items in group', { exact: true })).toBeVisible();
  await group.getByTitle('Show all items in group', { exact: true }).click();
  await expectMapFeature(page, 'pointsSource', 'point-group-0', true);

  const search = page.locator('.layers-search input');
  await search.fill('outside 0');
  await page.getByTitle('Hide all points', { exact: true }).click();
  await search.fill('');
  await expectMapFeature(page, 'pointsSource', 'point-outside-0', false);
  await expectMapFeature(page, 'pointsSource', 'point-outside-1', true);
  await expectMapFeature(page, 'pointsSource', 'point-other-0', true);
  await expectMapFeature(page, 'pointsSource', 'point-group-0', true);

  await search.fill('group 0');
  await group.getByTitle('Hide all items in group', { exact: true }).click();
  await search.fill('');
  await expectMapFeature(page, 'pointsSource', 'point-group-0', false);
  await expectMapFeature(page, 'pointsSource', 'point-group-1', true);
  await expectMapFeature(page, 'circlesSource', 'circle-group', true);
  await row.locator('.layer-item-actions button').click();
  await page.getByText('Remove from group', { exact: true }).click();
  await expect(row).not.toHaveAttribute('data-group-id');
  await expectMapFeature(page, 'pointsSource', 'point-group-0', false);
  await page.getByTitle('Show all points', { exact: true }).click();
  await expectMapFeature(page, 'pointsSource', 'point-group-0', true);
});

for (const { type, source } of sections) {
  test(`${type}: global category control includes groups and ignores the search filter`, async ({
    page,
  }) => {
    await setup(page);
    const control = page.locator(`[data-visibility-category="${type}"]`);
    const id = (suffix: string) => `${type}-${suffix}${type === 'point' ? '-0' : ''}`;
    await expect(control).toHaveAttribute('aria-pressed', 'true');
    await page.locator('.layers-search input').fill('outside');
    await control.click();
    await expect(control).toHaveAttribute('aria-pressed', 'false');
    await page.locator('.layers-search input').fill('');
    for (const suffix of ['outside', 'group', 'other']) {
      await expectMapFeature(page, source, id(suffix), false);
    }
    const other = type === 'point' ? sections[1]! : sections[0]!;
    await expectMapFeature(
      page,
      other.source,
      `${other.type}-group${other.type === 'point' ? '-0' : ''}`,
      true
    );
    await control.click();
    for (const suffix of ['outside', 'group', 'other']) {
      await expectMapFeature(page, source, id(suffix), true);
    }
  });
}

test('map background toggle leaves drawings and the viewport intact on a white background', async ({
  page,
}) => {
  await setup(page);
  const state = () =>
    page.evaluate(() => {
      const element = document.querySelector('#map') as HTMLElement & {
        __vueParentComponent: { provides: Record<symbol, MapContainer> };
      };
      const provides = element.__vueParentComponent.provides;
      const key = Object.getOwnPropertySymbols(provides).find(
        (key) => key.description === 'mapContainer'
      )!;
      const map = provides[key]!.map.value!;
      return {
        layers: map
          .getLayers()
          .getArray()
          .filter((layer) => ['base-map-layer', 'image-map-layer'].includes(layer.getClassName()))
          .map((layer) => layer.getVisible()),
        center: map.getView().getCenter(),
        zoom: map.getView().getZoom(),
        animating: map.getView().getAnimating(),
      };
    });
  await expect.poll(async () => (await state()).animating).toBe(false);
  const before = await state();
  const toggle = page.getByTestId('toggle-map-background');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(state).toEqual({ ...before, layers: [false, false] });
  await expect(page.locator('#map .ol-viewport')).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)'
  );
  for (const { type, source } of sections) {
    await expectMapFeature(page, source, `${type}-group${type === 'point' ? '-0' : ''}`, true);
  }
  await page.getByRole('combobox', { name: 'Map Provider', exact: true }).press('Enter');
  await page.getByRole('option', { name: 'OpenStreetMap', exact: true }).click();
  await expect.poll(async () => (await state()).layers).toEqual([false, false]);
  await page.screenshot({ path: '/tmp/geochase-white-background.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  const open = page.getByRole('button', { name: 'Open notebook', exact: true });
  if (await open.isVisible()) await open.click();
  await expect
    .poll(async () => (await page.getByTestId('layers-sidebar').boundingBox())!.x)
    .toBe(0);
  await expect(toggle).toBeInViewport();
  await page.screenshot({ path: '/tmp/geochase-visibility-mobile.png' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await state()).layers).toEqual(before.layers);
});

test('Alt shortcuts toggle every global category and the map with the sidebar closed', async ({
  page,
}) => {
  await setup(page);
  const keys = { point: 'a', circle: 'c', lineSegment: 's', polygon: 'v', route: 'r' };
  for (const { type } of sections) {
    await expect(page.locator(`[data-visibility-category="${type}"]`)).toHaveAttribute(
      'aria-keyshortcuts',
      `Alt+${keys[type].toUpperCase()}`
    );
    await expect(page.locator(`[data-visibility-category="${type}"]`)).toHaveAttribute(
      'title',
      new RegExp(String.raw`Alt\+${keys[type].toUpperCase()}`)
    );
  }
  await page.getByRole('button', { name: 'Hide notebook', exact: true }).click();
  for (const { type, source } of sections) {
    await page.keyboard.press(`Alt+${keys[type]}`);
    for (const suffix of ['outside', 'group', 'other']) {
      await expectMapFeature(
        page,
        source,
        `${type}-${suffix}${type === 'point' ? '-0' : ''}`,
        false
      );
    }
    await page.keyboard.press(`Alt+${keys[type]}`);
    await expectMapFeature(page, source, `${type}-group${type === 'point' ? '-0' : ''}`, true);
  }
  await page.keyboard.press('Alt+x');
  await expect(page.locator('#map')).toHaveClass(/map-background-hidden/);
  await expect(page.locator('#map .ol-viewport')).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)'
  );
  await page.keyboard.press('Alt+x');
  await expect(page.locator('#map')).not.toHaveClass(/map-background-hidden/);
});

test('visibility shortcuts ignore typing, dialogs, other modifiers and held keys', async ({
  page,
}) => {
  await setup(page);
  const search = page.locator('.layers-search input');
  await search.focus();
  await page.keyboard.press('Alt+a');
  await page.keyboard.press('Alt+x');
  await expectMapFeature(page, 'pointsSource', 'point-group-0', true);
  await expect(page.locator('#map')).not.toHaveClass(/map-background-hidden/);
  await search.blur();
  await page.keyboard.press('a');
  await page.keyboard.press('Control+Alt+a');
  await page.keyboard.press('Alt+Shift+a');
  await expectMapFeature(page, 'pointsSource', 'point-group-0', true);

  await page.keyboard.down('Alt');
  await page.keyboard.down('a');
  await expectMapFeature(page, 'pointsSource', 'point-group-0', false);
  await page.keyboard.down('a'); // Repeat must not toggle back on.
  await expectMapFeature(page, 'pointsSource', 'point-group-0', false);
  await page.keyboard.up('a');
  await page.keyboard.up('Alt');
  await page.keyboard.press('Alt+a');
  await expectMapFeature(page, 'pointsSource', 'point-group-0', true);

  await page.getByTitle('Create group', { exact: true }).click();
  await page.getByLabel('Group name', { exact: true }).fill('Test');
  await page.getByRole('button', { name: 'Save group', exact: true }).focus();
  await page.keyboard.press('Alt+a');
  await page.keyboard.press('Alt+x');
  await expectMapFeature(page, 'pointsSource', 'point-group-0', true);
  await expect(page.locator('#map')).not.toHaveClass(/map-background-hidden/);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByTestId('draw-point-btn').click();
  await page.keyboard.press('Alt+a');
  await expectMapFeature(page, 'pointsSource', 'point-group-0', true);
});
