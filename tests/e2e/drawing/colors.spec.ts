import { expect, test } from '@playwright/test';

test('changes a drawing color, cancels safely and remembers choices after reload', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('colors-seeded')) return;
    sessionStorage.setItem('colors-seeded', '1');
    localStorage.clear();
    localStorage.setItem('gpxCircle_language', 'en');
    localStorage.setItem('geochase_activeProjectId', 'colors');
    localStorage.setItem(
      'geochase_projects',
      JSON.stringify([
        {
          id: 'colors',
          name: 'Colors',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          data: {
            circles: [],
            points: [],
            polygons: [],
            notes: [],
            lineSegments: [
              {
                id: 'line',
                name: 'Color test line',
                mode: 'coordinate',
                center: { lat: 48, lon: 2 },
                endpoint: { lat: 49, lon: 3 },
                color: '#000000',
              },
            ],
          },
        },
      ])
    );
  });
  await page.goto('/');
  const openPicker = async () => {
    await page
      .locator('.layer-item')
      .filter({ hasText: 'Color test line' })
      .getByRole('button')
      .click();
    await page.getByText('Drawing color', { exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  };
  const storedColor = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem('geochase_projects')!)[0].data.lineSegments[0].color
    );
  await openPicker();
  await page.getByRole('button', { name: '#6366F1', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(storedColor).toBe('#6366F1');
  await page.reload();
  await openPicker();
  await expect(
    page.getByTestId('recent-drawing-colors').getByRole('button', { name: '#6366F1' })
  ).toBeVisible();
  await page.getByLabel('Custom color', { exact: true }).fill('#123ABC');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await storedColor()).toBe('#6366F1');
  await openPicker();
  await page.getByLabel('Custom color', { exact: true }).fill('#123ABC');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(storedColor).toBe('#123ABC');
});
