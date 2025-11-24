import { test as base } from '@playwright/test';

/**
 * Project data structure for localStorage
 */
interface ProjectData {
  id: string;
  name: string;
  circles: any[];
  lineSegments: any[];
  points: any[];
  polygons: any[];
  notes: any[];
  createdAt: string;
  modifiedAt: string;
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
  const now = new Date().toISOString();
  return {
    id: overrides.id || 'test-project-' + Date.now(),
    name: overrides.name || 'Test Project',
    circles: overrides.circles || [],
    lineSegments: overrides.lineSegments || [],
    points: overrides.points || [],
    polygons: overrides.polygons || [],
    notes: overrides.notes || [],
    createdAt: overrides.createdAt || now,
    modifiedAt: overrides.modifiedAt || now,
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
  cleanState: async ({ page }, use) => {
    // Navigate to the app
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('#map', { state: 'visible', timeout: 60_000 });
    await page.waitForTimeout(300);

    // Clear localStorage and set language to prevent language modal
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('gpxCircle_language', 'en');
    });

    // Reload to apply cleared storage
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#map', { state: 'visible', timeout: 60_000 });
    await page.waitForTimeout(300);

    await use();
  },

  /**
   * Blank project fixture - sets up a fresh empty project
   * Use this when you want to test features that require a project to exist
   */
  blankProject: async ({ page }, use) => {
    // Navigate to the app
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('#map', { state: 'visible', timeout: 60_000 });
    await page.waitForTimeout(300);

    // Create and set blank project in localStorage, and set language to prevent modal
    const project = createBlankProject();
    await page.evaluate((proj) => {
      localStorage.setItem('geochase_projects', JSON.stringify([proj]));
      localStorage.setItem('gpxCircle_language', 'en');
    }, project);

    // Reload to apply the project
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#map', { state: 'visible', timeout: 60_000 });
    await page.waitForTimeout(300);

    await use(project);
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
