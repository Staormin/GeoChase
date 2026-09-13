import type { ProjectLayerData, ProjectProjection } from '@/types/project';
import { fromLonLat } from 'ol/proj';
import { describe, expect, it, vi } from 'vitest';
import { geodesicInverse } from '@/services/geodesy';
import { createIntersectionRay } from '@/services/intersectionEditing';
import { createProjectGeometry } from '@/services/projectGeometry';
import { changeIntersectionExtension } from '@/services/projectProjection';

vi.unmock('ol/proj');

for (const projection of ['mercator', 'geodesic'] satisfies ProjectProjection[]) {
  describe(`${projection} intersection endpoint editing`, () => {
    const start = { lat: 43, lon: -3 };
    const through = { lat: 47, lon: 2 };
    const geometry = createProjectGeometry(() => projection);

    it('projects arbitrary mouse positions onto the imposed forward path', () => {
      const ray = createIntersectionRay(start, through, projection);
      const pointer = fromLonLat([6, 48]);
      const position = ray.closest(pointer);
      const endpoint = ray.pointAt(position.parameter);
      const distance = ray.extension(position);
      expect(distance).toBeGreaterThan(0);
      const expected = geometry.endpointFromIntersection(
        start.lat,
        start.lon,
        through.lat,
        through.lon,
        distance
      );
      expect(endpoint.lat).toBeCloseTo(expected.lat, 6);
      expect(endpoint.lon).toBeCloseTo(expected.lon, 6);
      expect(position.coordinate).not.toEqual(pointer);
      expect(ray.extension(ray.closest(fromLonLat([start.lon, start.lat])))).toBeCloseTo(0, 5);
    });

    it('snaps to a crossing line while keeping the endpoint on its constrained path', () => {
      const ray = createIntersectionRay(start, through, projection);
      const position = ray.closest(fromLonLat([5, 50]));
      const [x, y] = position.coordinate;
      const snapped = ray.snap(
        position,
        [
          {
            id: 'target',
            name: 'Target',
            coordinates: [
              [x! - 100_000, y! + 100],
              [x! + 100_000, y! + 100],
            ],
          },
        ],
        200
      );
      expect(snapped?.line.id).toBe('target');
      expect(snapped!.position.coordinate[1]).toBeCloseTo(y! + 100, 3);
      const endpoint = ray.pointAt(snapped!.position.parameter);
      const expected = geometry.endpointFromIntersection(
        start.lat,
        start.lon,
        through.lat,
        through.lon,
        ray.extension(snapped!.position)
      );
      expect(endpoint.lat).toBeCloseTo(expected.lat, 6);
      expect(endpoint.lon).toBeCloseTo(expected.lon, 6);
    });

    it('does not snap to a nearby line whose crossing lies outside the snapping radius', () => {
      const ray = createIntersectionRay(start, through, projection);
      const position = ray.closest(fromLonLat([5, 50]));
      const ahead = ray.at(position.parameter + 10_000).coordinate;
      const behind = ray.at(position.parameter - 10_000).coordinate;
      // An almost parallel line can be near the endpoint without crossing nearby.
      const targets = [
        {
          id: 'parallel',
          name: 'Parallel',
          coordinates: [
            [behind[0]! + 100, behind[1]!],
            [ahead[0]! + 100, ahead[1]!],
          ],
        },
      ];
      expect(ray.snap(position, targets, 200)).toBeNull();
    });

    it('can snap exactly at the imposed intersection (zero extension)', () => {
      const ray = createIntersectionRay(start, through, projection);
      const origin = ray.at(0);
      const [x, y] = origin.coordinate;
      const target = {
        id: 'zero',
        name: 'Zero',
        coordinates: [
          [x! - 100, y!],
          [x! + 100, y!],
        ],
      };
      expect(ray.snap(origin, [target], 20)?.position.parameter).toBeCloseTo(0, 4);
    });

    it('attracts the endpoint to either end of an overlapping line', () => {
      const ray = createIntersectionRay({ lat: 45, lon: 2 }, { lat: 46, lon: 2 }, projection);
      const first = ray.at(100_000);
      const last = ray.at(300_000);
      const coordinates = [first.coordinate, last.coordinate];
      const target = { id: 'overlap', name: 'Overlap', coordinates, endpoints: coordinates };
      for (const endpoint of [first, last]) {
        for (const offset of [-50, 50]) {
          const position = ray.at(endpoint.parameter + offset);
          const snapped = ray.snap(position, [target], 200);
          expect(snapped?.line.id).toBe('overlap');
          expect(snapped!.position.parameter).toBeCloseTo(endpoint.parameter, 3);
        }
      }
    });

    it('snaps the second line back to the first line endpoint after a crossing snap', () => {
      const startA = { lat: 45, lon: 2 };
      const throughA = { lat: 46, lon: 2 };
      const startB = { lat: 48, lon: 0 };
      const throughB = { lat: 48, lon: 1 };
      const rayA = createIntersectionRay(startA, throughA, projection);
      const rayB = createIntersectionRay(startB, throughB, projection);
      const endB = geometry.endpointFromIntersection(48, 0, 48, 1, 200);
      const pathB = geometry.lineCoordinates(startB, endB);
      const snapA = rayA.snap(
        rayA.closest(fromLonLat([2, 48])),
        [
          {
            id: 'b',
            name: 'B',
            coordinates: pathB,
          },
        ],
        5000
      )!;
      expect(snapA).not.toBeNull();
      // Reconstruct the saved endpoint, including the normal distance-to-coordinate rounding.
      const endA = geometry.endpointFromIntersection(45, 2, 46, 2, rayA.extension(snapA.position));
      const pathA = geometry.lineCoordinates(startA, endA);
      const endpoint = pathA.at(-1)!;
      const nearEndpoint = rayB.closest([endpoint[0]! + 100, endpoint[1]!]);
      const snapB = rayB.snap(
        nearEndpoint,
        [
          {
            id: 'a',
            name: 'A',
            coordinates: pathA,
            endpoints: [pathA[0]!, endpoint],
          },
        ],
        5000,
        10
      );
      expect(snapB?.line.id).toBe('a');
      expect(snapB!.position.parameter).toBeCloseTo(rayB.closest(endpoint).parameter, 3);
      // Keep the imposed direction; only a subpixel difference from the rendered target is allowed.
      expect(
        Math.hypot(...snapB!.position.coordinate.map((value, index) => value - endpoint[index]!))
      ).toBeLessThan(10);
    });

    it('prefers a nearby endpoint over a closer line crossing', () => {
      const ray = createIntersectionRay({ lat: 45, lon: 2 }, { lat: 46, lon: 2 }, projection);
      const endpoint = ray.at(100_000);
      const crossing = ray.at(100_030);
      const coordinates = [ray.at(0).coordinate, endpoint.coordinate];
      const snap = ray.snap(
        ray.at(100_040),
        [
          { id: 'endpoint', name: 'Endpoint', coordinates, endpoints: coordinates },
          {
            id: 'crossing',
            name: 'Crossing',
            coordinates: [
              [crossing.coordinate[0]! - 1000, crossing.coordinate[1]!],
              [crossing.coordinate[0]! + 1000, crossing.coordinate[1]!],
            ],
          },
        ],
        200
      );
      expect(snap?.line.id).toBe('endpoint');
      expect(snap!.position.parameter).toBeCloseTo(endpoint.parameter, 3);
    });

    it('does not snap endpoints off the imposed path or beyond the snap radius', () => {
      const ray = createIntersectionRay({ lat: 45, lon: 2 }, { lat: 46, lon: 2 }, projection);
      const endpoint = ray.at(100_000);
      const offPath = [endpoint.coordinate[0]! + 50, endpoint.coordinate[1]!];
      expect(
        ray.snap(
          endpoint,
          [{ id: 'off', name: 'Off path', coordinates: [], endpoints: [offPath] }],
          200
        )
      ).toBeNull();
      expect(
        ray.snap(
          ray.at(101_000),
          [{ id: 'far', name: 'Far', coordinates: [], endpoints: [endpoint.coordinate] }],
          200
        )
      ).toBeNull();
    });
  });
}

it('continues across the antimeridian in the same displayed world', () => {
  const start = { lat: 40, lon: 178 };
  const through = { lat: 41, lon: -179 };
  const ray = createIntersectionRay(start, through, 'geodesic');
  const position = ray.closest(fromLonLat([183, 42]));
  const endpoint = ray.pointAt(position.parameter);
  expect(endpoint.lon).toBeGreaterThan(181);
  expect(geodesicInverse(through, endpoint).initialBearing).toBeCloseTo(
    geodesicInverse(start, through).finalBearing,
    6
  );
});

describe('committing an intersection extension', () => {
  function project(): ProjectLayerData {
    return {
      circles: [],
      polygons: [{ id: 'area', name: 'Area', pointIds: ['start', 'through', 'end'] }],
      notes: [],
      points: [
        { id: 'start', name: 'Start', coordinates: { lat: 40, lon: 0 } },
        { id: 'through', name: 'Through', coordinates: { lat: 41, lon: 0 } },
        { id: 'end', name: 'Endpoint', coordinates: { lat: 42, lon: 0 } },
      ],
      lineSegments: [
        {
          id: 'intersection',
          name: 'Intersection',
          mode: 'intersection',
          center: { lat: 40, lon: 0 },
          intersectionPoint: { lat: 41, lon: 0 },
          endpoint: { lat: 42, lon: 0 },
          endPointId: 'end',
          color: '#f00',
          noteId: 'note',
        },
        {
          id: 'connected',
          name: 'Connected',
          mode: 'coordinate',
          center: { lat: 42, lon: 0 },
          endpoint: { lat: 43, lon: 1 },
          startPointId: 'end',
        },
      ],
    };
  }

  it('preserves IDs, style and imposed points while updating distance and connected endpoints', () => {
    const original = project();
    const snapshot = JSON.stringify(original);
    const changed = changeIntersectionExtension(original, 'intersection', 50, 'geodesic');
    expect(JSON.stringify(original)).toBe(snapshot);
    const line = changed.lineSegments[0]!;
    expect(line.intersectionExtension).toBe(50);
    expect(line.color).toBe('#f00');
    expect(line.noteId).toBe('note');
    expect(line.center).toEqual(original.lineSegments[0]!.center);
    expect(line.intersectionPoint).toEqual(original.lineSegments[0]!.intersectionPoint);
    expect(geodesicInverse(line.intersectionPoint!, line.endpoint!).distance).toBeCloseTo(
      50_000,
      6
    );
    expect(changed.points[2]!.coordinates).toEqual(line.endpoint);
    expect(changed.lineSegments[1]!.center).toEqual(line.endpoint);
    expect(changed.polygons[0]!.pointIds).toEqual(['start', 'through', 'end']);
  });

  it('keeps points that fall beyond a shortened line, removing their construction link', () => {
    const original = project();
    original.points.push({
      id: 'along',
      name: 'Along',
      coordinates: { lat: 41.9, lon: 0 },
      construction: { lineId: 'intersection', distanceKm: 210 },
      lineId: 'intersection',
    });
    original.lineSegments[0]!.pointsOnLine = ['along'];
    const changed = changeIntersectionExtension(original, 'intersection', 0, 'geodesic');
    expect(changed.points[3]!.coordinates).toEqual(original.points[3]!.coordinates);
    expect(changed.points[3]!.construction).toBeUndefined();
    expect(changed.points[3]!.lineId).toBeUndefined();
    expect(changed.lineSegments[0]!.pointsOnLine).toEqual([]);
    expect(changed.lineSegments[0]!.endpoint).toEqual({ lat: 41, lon: 0 });
  });
});
