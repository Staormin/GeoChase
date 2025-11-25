import type { Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { test as base } from '@playwright/test';

/**
 * Project data structure for localStorage
 */
interface ProjectData {
  id: string;
  name: string;
  data: {
    circles: any[];
    lineSegments: any[];
    points: any[];
    polygons: any[];
    savedCoordinates: any[];
    notes: any[];
  };
  viewData?: {
    topPanelOpen: boolean;
    sidePanelOpen: boolean;
    mapView?: {
      lat: number;
      lon: number;
      zoom: number;
    };
  };
  createdAt: number;
  updatedAt: number;
}

/**
 * Extended test fixtures with project setup utilities
 */
interface ProjectFixtures {
  /**
   * Starts with completely clean localStorage (no projects)
   */
  cleanState: void;

  /**
   * Starts with a blank project already created and loaded
   */
  blankProject: ProjectData;

  /**
   * Utility function to create a project with custom data
   */
  createProject: (project: Partial<ProjectData>) => Promise<ProjectData>;
}

/**
 * Default blank project template
 */
function createBlankProject(overrides: Partial<ProjectData> = {}): ProjectData {
  const now = Date.now();
  return {
    id: overrides.id || 'test-project-' + now,
    name: overrides.name || 'Test Project',
    data: overrides.data || {
      circles: [],
      lineSegments: [],
      points: [],
      polygons: [],
      savedCoordinates: [],
      notes: [],
    },
    viewData: overrides.viewData,
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
  };
}

/**
 * Extended Playwright test with custom fixtures for project management
 */
export const test = base.extend<ProjectFixtures>({
  /**
   * Clean state fixture - completely clears localStorage
   * Use this when you want to test from a completely empty state
   */
  cleanState: async ({ page }, use, testInfo) => {
    // Use sessionStorage flag to only init on first load (not reloads)
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('__fixture_init__')) {
        sessionStorage.setItem('__fixture_init__', '1');
        localStorage.clear();
        localStorage.setItem('gpxCircle_language', 'en');
      }
    });

    await page.goto('/');
    await page.waitForSelector('#map', { state: 'visible' });

    await use();

    await collectCoverage(page, testInfo.title);
  },

  /**
   * Blank project fixture - sets up a fresh empty project with some saved coordinates
   * Use this when you want to test features that require a project to exist
   */
  blankProject: async ({ page }, use, testInfo) => {
    const project = createBlankProject({
      data: {
        circles: [],
        lineSegments: [],
        points: [],
        polygons: [],
        savedCoordinates: [
          { id: 'coord-1', name: 'Paris', lat: 48.8566, lon: 2.3522, timestamp: Date.now() },
          { id: 'coord-2', name: 'London', lat: 51.5074, lon: -0.1278, timestamp: Date.now() },
          { id: 'coord-3', name: 'Berlin', lat: 52.52, lon: 13.405, timestamp: Date.now() },
        ],
        notes: [],
      },
    });

    // Use sessionStorage flag to only init on first load (not reloads)
    await page.addInitScript(
      (data) => {
        if (!sessionStorage.getItem('__fixture_init__')) {
          sessionStorage.setItem('__fixture_init__', '1');
          localStorage.setItem('geochase_projects', JSON.stringify([data.project]));
          localStorage.setItem('geochase_activeProjectId', data.project.id);
          localStorage.setItem('gpxCircle_language', 'en');
        }
      },
      { project }
    );

    await page.goto('/');
    await page.waitForSelector('#map', { state: 'visible' });

    await use(project);

    await collectCoverage(page, testInfo.title);
  },

  /**
   * Create project utility - helper to create projects with custom data
   */
  createProject: async ({ page }, use) => {
    const createProjectFn = async (
      projectData: Partial<ProjectData> = {}
    ): Promise<ProjectData> => {
      const project = createBlankProject(projectData);

      // Get existing projects or create empty array
      const existingProjects = await page.evaluate(() => {
        const stored = localStorage.getItem('geochase_projects');
        return stored ? JSON.parse(stored) : [];
      });

      // Add new project
      existingProjects.push(project);

      // Save to localStorage
      await page.evaluate((projects) => {
        localStorage.setItem('geochase_projects', JSON.stringify(projects));
      }, existingProjects);

      return project;
    };

    await use(createProjectFn);
  },
});

/**
 * Re-export expect from Playwright
 */
export { expect } from '@playwright/test';

/**
 * Coverage collection helper
 */
async function collectCoverage(page: Page, testName: string): Promise<void> {
  if (process.env.VITE_COVERAGE !== 'true') return;

  const coverage = await page.evaluate(() => {
    return (window as any).__coverage__;
  });

  if (coverage) {
    const coverageDir = path.join(process.cwd(), '.nyc_output');
    if (!fs.existsSync(coverageDir)) {
      fs.mkdirSync(coverageDir, { recursive: true });
    }

    const timestamp = Date.now();
    const sanitizedName = testName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `coverage-${sanitizedName}-${timestamp}.json`;
    fs.writeFileSync(path.join(coverageDir, filename), JSON.stringify(coverage));
  }
}

/**
 * Test with automatic coverage collection (for tests not using fixtures)
 */
export const testWithCoverage = base.extend({
  page: async ({ page }, use, testInfo) => {
    await use(page);
    await collectCoverage(page, testInfo.title);
  },
});
