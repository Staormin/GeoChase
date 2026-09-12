import { expect, test } from '../fixtures';

test('names a right-clicked point after the city and preserves its name after reload', async ({
  page,
  blankProject,
}) => {
  await page.route('**/geocodage/reverse?*', (route) =>
    route.fulfill({
      json: {
        features: [
          { properties: { name: 'Test landmark', postcode: '75007', city: 'Versailles' } },
        ],
      },
    })
  );
  await page.locator('#map').click({ button: 'right', position: { x: 900, y: 450 } });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const coordinates = (
    await dialog.getByRole('textbox', { name: 'Coordinates', exact: true }).inputValue()
  )
    .split(',')
    .map(Number);
  const request = page.waitForRequest('**/geocodage/reverse?*');
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  const query = new URL((await request).url()).searchParams;
  expect(Number(query.get('lat'))).toBe(coordinates[0]);
  expect(Number(query.get('lon'))).toBe(coordinates[1]);
  await expect(dialog).not.toBeVisible();
  await expect(
    page.locator('.layer-item-name').getByText('Versailles', { exact: true })
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const projects = JSON.parse(localStorage.getItem('geochase_projects') || '[]');
        return projects[0]?.data.points.at(-1)?.name;
      })
    )
    .toBe('Versailles');
  await page.reload();
  await expect(
    page.locator('.layer-item-name').getByText('Versailles', { exact: true })
  ).toBeVisible();
});

test('keeps a custom point name without reverse geocoding', async ({ page, blankProject }) => {
  const requests: string[] = [];
  await page.route('**/geocodage/reverse?*', (route) => {
    requests.push(route.request().url());
    return route.fulfill({ json: { features: [] } });
  });
  await page.getByTestId('draw-point-btn').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Point Name', exact: true }).fill('My landmark');
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('.layer-item-name').filter({ hasText: 'My landmark' })).toBeVisible();
  expect(requests).toEqual([]);
});

for (const response of [
  { status: 200, json: { features: [] } },
  { status: 503, json: {} },
]) {
  test(`creates a numbered point when geocoding returns no city (${response.status})`, async ({
    page,
    blankProject,
  }) => {
    await page.route('**/geocodage/reverse?*', (route) => route.fulfill(response));
    await page.getByTestId('draw-point-btn').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator('.layer-item-name').filter({ hasText: 'Point 4' })).toBeVisible();
  });
}
