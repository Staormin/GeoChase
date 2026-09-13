import type {
  LineSegmentElement,
  ProjectData,
  ProjectProjection,
} from '../../../src/types/project';
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';
import { geodesicDestination, geodesicInverse } from '../../../src/services/geodesy';

export async function seedIntersectionProject(
  page: Page,
  projection: ProjectProjection = 'mercator',
  targetMode: LineSegmentElement['mode'] = 'coordinate',
  targetShape: 'line' | 'circle' | 'polygon' = 'line'
) {
  const projects = await page.evaluate(
    ({ projection, targetMode, targetShape }) => {
      const projects: ProjectData[] = JSON.parse(localStorage.getItem('geochase_projects')!);
      const project = projects[0]!;
      project.projection = projection;
      project.viewData = {
        topPanelOpen: true,
        sidePanelOpen: false,
        mapView: { lat: 47, lon: 2, zoom: 6 },
      };
      project.data = {
        circles: [],
        polygons: [],
        notes: [],
        points: [
          { id: 'start', name: 'Start', coordinates: { lat: 45, lon: 2 } },
          { id: 'through', name: 'Imposed point', coordinates: { lat: 46, lon: 2 } },
          {
            id: 'end',
            name: 'Endpoint',
            coordinates: { lat: 47, lon: 2 },
            construction: { lineId: 'editable' },
          },
        ],
        lineSegments: [
          {
            id: 'editable',
            name: 'Editable intersection',
            mode: 'intersection',
            center: { lat: 45, lon: 2 },
            intersectionPoint: { lat: 46, lon: 2 },
            endpoint: { lat: 47, lon: 2 },
            color: '#e53935',
          },
          {
            id: 'target',
            name: 'Snap target',
            mode: targetMode,
            center: { lat: 48, lon: 1 },
            endpoint: { lat: 48, lon: 3 },
            longitude: 48,
            distance: 149,
            azimuth: 90,
            intersectionPoint: { lat: 48, lon: 2 },
          },
        ],
      };
      if (targetShape !== 'line') {
        project.data.lineSegments = project.data.lineSegments.slice(0, 1);
        if (targetShape === 'circle') {
          project.data.circles = [
            { id: 'target', name: 'Snap target', center: { lat: 47, lon: 2 }, radius: 110 },
          ];
        } else {
          project.data.points.push(
            { id: 'vertex-a', name: 'A', coordinates: { lat: 48, lon: 1 } },
            { id: 'vertex-b', name: 'B', coordinates: { lat: 48, lon: 3 } },
            { id: 'vertex-c', name: 'C', coordinates: { lat: 49, lon: 2 } }
          );
          project.data.polygons = [
            { id: 'target', name: 'Snap target', pointIds: ['vertex-a', 'vertex-b', 'vertex-c'] },
          ];
        }
      }
      return projects;
    },
    { projection, targetMode, targetShape }
  );
  await reloadWithProjects(page, projects);
}

export async function seedReciprocalIntersectionProject(page: Page, projection: ProjectProjection) {
  await seedIntersectionProject(page, projection, 'intersection');
  const start = { lat: 48, lon: 0 };
  const through = { lat: 48, lon: 1 };
  const endpoint =
    projection === 'geodesic'
      ? geodesicDestination(through, geodesicInverse(start, through).finalBearing, 200_000)
      : { lat: 48, lon: 3 };
  const projects = await page.evaluate(
    ({ start, through, endpoint }) => {
      const projects: ProjectData[] = JSON.parse(localStorage.getItem('geochase_projects')!);
      const target = projects[0]!.data.lineSegments.find((line) => line.id === 'target')!;
      target.center = start;
      target.intersectionPoint = through;
      target.endpoint = endpoint;
      return projects;
    },
    { start, through, endpoint }
  );
  await reloadWithProjects(page, projects);
  return endpoint;
}

/** Seed after navigation, so an autosave in the outgoing page cannot overwrite the fixture. */
export async function reloadWithProjects(page: Page, projects: ProjectData[]) {
  const seedKey = `__project_seed_${randomUUID()}`;
  await page.addInitScript(
    ({ projects, seedKey }) => {
      if (sessionStorage.getItem(seedKey)) return;
      sessionStorage.setItem(seedKey, '1');
      localStorage.setItem('geochase_projects', JSON.stringify(projects));
    },
    { projects, seedKey }
  );
  await page.reload();
  await expect(page.locator('#map canvas').first()).toBeVisible();
}
