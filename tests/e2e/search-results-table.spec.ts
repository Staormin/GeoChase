import { expect, test } from './fixtures';

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
  <node id="3" lat="48.8530" lon="2.3499">
    <tag k="name" v="Notre-Dame"/>
    <tag k="historic" v="cathedral"/>
  </node>
  <node id="4" lat="48.8738" lon="2.2950">
    <tag k="name" v="Arc de Triomphe"/>
    <tag k="historic" v="monument"/>
  </node>
  <node id="5" lat="48.8867" lon="2.3431">
    <tag k="name" v="Sacré-Cœur"/>
    <tag k="amenity" v="place_of_worship"/>
  </node>
</osm>`;

// Mock elevation API response
const mockElevationResponse = {
  results: [
    { latitude: 48.8584, longitude: 2.2945, elevation: 33 },
    { latitude: 48.8606, longitude: 2.3376, elevation: 35 },
    { latitude: 48.853, longitude: 2.3499, elevation: 42 },
    { latitude: 48.8738, longitude: 2.295, elevation: 55 },
    { latitude: 48.8867, longitude: 2.3431, elevation: 130 },
  ],
};

// Helper to setup API mocks
async function setupApiMocks(page: any) {
  // Mock Overpass API
  await page.route('**/overpass-api.de/api/interpreter', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/xml',
      body: mockOverpassResponse,
    });
  });

  // Mock Elevation API
  await page.route('**/api.open-elevation.com/api/v1/lookup', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockElevationResponse),
    });
  });
}

// Helper to open search panel from a point
async function openSearchPanel(page: any) {
  // Create a point in Paris
  await page.locator('[data-testid="draw-point-btn"]').click();
  await page.waitForTimeout(300);
  await page.locator('input[placeholder*="48.8566"]').fill('48.8566, 2.3522');
  await page
    .locator('button')
    .filter({ hasText: /Add|Ajouter/i })
    .click();
  await page.waitForTimeout(500);

  // Open context menu and click "Location near"
  const contextMenuBtn = page.locator('.mdi-dots-vertical').first();
  await contextMenuBtn.click();
  await page.waitForTimeout(300);

  const locationNearOption = page
    .locator('.v-list-item')
    .filter({ hasText: /Location near|Rechercher/i });
  await locationNearOption.click();

  // Wait for search results to load (mocked API is fast)
  await page.waitForTimeout(1000);
}

test.describe('Search Results Table', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test.describe('Table Structure', () => {
    test('should display search panel after opening', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      // Results header should be visible
      await expect(page.locator('text=/Results|Résultats/i').first()).toBeVisible();
    });

    test('should display table with results', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      // Table should be visible with mocked results
      await expect(page.locator('table')).toBeVisible();
    });

    test('should display table headers', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      // Wait for table and check headers
      const table = page.locator('table');
      await expect(table).toBeVisible();
      await expect(page.locator('th').first()).toBeVisible();
    });
  });

  test.describe('Result Rows', () => {
    test('should display result rows with names', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      // Should have result rows in tbody
      const rows = page.locator('tbody tr');
      await expect(rows.first()).toBeVisible();

      // First row should contain location name
      await expect(rows.first().locator('td').first()).toBeVisible();
    });

    test('should display distance for each result', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      const rows = page.locator('tbody tr');
      await expect(rows.first()).toBeVisible();

      // Distance column should contain "km"
      await expect(rows.first().locator('td').nth(1)).toContainText(/km/i);
    });

    test('should display elevation when available', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      const rows = page.locator('tbody tr');
      await expect(rows.first()).toBeVisible();

      // Elevation column should contain "m" (meters)
      await expect(rows.first().locator('td').nth(2)).toContainText(/m/i);
    });

    test('should have hover effect on rows', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      const rows = page.locator('tbody tr');
      await expect(rows.first()).toBeVisible();

      // Row should have cursor pointer for clickability
      await expect(rows.first()).toHaveClass(/cursor-pointer/);
    });
  });

  test.describe('Type Filter Buttons', () => {
    test('should show add to include button on results', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      const rows = page.locator('tbody tr');
      await expect(rows.first()).toBeVisible();

      // Plus button should be visible
      await expect(rows.first().locator('.mdi-plus').first()).toBeVisible();
    });

    test('should show add to exclude button on results', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      const rows = page.locator('tbody tr');
      await expect(rows.first()).toBeVisible();

      // Minus button should be visible
      await expect(rows.first().locator('.mdi-minus').first()).toBeVisible();
    });
  });
});

test.describe('Search Filters', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test.describe('Text Filter', () => {
    test('should display text filter input', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      // Filter by Name input should be visible
      await expect(page.getByRole('textbox', { name: /Filter by Name|Filtrer/i })).toBeVisible();
    });

    test('should allow typing in text filter', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      const filterInput = page.getByRole('textbox', { name: /Filter by Name|Filtrer/i });
      await filterInput.fill('Tour');
      await page.waitForTimeout(300);

      await expect(filterInput).toHaveValue('Tour');
    });

    test('should filter results by name', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      // Get initial row count
      const rows = page.locator('tbody tr');
      const initialCount = await rows.count();
      expect(initialCount).toBeGreaterThanOrEqual(1);

      // Filter by non-matching name to show no results
      const filterInput = page.getByRole('textbox', { name: /Filter by Name|Filtrer/i });
      await filterInput.fill('xyz_nonexistent');
      await page.waitForTimeout(300);

      // Should have no results or fewer results
      const filteredCount = await rows.count();
      expect(filteredCount).toBeLessThan(initialCount);
    });
  });

  test.describe('Include Types Filter', () => {
    test('should display include types combobox', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      // Include Types text should be visible
      await expect(page.locator('text=/Include Types|Types inclus/i').first()).toBeVisible();
    });
  });

  test.describe('Exclude Types Filter', () => {
    test('should display exclude types combobox', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      // Exclude Types text should be visible
      await expect(page.locator('text=/Exclude Types|Types exclus/i').first()).toBeVisible();
    });
  });

  test.describe('Distance Slider', () => {
    test('should display distance slider label', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      // Search Distance label should be visible
      await expect(
        page.locator('text=/Search Distance|Distance de recherche/i').first()
      ).toBeVisible();
    });

    test('should display current distance value', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      // Should show distance value with km unit
      await expect(page.locator(String.raw`text=/\d+\.?\d*\s*km/i`).first()).toBeVisible();
    });

    test('should have slider component', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      // Slider should be visible
      await expect(page.getByRole('slider').first()).toBeVisible();
    });
  });

  test.describe('Altitude Range Slider', () => {
    test('should display altitude range label', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      // Altitude Range label should be visible
      await expect(page.locator("text=/Altitude Range|Plage d'altitude/i").first()).toBeVisible();
    });

    test('should display altitude range values', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      // Should show altitude range with "m" unit
      await expect(page.locator(String.raw`text=/\d+\s*m\s*-\s*\d+\s*m/i`).first()).toBeVisible();
    });
  });
});

test.describe('Search Panel Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test.describe('Panel Header', () => {
    test('should display back button', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      // Back button with left arrow icon should be visible
      await expect(page.locator('.mdi-arrow-left').first()).toBeVisible();
    });

    test('should display results section title', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      // Results header should be visible
      await expect(page.locator('text=/Results|Résultats/i').first()).toBeVisible();
    });
  });

  test.describe('Result Click', () => {
    test('should allow clicking on result row', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      const rows = page.locator('tbody tr');
      await expect(rows.first()).toBeVisible();

      // Click on first result
      await rows.first().click();
      await page.waitForTimeout(500);

      // Map should still be visible (no errors)
      await expect(page.locator('#map')).toBeVisible();
    });
  });

  test.describe('Close Panel', () => {
    test('should have close sidebar button', async ({ page, blankProject }) => {
      await openSearchPanel(page);

      // Close sidebar button should be visible
      await expect(page.getByRole('button', { name: /Close sidebar|Fermer/i })).toBeVisible();
    });
  });
});

test.describe('Column Sorting', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('should have sortable name column', async ({ page, blankProject }) => {
    await openSearchPanel(page);

    // Click name column header to sort
    const nameHeader = page.locator('th').first();
    await nameHeader.click();
    await page.waitForTimeout(300);

    // Should show sort indicator
    await expect(
      page.locator('.mdi-sort-ascending, .mdi-sort-descending, .mdi-arrow-up, .mdi-arrow-down')
    ).toBeVisible();
  });

  test('should toggle sort direction on second click', async ({ page, blankProject }) => {
    await openSearchPanel(page);

    // Click name column header twice
    const nameHeader = page.locator('th').first();
    await nameHeader.click();
    await page.waitForTimeout(300);
    await nameHeader.click();
    await page.waitForTimeout(300);

    // Sort indicator should still be visible
    await expect(
      page.locator('.mdi-sort-ascending, .mdi-sort-descending, .mdi-arrow-up, .mdi-arrow-down')
    ).toBeVisible();
  });
});
