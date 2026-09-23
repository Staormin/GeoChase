import { expect, test } from '../fixtures';

test('resizes the sidebar, remembers its width and keeps it inside narrow screens', async ({
  page,
  blankProject,
}) => {
  const sidebar = page.getByTestId('layers-sidebar');
  const handle = page.getByTestId('sidebar-resize-handle');
  const width = async () => Math.round((await sidebar.boundingBox())!.width);
  await expect(handle).toBeVisible();
  const initialWidth = await width();
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 180, box.y + 100, { steps: 10 });
  await page.mouse.up();
  await expect.poll(width).toBe(initialWidth - 180);
  const resizedWidth = await width();
  await page.reload();
  await expect.poll(width).toBe(resizedWidth);
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(width).toBe(resizedWidth + 20);
  await page.keyboard.press('Home');
  await expect.poll(width).toBe(280);
  await page.keyboard.press('End');
  await expect.poll(width).toBe(900);
  await page.getByRole('button', { name: 'Close sidebar', exact: true }).click();
  await page.getByRole('button', { name: 'Open sidebar', exact: true }).click();
  await expect.poll(width).toBe(900);
  await page.setViewportSize({ width: 390, height: 844 });
  const open = page.getByRole('button', { name: 'Open sidebar', exact: true });
  await expect(open).toBeVisible();
  await open.click();
  await expect.poll(width).toBe(334);
  await expect(page.getByRole('button', { name: 'Close sidebar', exact: true })).toBeInViewport();
});
