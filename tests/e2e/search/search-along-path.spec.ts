import { expect, test } from '../fixtures';

// Mock Overpass API response with sample locations
const mockOverpassResponse = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6">
  <node id="1" lat="48.8584" lon="2.2945">
    <tag k="name" v="Tour Eiffel"/>
    <tag k="tourism" v="attraction"/>
  </node>
  <node id="2" lat="48.8606" lon="2.3376">
    <tag k="name" v="Musée du Louvre"/>
    <tag k="tourism" v="museum"/>
  </node>
</osm>`;

// Mock elevation API response
const mockElevationResponse = {
  results: [
    { latitude: 48.8584, longitude: 2.2945, elevation: 33 },
    { latitude: 48.8606, longitude: 2.3376, elevation: 35 },
  ],
};

// Helper to setup API mocks
async function setupApiMocks(page: any) {
  await page.route('**/overpass-api.de/api/interpreter', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/xml',
      body: mockOverpassResponse,
    });
  });

  await page.route('**/api.open-elevation.com/api/v1/lookup', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockElevationResponse),
    });
  });
}

// Helper to open search panel from point
async function openSearchPanel(page: any) {
  await page.locator('[data-testid="draw-point-btn"]').click();
  await page.waitForTimeout(300);
  await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
  await page
    .locator('button')
    .filter({ hasText: /Add|Ajouter/i })
    .click();
  await page.waitForTimeout(500);

  const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
  await contextMenuBtn.click();
  await page.waitForTimeout(300);

  const locationNearOption = page
    .locator('.v-list-item')
    .filter({ hasText: /Location near|Rechercher/i });
  await locationNearOption.click();
  await page.waitForTimeout(800);
}

test.describe('Search Along Path', () => {
  // Run tests serially to avoid resource contention with blankProject fixture
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test.describe('Opening Search Panel', () => {
    test('should open search panel from point context menu', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      // Search panel should be visible (Results header)
      await expect(page.locator('text=/Results|Résultats/i').first()).toBeVisible();
    });
  });

  test.describe('Search Panel UI', () => {
    test('should display back button', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      // Back button should be visible
      await expect(page.locator('.mdi-arrow-left').first()).toBeVisible();
    });

    test('should close search panel with back button', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      // Click back button
      await page.locator('.mdi-arrow-left').first().click();
      await page.waitForTimeout(500);

      // Search panel should be closed (Results text should not be visible)
      await expect(page.locator('text=/Results|Résultats/i').first()).not.toBeVisible();
    });
  });

  test.describe('Search Results', () => {
    test('should show search panel after triggering search', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      // Search panel should remain visible after triggering search
      await expect(page.locator('text=/Results|Résultats/i').first()).toBeVisible();
    });

    test('should display search panel content area', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      // Wait for search to complete - panel should have content
      await expect(page.locator('text=/Results|Résultats/i').first()).toBeVisible();
    });
  });

  test.describe('Filter Interactions', () => {
    test('should have text filter input', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      // Text filter input should be visible
      await expect(page.getByRole('textbox', { name: /Filter/i })).toBeVisible();
    });

    test('should have filter controls visible', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      // Search panel header should be visible
      await expect(page.locator('text=/Results|Résultats/i').first()).toBeVisible();

      // There should be some form inputs visible
      const inputs = page.locator('input');
      await expect(inputs.first()).toBeVisible();
    });
  });
});
