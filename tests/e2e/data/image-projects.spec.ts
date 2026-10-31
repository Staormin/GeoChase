import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';

async function prepareImageProject(page: Page) {
  await page.getByTestId('project-name-input').locator('input').fill('Image Project');
  await page
    .locator('label')
    .filter({ has: page.locator('input[value="image"]') })
    .click();
  await page.getByTestId('create-project-btn').click();
  await page
    .getByRole('dialog')
    .locator('input[type="file"]')
    .setInputFiles('public/images/legende-ign.png');
  await page.getByRole('button', { name: 'Known ratio', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Metres per pixel', exact: true }).fill('10');
}

async function failNextImageWrite(page: Page) {
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = new Proxy(original, {
      apply(target, store: IDBObjectStore, args: Parameters<typeof original>) {
        if (store.name === 'images') {
          IDBObjectStore.prototype.put = original;
          throw new DOMException('Simulated full image storage', 'QuotaExceededError');
        }
        return Reflect.apply(target, store, args);
      },
    });
  });
}

async function savedProjects(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('geochase_projects') || '[]'));
}

const saveError =
  'Could not save the image in this browser. Check available storage and try again.';

test('failed first image import leaves no project and allows creation after reload', async ({
  page,
  cleanState,
}) => {
  await prepareImageProject(page);
  await failNextImageWrite(page);
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page.getByText(saveError)).toBeVisible();
  expect(await savedProjects(page)).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('geochase_activeProjectId'))).toBeFalsy();

  await page.reload();
  await expect(page.getByTestId('project-name-input')).toBeVisible();
  expect(await savedProjects(page)).toEqual([]);
});

test('retrying an image import saves subsequent drawings to the active project', async ({
  page,
  blankProject,
}) => {
  await page.getByTestId('save-menu-btn').click();
  await page.getByTestId('new-project-btn').click();
  await prepareImageProject(page);
  await failNextImageWrite(page);
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page.getByText(saveError)).toBeVisible();
  expect(await savedProjects(page)).toHaveLength(1);
  expect(await page.evaluate(() => localStorage.getItem('geochase_activeProjectId'))).toBe(
    blankProject.id
  );

  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  const projects = await savedProjects(page);
  expect(projects).toHaveLength(2);
  const imageProjectId = await page.evaluate(() =>
    localStorage.getItem('geochase_activeProjectId')
  );
  expect(projects.find((project: { id: string }) => project.id === imageProjectId)).toMatchObject({
    name: 'Image Project',
    imageMapEnabled: true,
  });

  await page.getByTestId('draw-point-btn').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Point Name', exact: true }).fill('Retry Marker');
  await dialog.locator('input[placeholder="48.8566, 2.3522"]').fill('48.8566, 2.3522');
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('.layer-item-name').filter({ hasText: 'Retry Marker' })).toBeVisible();
  await expect
    .poll(async () => {
      const stored = await savedProjects(page);
      return stored.find((project: { id: string }) => project.id === imageProjectId)?.data.points;
    })
    .toEqual([expect.objectContaining({ name: 'Retry Marker' })]);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Recalibrate', exact: true })).toBeVisible();
  await expect(page.locator('.layer-item-name').filter({ hasText: 'Retry Marker' })).toBeVisible();
  expect(
    (await savedProjects(page)).find((project: { id: string }) => project.id === blankProject.id)
      .data.points
  ).toEqual(blankProject.data.points);
});

test('recovers an existing image project whose persisted type flag is missing', async ({
  page,
  cleanState,
}) => {
  await prepareImageProject(page);
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.evaluate(() => {
    const projects = JSON.parse(localStorage.getItem('geochase_projects') || '[]');
    delete projects[0].imageMapEnabled;
    localStorage.setItem('geochase_projects', JSON.stringify(projects));
  });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Recalibrate', exact: true })).toBeVisible();
  await expect.poll(async () => (await savedProjects(page))[0].imageMapEnabled).toBe(true);
});
