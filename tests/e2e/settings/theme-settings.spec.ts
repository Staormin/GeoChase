import { expect, test } from '../fixtures';

for (const viewport of [
  { width: 1366, height: 900 },
  { width: 390, height: 844 },
]) {
  test.describe(`${viewport.width}px`, () => {
    test.use({ viewport });
    test('selects complete themes including light and dark and remembers the choice', async ({
      page,
      blankProject,
    }) => {
      const palettes = [
        'classic',
        'classicDark',
        'ocean',
        'forest',
        'iris',
        'lagoon',
        'terracotta',
        'rose',
        'amber',
        'mint',
        'indigo',
        'plum',
        'goldVelvet',
        'clockworkOrange',
        'cyberpunk',
        'vaporwaveNeon',
        'christmasTree',
        'strawberrymint',
        'halloween',
      ];
      await page.getByRole('button', { name: 'More', exact: true }).click();
      await expect(page.getByTestId('theme-toggle')).toHaveCount(0);
      await page.getByTestId('theme-picker-btn').click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('.palette-option')).toHaveCount(palettes.length);
      const backgrounds = new Set<string>();
      for (const palette of palettes) {
        await page.getByTestId(`palette-${palette}`).click();
        await expect(page.locator('html')).toHaveAttribute('data-palette', palette);
        await expect(page.getByTestId(`palette-${palette}`)).toHaveAttribute(
          'aria-pressed',
          'true'
        );
        backgrounds.add(
          await page
            .locator('.workspace-toolbar')
            .evaluate((el) => getComputedStyle(el).backgroundColor)
        );
      }
      expect(backgrounds.size).toBe(palettes.length);
      await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-palette', 'halloween');
      await page.getByRole('button', { name: 'More', exact: true }).click();
      await page.getByTestId('theme-picker-btn').click();
      await page.getByTestId('palette-classic').click();
      await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-palette', 'classic');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    });
  });
}

test('Christmas animation respects reduced motion', async ({ page, blankProject }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByTestId('theme-picker-btn').click();
  await page.getByTestId('palette-christmasTree').click();
  const animationName = () =>
    page
      .getByTestId('draw-point-btn')
      .evaluate((element) => getComputedStyle(element).animationName);
  await expect.poll(animationName).toBe('multiColorGarland');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(animationName).toBe('none');
});
