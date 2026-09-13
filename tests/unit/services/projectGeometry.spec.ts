import type { LineSegmentElement, ProjectProjection } from '@/types/project';
import { fromLonLat, toLonLat } from 'ol/proj';
import { describe, expect, it, vi } from 'vitest';
import { densifyGeodesic, geodesicInverse } from '@/services/geodesy';
import { generateLineSegmentTracks } from '@/services/gpx';
import { createProjectGeometry } from '@/services/projectGeometry';

vi.unmock('ol/proj');

const geo = createProjectGeometry(() => 'geodesic');
const mercator = createProjectGeometry(() => 'mercator');
const start = { lat: 60, lon: -60 };
const end = { lat: 60, lon: 60 };

describe('project geometry', () => {
  describe('points on lines', () => {
    const line: LineSegmentElement = {
      id: 'reference',
      name: 'Reference',
      mode: 'coordinate',
      center: start,
      endpoint: end,
    };

    it.each(['mercator', 'geodesic'] as const)(
      'matches endpoints and interior points in %s, without accepting extensions or nearby points',
      (projection) => {
        const geometry = createProjectGeometry(() => projection);
        const midpoint = geometry.interpolateLine(start, end, 0.5);
        expect(geometry.isPointOnLine(line, start)).toBe(true);
        expect(geometry.isPointOnLine(line, end)).toBe(true);
        expect(geometry.isPointOnLine(line, midpoint)).toBe(true);
        expect(geometry.isPointOnLine(line, { ...midpoint, lat: midpoint.lat + 0.001 })).toBe(
          false
        );
        expect(geometry.isPointOnLine(line, geometry.interpolateLine(start, end, 1.01))).toBe(
          false
        );
        expect(geometry.isPointOnLine({ ...line, endpoint: start }, start)).toBe(false);
        expect(geometry.isPointOnLine({ ...line, endpoint: undefined }, start)).toBe(false);
      }
    );

    it('uses the selected projection instead of treating the geodesic as a straight line', () => {
      expect(geo.isPointOnLine(line, { lat: 60, lon: 0 })).toBe(false);
      expect(mercator.isPointOnLine(line, geo.interpolateLine(start, end, 0.5))).toBe(false);
    });

    it('accepts rounded points on rendered geodesic segments and exact points between vertices', () => {
      const path = geo.lineCoordinates(start, end);
      const first = path[101]!;
      const second = path[102]!;
      const [lon, lat] = toLonLat([(first[0]! + second[0]!) / 2, (first[1]! + second[1]!) / 2]);
      expect(
        geo.isPointOnLine(line, { lat: Number(lat!.toFixed(6)), lon: Number(lon!.toFixed(6)) })
      ).toBe(true);
      const exact = geo.interpolateLine(start, end, 101.5 / (path.length - 1));
      expect(geo.isPointOnLine(line, exact)).toBe(true);
    });

    it.each(['mercator', 'geodesic'] as const)('supports all line modes in %s', (projection) => {
      const geometry = createProjectGeometry(() => projection);
      for (const mode of ['coordinate', 'intersection', 'azimuth'] as const) {
        expect(geometry.isPointOnLine({ ...line, mode }, end)).toBe(true);
      }
      expect(
        geometry.isPointOnLine(
          { ...line, mode: 'azimuth', endpoint: undefined, distance: 100, azimuth: 90 },
          geometry.destinationPoint(start.lat, start.lon, 100, 90)
        )
      ).toBe(true);
      const parallel: LineSegmentElement = { ...line, mode: 'parallel', longitude: 48 };
      expect(geometry.isPointOnLine(parallel, { lat: 48, lon: 170 })).toBe(true);
      expect(geometry.isPointOnLine(parallel, { lat: 48.01, lon: 170 })).toBe(false);
    });

    it('recognizes wrapped crossings on a rendered geodesic across the dateline', () => {
      const dateline = { ...line, center: { lat: 30, lon: 179 }, endpoint: { lat: 30, lon: -179 } };
      const path = geo.lineCoordinates(dateline.center, dateline.endpoint);
      const first = path.at(-3)!;
      const second = path.at(-2)!;
      const [lon, lat] = toLonLat([(first[0]! + second[0]!) / 2, (first[1]! + second[1]!) / 2]);
      expect(lon).toBeLessThan(-179);
      expect(geo.isPointOnLine(dateline, { lat: lat!, lon: lon! })).toBe(true);
    });
  });

  it('uses the WGS84 equatorial radius and solves antipodal points', () => {
    expect(geo.getDistance([0, 0], [1, 0])).toBeCloseTo(111_319.490793, 5);
    expect(geo.getDistance([0, 0], [180, 0])).toBeCloseTo(20_003_931.458625, 4);
    expect(geo.calculateBearing(0, 0, 0, 1)).toBeCloseTo(90, 9);
    expect(geo.destinationPoint(0, 0, 111.319490793, 90).lon).toBeCloseTo(1, 9);
  });

  it('updates existing consumers when the project selection changes', () => {
    let projection: ProjectProjection = 'mercator';
    const geometry = createProjectGeometry(() => projection);
    expect(geometry.lineCoordinates(start, end)).toHaveLength(2);
    projection = 'geodesic';
    const coordinates = geometry
      .lineCoordinates(start, end)
      .map((coordinate) => toLonLat(coordinate));
    expect(coordinates.length).toBeGreaterThan(100);
    expect(Math.max(...coordinates.map((point) => point[1]!))).toBeGreaterThan(73);
  });

  it('continues an intersection using the arrival bearing, preserving the distance beyond it', () => {
    const through = { lat: 65, lon: 10 };
    const endpoint = geo.endpointFromIntersection(
      start.lat,
      start.lon,
      through.lat,
      through.lon,
      500
    );
    const approach = geodesicInverse(start, through);
    const extension = geodesicInverse(through, endpoint);
    expect(Math.abs(approach.initialBearing - approach.finalBearing)).toBeGreaterThan(30);
    expect(extension.initialBearing).toBeCloseTo(approach.finalBearing, 8);
    expect(extension.distance).toBeCloseTo(500_000, 5);
    expect(geo.endpointFromIntersection(start.lat, start.lon, through.lat, through.lon, 0)).toEqual(
      through
    );
    expect(() => geo.endpointFromIntersection(0, 0, 0, 0, 1)).toThrow();
  });

  it('places points by distance along the selected path, including from the end', () => {
    const halfKm = geo.getDistance([start.lon, start.lat], [end.lon, end.lat]) / 2000;
    const midpoint = geo.pointAtDistance(start, end, halfKm);
    expect(midpoint.lat).toBeGreaterThan(73);
    expect(midpoint.lon).toBeCloseTo(0, 8);
    expect(geo.pointAtDistance(start, end, halfKm, true).lat).toBeCloseTo(midpoint.lat, 8);
    const point = mercator.pointAtDistance(start, end, 100);
    expect(point.lat).toBeCloseTo(60, 8);
    expect(mercator.getDistance([start.lon, start.lat], [point.lon, point.lat])).toBeCloseTo(
      100_000,
      1
    );
    expect(() => geo.pointAtDistance(start, end, Number.NaN)).toThrow();
    expect(() => geo.pointAtDistance(start, end, 30_000)).toThrow();
    expect(geo.pointAtDistance(start, start, 0)).toEqual(start);
  });

  it('keeps navigation on the Mercator line or the geodesic arc', () => {
    const other = { lat: 30, lon: 20 };
    const projected = fromLonLat([other.lon, other.lat]);
    const origin = fromLonLat([start.lon, start.lat]);
    const midpoint = mercator.interpolateLine(start, other, 0.5);
    expect(fromLonLat([midpoint.lon, midpoint.lat])[1]).toBeCloseTo(
      (projected[1]! + origin[1]!) / 2,
      6
    );
    expect(geo.interpolateLine(start, end, 0.5).lat).toBeGreaterThan(73);
  });

  it('keeps dateline crossings continuous on the map and valid in GPX', () => {
    const from = { lat: 30, lon: 179 };
    const to = { lat: 30, lon: -179 };
    const path = densifyGeodesic(from, to);
    expect(path.at(-1)!.lon).toBeCloseTo(181, 8);
    expect(
      Math.max(...path.map((point, i) => Math.abs(point.lon - (path[i - 1]?.lon ?? point.lon))))
    ).toBeLessThan(1);
    const gpx = generateLineSegmentTracks(
      [{ name: 'A & B', mode: 'coordinate', center: from, endpoint: to }],
      'geodesic'
    );
    expect(gpx).toContain('A &amp; B');
    const longitudes = [...gpx.matchAll(/lon="([\d.-]+)"/g)].map((match) => Number(match[1]));
    expect(longitudes.length).toBeGreaterThan(2);
    expect(longitudes.every((lon) => Math.abs(lon) <= 180)).toBe(true);
  });

  it('samples circles at their WGS84 radius and curves polygon edges', () => {
    const circle = geo.generateCircle(60, 10, 100, 32);
    expect(circle).toHaveLength(33);
    expect(circle[0]).toEqual(circle.at(-1));
    for (const point of circle)
      expect(geo.getDistance([10, 60], [point.lon, point.lat])).toBeCloseTo(100_000, 5);
    const polygon = geo.polygonCoordinates([start, end, { lat: 40, lon: 0 }]);
    expect(polygon.length).toBeGreaterThan(100);
    expect(polygon[0]![0]).toBeCloseTo(polygon.at(-1)![0]!, 5);
    expect(polygon[0]![1]).toBeCloseTo(polygon.at(-1)![1]!, 5);
  });

  it('exports every line mode as an arc except constant-latitude parallels', () => {
    for (const mode of ['coordinate', 'azimuth', 'intersection'] as const) {
      const xml = generateLineSegmentTracks([{ mode, center: start, endpoint: end }], 'geodesic');
      const latitudes = [...xml.matchAll(/lat="([\d.-]+)"/g)].map((match) => Number(match[1]));
      expect(Math.max(...latitudes)).toBeGreaterThan(73);
      const flatXML = generateLineSegmentTracks(
        [{ mode, center: start, endpoint: end }],
        'mercator'
      );
      const flatLatitudes = [...flatXML.matchAll(/lat="([\d.-]+)"/g)].map((match) =>
        Number(match[1])
      );
      expect(flatLatitudes).toHaveLength(101);
      expect(flatLatitudes.every((lat) => lat === 60)).toBe(true);
    }
    const xml = generateLineSegmentTracks(
      [{ mode: 'parallel', center: start, longitude: 60 }],
      'geodesic'
    );
    expect([...xml.matchAll(/lat="([\d.-]+)"/g)].every((match) => Number(match[1]) === 60)).toBe(
      true
    );
  });
});
