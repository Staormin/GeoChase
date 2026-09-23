import { expect, test } from '../fixtures';

const points = ['Alpha', 'Bravo', 'Charlie'].map((name, index) => ({
  id: name,
  name,
  coordinates: { lat: 48 + index, lon: 2 + index },
  createdAt: 300 - index,
}));

test.beforeEach(async ({ page }) => {
  await page.addInitScript((points) => {
    if (sessionStorage.getItem('reorder-init')) return;
    sessionStorage.setItem('reorder-init', '1');
    localStorage.setItem('gpxCircle_language', 'en');
    localStorage.setItem('geochase_activeProjectId', 'reorder');
    localStorage.setItem(
      'geochase_projects',
      JSON.stringify([
        {
          id: 'reorder',
          name: 'Reordering',
          createdAt: 1,
          updatedAt: 1,
          viewData: { topPanelOpen: true, sidePanelOpen: true },
          data: {
            points,
            circles: ['Circle A', 'Circle B'].map((name, i) => ({
              id: name,
              name,
              center: { lat: 48, lon: 2 },
              radius: 1,
              createdAt: 300 - i,
            })),
            lineSegments: ['Line A', 'Line B'].map((name, i) => ({
              id: name,
              name,
              center: { lat: 45, lon: 2 },
              endpoint: { lat: 46, lon: 3 },
              mode: 'coordinate',
              createdAt: 300 - i,
            })),
            polygons: ['Polygon A', 'Polygon B'].map((name, i) => ({
              id: name,
              name,
              pointIds: points.map((p) => p.id),
              createdAt: 300 - i,
            })),
            notes: ['Note A', 'Note B'].map((title, i) => ({
              id: title,
              title,
              content: '',
              createdAt: 300 - i,
            })),
          },
        },
      ])
    );
  }, points);
  await page.goto('/');
  await expect(page.locator('#map')).toBeVisible();
});

test('reorders points at edges, persists order, and creates a line only at the center', async ({
  page,
}) => {
  const row = (name: string) =>
    page
      .locator('.layer-item')
      .filter({ has: page.locator('.layer-item-name', { hasText: new RegExp(`^${name}$`) }) });
  const names = page
    .locator('.layer-items')
    .filter({ has: row('Alpha') })
    .locator('.layer-item-name');
  await row('Charlie').dragTo(row('Bravo'), { targetPosition: { x: 30, y: 3 } });
  await expect(names).toHaveText(['Alpha', 'Charlie', 'Bravo']);
  await expect(page.locator('.layer-item-name').filter({ hasText: '→' })).toHaveCount(0);
  const bravoHeight = (await row('Bravo').boundingBox())!.height;
  await row('Alpha').dragTo(row('Bravo'), { targetPosition: { x: 30, y: bravoHeight - 3 } });
  await expect(names).toHaveText(['Charlie', 'Bravo', 'Alpha']);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const project = JSON.parse(localStorage.getItem('geochase_projects') || '[]')[0];
        return project?.data.points.find((p: { id: string }) => p.id === 'Alpha')?.listOrder;
      })
    )
    .toBe(2);
  await page.reload();
  await expect(names).toHaveText(['Charlie', 'Bravo', 'Alpha']);
  await row('Alpha').dragTo(row('Bravo'));
  await expect(page.locator('.layer-item-name', { hasText: 'Alpha → Bravo' })).toHaveCount(1);
  await expect(names).toHaveText(['Charlie', 'Bravo', 'Alpha']);
});

for (const category of ['Circle', 'Line', 'Polygon', 'Note']) {
  test(`reorders ${category} elements`, async ({ page }) => {
    const row = (suffix: string) =>
      page
        .locator('.layer-item')
        .filter({ has: page.getByText(`${category} ${suffix}`, { exact: true }) });
    await row('B').dragTo(row('A'), { targetPosition: { x: 30, y: 3 } });
    await expect(row('A').locator('..').locator('.layer-item-name')).toHaveText([
      `${category} B`,
      `${category} A`,
    ]);
  });
}

test('dropping outside after hovering a point does not create a line', async ({ page }) => {
  const source = page
    .locator('.layer-item')
    .filter({ has: page.getByText('Alpha', { exact: true }) });
  const target = page
    .locator('.layer-item')
    .filter({ has: page.getByText('Bravo', { exact: true }) });
  await source.scrollIntoViewIfNeeded();
  const box = (await source.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 45, box.y + 30, { steps: 5 });
  await target.hover();
  await target.hover();
  await expect(target).toHaveClass(/drag-over/);
  await page.locator('#map').hover();
  await page.mouse.up();
  await expect(page.locator('.layer-item-name').filter({ hasText: '→' })).toHaveCount(0);
});

test('creates a line when dropped on the first line of a wrapped point name', async ({ page }) => {
  const longName = 'Bravo ' + 'long point name '.repeat(14);
  await page.evaluate((name) => {
    const projects = JSON.parse(localStorage.getItem('geochase_projects')!);
    projects[0].data.points[1].name = name;
    localStorage.setItem('geochase_projects', JSON.stringify(projects));
  }, longName);
  await page.reload();
  const source = page
    .locator('.layer-item')
    .filter({ has: page.getByText('Alpha', { exact: true }) });
  const target = page
    .locator('.layer-item')
    .filter({ has: page.getByText(longName, { exact: true }) });
  await source.dragTo(target, { targetPosition: { x: 30, y: 20 } });
  await expect(page.locator('.layer-item-name').filter({ hasText: 'Alpha → Bravo' })).toHaveCount(
    1
  );
});

test('Escape cancels a point link', async ({ page }) => {
  const source = page
    .locator('.layer-item')
    .filter({ has: page.getByText('Alpha', { exact: true }) });
  const target = page
    .locator('.layer-item')
    .filter({ has: page.getByText('Bravo', { exact: true }) });
  await source.scrollIntoViewIfNeeded();
  const box = (await source.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 30);
  await page.mouse.down();
  await target.hover();
  await expect(target).toHaveClass(/drag-over/);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(target).not.toHaveClass(/drag-over/);
  await expect(page.locator('.layer-item-name').filter({ hasText: '→' })).toHaveCount(0);
});

test('the grabbed element follows the cursor and disappears on release', async ({ page }) => {
  const source = page.locator('[data-layer-id="Alpha"]');
  await source.scrollIntoViewIfNeeded();
  const box = (await source.boundingBox())!;
  const preview = page.getByTestId('layer-drag-preview');
  await page.mouse.move(box.x + 40, box.y + 25);
  await page.mouse.down();
  await page.mouse.move(box.x + 90, box.y + 65, { steps: 5 });
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('Alpha');
  await expect(source).toHaveClass(/layer-item-dragging/);
  await expect(source).toHaveCSS('cursor', 'grabbing');
  await expect
    .poll(async () => {
      const bounds = (await preview.boundingBox())!;
      return { x: Math.round(bounds.x - box.x), y: Math.round(bounds.y - box.y) };
    })
    .toEqual({ x: 50, y: 40 });
  // The preview remains attached to the same grab point outside the sidebar.
  await page.mouse.move(1000, 350, { steps: 5 });
  await expect
    .poll(async () => {
      const bounds = (await preview.boundingBox())!;
      return { x: Math.round(bounds.x), y: Math.round(bounds.y) };
    })
    .toEqual({ x: 960, y: 325 });
  await page.screenshot({ path: '/tmp/geochase-drag-preview.png' });
  await page.mouse.up();
  await expect(preview).toHaveCount(0);
  await expect(source).not.toHaveClass(/layer-item-dragging/);
  await expect(source).toHaveCSS('cursor', 'grab');
});

test('drops in empty space below or above the category move to its ends', async ({ page }) => {
  // Leave enough empty space below the actual integrated point list.
  await page.evaluate(() => {
    const projects = JSON.parse(localStorage.getItem('geochase_projects')!);
    const data = projects[0].data;
    data.circles = [];
    data.lineSegments = [];
    data.polygons = [];
    data.notes = [];
    localStorage.setItem('geochase_projects', JSON.stringify(projects));
  });
  await page.reload();
  const names = page.locator('.layer-items .layer-item-name');
  const source = page.locator('[data-layer-id="Alpha"]');
  const last = page.locator('[data-layer-id="Charlie"]');
  const sourceBox = (await source.boundingBox())!;
  const lastBox = (await last.boundingBox())!;
  await page.mouse.move(sourceBox.x + 40, sourceBox.y + 25);
  await page.mouse.down();
  await page.mouse.move(lastBox.x + 40, lastBox.y + lastBox.height + 45, { steps: 8 });
  await expect(last).toHaveClass(/drop-after/);
  await page.mouse.up();
  await expect(names).toHaveText(['Bravo', 'Charlie', 'Alpha']);
  await expect(page.locator('[data-layer-type="lineSegment"]')).toHaveCount(0);

  const movedBox = (await source.boundingBox())!;
  const first = page.locator('[data-layer-id="Bravo"]');
  const firstBox = (await first.boundingBox())!;
  await page.mouse.move(movedBox.x + 40, movedBox.y + 25);
  await page.mouse.down();
  await page.mouse.move(firstBox.x + 40, firstBox.y - 15, { steps: 8 });
  await expect(first).toHaveClass(/drop-before/);
  await page.mouse.up();
  await expect(names).toHaveText(['Alpha', 'Bravo', 'Charlie']);
  await expect(page.locator('[data-layer-type="lineSegment"]')).toHaveCount(0);
});
