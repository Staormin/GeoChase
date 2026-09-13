import type { ProjectLayerData } from '@/types/project';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseProjectJSON } from '@/domain/layers';
import { createProjectGeometry } from '@/services/projectGeometry';
import { changeProjectProjection } from '@/services/projectProjection';
import { exportProjectAsJSON, getAllProjects } from '@/services/storage';
import { useProjectsStore } from '@/stores/projects';

function empty(): ProjectLayerData {
  return {
    circles: [],
    lineSegments: [],
    points: [],
    polygons: [],
    notes: [],
  };
}
const mercator = createProjectGeometry(() => 'mercator');
const geo = createProjectGeometry(() => 'geodesic');

describe('project projection persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('keeps the selection through autosave, rename, view changes, switching and reload', () => {
    const projects = useProjectsStore();
    projects.createAndSwitchProject('Curved', 'geodesic');
    const id = projects.activeProjectId;
    projects.autoSaveActiveProject(empty());
    projects.updateProject(0, 'Renamed', empty());
    projects.updateViewData({ topPanelOpen: false, sidePanelOpen: true });
    vi.advanceTimersByTime(300);
    expect(getAllProjects()[0]?.projection).toBe('geodesic');
    projects.createAndSwitchProject('Straight');
    expect(projects.activeProjection).toBe('mercator');
    projects.setActiveProject(id);
    expect(projects.activeProjection).toBe('geodesic');
    setActivePinia(createPinia());
    expect(useProjectsStore().activeProjection).toBe('geodesic');
    expect(
      parseProjectJSON(exportProjectAsJSON(useProjectsStore().activeProject!)).projection
    ).toBe('geodesic');
  });

  it('defaults legacy projects and layer-only imports to Mercator', () => {
    localStorage.setItem(
      'geochase_projects',
      JSON.stringify([{ id: 'old', name: 'Old', data: empty() }])
    );
    localStorage.setItem('geochase_activeProjectId', 'old');
    expect(useProjectsStore().activeProjection).toBe('mercator');
    expect(parseProjectJSON(JSON.stringify(empty())).projection).toBe('mercator');
    expect(parseProjectJSON(JSON.stringify({ name: 'Old', data: empty() })).projection).toBe(
      'mercator'
    );
  });

  it.each(['unknown', null, 42])(
    'rejects an invalid projection (%s) before import',
    (projection) => {
      expect(() => parseProjectJSON(JSON.stringify({ projection, data: empty() }))).toThrow();
    }
  );
});

describe('changing existing constructions', () => {
  it('preserves an angle relative to the source line at the selected point', () => {
    const data = empty();
    const center = { lat: 60, lon: -60 };
    const endpoint = { lat: 60, lon: 60 };
    const bearing =
      mercator.calculateBearing(center.lat, center.lon, endpoint.lat, endpoint.lon) + 90;
    data.lineSegments.push(
      {
        id: 'angle',
        name: 'Right angle',
        mode: 'azimuth',
        center: endpoint,
        endpoint: mercator.destinationPoint(endpoint.lat, endpoint.lon, 100, bearing),
        distance: 100,
        azimuth: bearing,
        angleFrom: { lineId: 'source', degrees: 90 },
      },
      { id: 'source', name: 'Source', mode: 'coordinate', center, endpoint }
    );
    const converted = changeProjectProjection(data, 'mercator', 'geodesic');
    const angle = converted.lineSegments[0]!;
    const source = converted.lineSegments[1]!;
    const tangent = geo.bearingAtPoint(source, endpoint)!;
    expect(angle.azimuth).toBeCloseTo((tangent + 90) % 360, 8);
    expect(
      geo.calculateBearing(endpoint.lat, endpoint.lon, angle.endpoint!.lat, angle.endpoint!.lon)
    ).toBeCloseTo(angle.azimuth!, 8);
  });

  it('preserves distances, bearings, fixed coordinates and generated dependencies', () => {
    const data = empty();
    const center = { lat: 60, lon: 10 };
    const endpoint = mercator.destinationPoint(center.lat, center.lon, 500, 60);
    data.lineSegments.push({
      id: 'azimuth',
      name: 'Azimuth',
      center,
      endpoint,
      mode: 'azimuth',
      distance: 500,
      azimuth: 60,
      endPointId: 'generated',
    });
    data.points.push(
      { id: 'fixed', name: 'Fixed', coordinates: center },
      {
        id: 'generated',
        name: 'Generated',
        coordinates: endpoint,
        construction: { lineId: 'azimuth' },
      },
      {
        id: 'along',
        name: 'Along',
        coordinates: mercator.pointAtDistance(center, endpoint, 100),
        construction: { lineId: 'azimuth', distanceKm: 100 },
      }
    );
    data.lineSegments.unshift({
      id: 'dependent',
      name: 'Dependent',
      center: endpoint,
      startPointId: 'generated',
      endpoint: center,
      mode: 'coordinate',
      endPointId: 'fixed',
    });
    const snapshot = JSON.stringify(data);
    const changed = changeProjectProjection(data, 'mercator', 'geodesic');
    const line = changed.lineSegments.find((line) => line.id === 'azimuth')!;
    expect(JSON.stringify(data)).toBe(snapshot);
    expect(line.endpoint).not.toEqual(endpoint);
    expect(
      geo.getDistance([center.lon, center.lat], [line.endpoint!.lon, line.endpoint!.lat])
    ).toBeCloseTo(500_000, 5);
    expect(
      geo.calculateBearing(center.lat, center.lon, line.endpoint!.lat, line.endpoint!.lon)
    ).toBeCloseTo(60, 8);
    expect(changed.points[0]!.coordinates).toEqual(center);
    expect(changed.points[1]!.coordinates).toEqual(line.endpoint);
    expect(changed.lineSegments[0]!.center).toEqual(line.endpoint);
    const along = changed.points[2]!.coordinates;
    expect(geo.getDistance([center.lon, center.lat], [along.lon, along.lat])).toBeCloseTo(
      100_000,
      5
    );
    const restoredProject = changeProjectProjection(changed, 'geodesic', 'mercator');
    const restored = restoredProject.lineSegments[1]!.endpoint!;
    expect(restored.lat).toBeCloseTo(endpoint.lat, 8);
    expect(restored.lon).toBeCloseTo(endpoint.lon, 8);
  });

  it('migrates the extension of an older intersection line and preserves it on repeated changes', () => {
    const data = empty();
    const center = { lat: 45, lon: -5 };
    const through = { lat: 50, lon: 5 };
    const endpoint = mercator.endpointFromIntersection(
      center.lat,
      center.lon,
      through.lat,
      through.lon,
      500
    );
    data.lineSegments.push({
      id: 'intersection',
      name: 'Intersection',
      mode: 'intersection',
      center,
      endpoint,
      intersectionPoint: through,
    });
    const changed = changeProjectProjection(data, 'mercator', 'geodesic');
    const line = changed.lineSegments[0]!;
    expect(line.intersectionExtension).toBeCloseTo(500, 3);
    expect(
      geo.getDistance([through.lon, through.lat], [line.endpoint!.lon, line.endpoint!.lat]) / 1000
    ).toBeCloseTo(500, 3);
    const restored = changeProjectProjection(changed, 'geodesic', 'mercator').lineSegments[0]!;
    expect(restored.endpoint!.lat).toBeCloseTo(endpoint.lat, 5);
    expect(restored.endpoint!.lon).toBeCloseTo(endpoint.lon, 5);
  });

  it('rejects cyclic constructions without changing the input', () => {
    const data = empty();
    data.lineSegments.push(
      {
        id: 'a',
        name: 'A',
        mode: 'azimuth',
        center: { lat: 40, lon: 0 },
        endpoint: { lat: 41, lon: 1 },
        startPointId: 'b-end',
        distance: 10,
        azimuth: 0,
      },
      {
        id: 'b',
        name: 'B',
        mode: 'azimuth',
        center: { lat: 41, lon: 1 },
        endpoint: { lat: 40, lon: 0 },
        startPointId: 'a-end',
        distance: 10,
        azimuth: 0,
      }
    );
    data.points.push(
      {
        id: 'a-end',
        name: 'A end',
        coordinates: { lat: 41, lon: 1 },
        construction: { lineId: 'a' },
      },
      {
        id: 'b-end',
        name: 'B end',
        coordinates: { lat: 40, lon: 0 },
        construction: { lineId: 'b' },
      }
    );
    const snapshot = JSON.stringify(data);
    expect(() => changeProjectProjection(data, 'mercator', 'geodesic')).toThrow('Circular');
    expect(JSON.stringify(data)).toBe(snapshot);
  });
});
