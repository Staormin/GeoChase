import type { LatLon } from '../geometry';
import type { Geometry } from './context';
import type { LineSegmentElement } from '@/types/project';
import { booleanPointInPolygon, point as turfPoint, polygon as turfPolygon } from '@turf/turf';
import { fromLonLat, toLonLat } from 'ol/proj';

const EARTH_RADIUS = 6_371_008.8;
const rad = (degrees: number) => (degrees * Math.PI) / 180;
const deg = (radians: number) => (radians * 180) / Math.PI;
const normalizeLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;

function toVector({ lat, lon }: LatLon): [number, number, number] {
  return [
    Math.cos(rad(lat)) * Math.cos(rad(lon)),
    Math.cos(rad(lat)) * Math.sin(rad(lon)),
    Math.sin(rad(lat)),
  ];
}
function fromVector([x, y, z]: number[]): LatLon {
  return { lat: deg(Math.atan2(z!, Math.hypot(x!, y!))), lon: deg(Math.atan2(y!, x!)) };
}
const dot = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
function cross(a: number[], b: number[]) {
  return [
    a[1]! * b[2]! - a[2]! * b[1]!,
    a[2]! * b[0]! - a[0]! * b[2]!,
    a[0]! * b[1]! - a[1]! * b[0]!,
  ];
}

/** Solves two scalar equations in two unknowns with a numerical Jacobian. */
function newton(
  start: [number, number],
  residual: (x: number, y: number) => [number, number],
  step: number,
  tolerance: number
): [number, number] | null {
  let [x, y] = start;
  for (let i = 0; i < 30; i++) {
    const [f, g] = residual(x, y);
    if (!Number.isFinite(f) || !Number.isFinite(g)) return null;
    if (Math.abs(f) < tolerance && Math.abs(g) < tolerance) return [x, y];
    const [fx, gx] = residual(x + step, y);
    const [fy, gy] = residual(x, y + step);
    const a = (fx - f) / step;
    const b = (fy - f) / step;
    const c = (gx - g) / step;
    const d = (gy - g) / step;
    const det = a * d - b * c;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-18) return null;
    x -= (d * f - b * g) / det;
    y -= (a * g - c * f) / det;
  }
  const [f, g] = residual(x, y);
  return Math.abs(f) < tolerance * 100 && Math.abs(g) < tolerance * 100 ? [x, y] : null;
}

/** Crossings of two ground-distance circles, refined with the project's distance model. */
export function circleIntersections(
  geometry: Geometry,
  first: { center: LatLon; radiusKm: number },
  second: { center: LatLon; radiusKm: number }
): LatLon[] {
  const c1 = toVector(first.center);
  const c2 = toVector(second.center);
  const r1 = (first.radiusKm * 1000) / EARTH_RADIUS;
  const r2 = (second.radiusKm * 1000) / EARTH_RADIUS;
  const q = dot(c1, c2);
  if (1 - q * q < 1e-14) return [];
  const a = (Math.cos(r1) - Math.cos(r2) * q) / (1 - q * q);
  const b = (Math.cos(r2) - Math.cos(r1) * q) / (1 - q * q);
  const base = c1.map((value, index) => a * value + b * c2[index]!);
  const normal = cross(c1, c2);
  const t2 = (1 - dot(base, base)) / dot(normal, normal);
  if (t2 < 0) return [];
  const t = Math.sqrt(t2);
  const guesses = (t < 1e-9 ? [1] : [1, -1]).map((sign) =>
    fromVector(base.map((value, index) => value + sign * t * normal[index]!))
  );
  const distance = (p: LatLon, c: LatLon) =>
    geometry.getDistance([p.lon, p.lat], [c.lon, c.lat]) / 1000;
  const results: LatLon[] = [];
  for (const guess of guesses) {
    const solved = newton(
      [guess.lat, guess.lon],
      (lat, lon) => [
        distance({ lat, lon }, first.center) - first.radiusKm,
        distance({ lat, lon }, second.center) - second.radiusKm,
      ],
      1e-7,
      1e-7
    );
    const point = solved ? { lat: solved[0], lon: normalizeLon(solved[1]) } : guess;
    if (
      !results.some((p) => geometry.getDistance([p.lon, p.lat], [point.lon, point.lat]) < 1) &&
      Math.abs(point.lat) <= 85
    )
      results.push(point);
  }
  return results;
}

/** Point of the displayed segment at equal ground distance from both ends. */
export function equidistantMidpoint(geometry: Geometry, a: LatLon, b: LatLon): LatLon {
  const gap = (t: number) => {
    const p = geometry.interpolateLine(a, b, t);
    return (
      geometry.getDistance([p.lon, p.lat], [a.lon, a.lat]) -
      geometry.getDistance([p.lon, p.lat], [b.lon, b.lat])
    );
  };
  let low = 0;
  let high = 1;
  for (let i = 0; i < 60; i++) {
    const middle = (low + high) / 2;
    if (gap(middle) < 0) low = middle;
    else high = middle;
  }
  return geometry.interpolateLine(a, b, (low + high) / 2);
}

/** Point at distanceKm from origin that is equidistant from a and b, near the guess. */
export function equidistantPoint(
  geometry: Geometry,
  a: LatLon,
  b: LatLon,
  origin: LatLon,
  distanceKm: number,
  guess: LatLon
): LatLon {
  const km = (p: LatLon, q: LatLon) => geometry.getDistance([p.lon, p.lat], [q.lon, q.lat]) / 1000;
  const solved = newton(
    [guess.lat, guess.lon],
    (lat, lon) => [
      km({ lat, lon }, a) - km({ lat, lon }, b),
      km({ lat, lon }, origin) - distanceKm,
    ],
    1e-7,
    1e-7
  );
  return solved ? { lat: solved[0], lon: normalizeLon(solved[1]) } : guess;
}

/** Parametric path of a displayed line; fractions outside [0, 1] extend it. */
export function linePath(geometry: Geometry, line: LineSegmentElement) {
  if (line.mode === 'parallel') {
    const lat = line.longitude ?? line.center.lat;
    return { finite: false, at: (t: number): LatLon => ({ lat, lon: -180 + 360 * t }) };
  }
  const end = geometry.getSegmentEndpoint(line);
  if (!end) throw new Error('Line endpoint unavailable');
  if (geometry.getDistance([line.center.lon, line.center.lat], [end.lon, end.lat]) === 0)
    throw new Error('Choose a line with distinct endpoints');
  return {
    finite: true,
    at: (t: number): LatLon => {
      const point = geometry.interpolateLine(line.center, end, t);
      return { lat: point.lat, lon: normalizeLon(point.lon) };
    },
  };
}

/** Points where the displayed line meets a circle, sorted from the line start. */
export function circleLineIntersections(
  geometry: Geometry,
  circle: { center: LatLon; radiusKm: number },
  line: LineSegmentElement
): LatLon[] {
  const path = linePath(geometry, line);
  const residual = (t: number) => {
    const p = path.at(t);
    return (
      geometry.getDistance([p.lon, p.lat], [circle.center.lon, circle.center.lat]) / 1000 -
      circle.radiusKm
    );
  };
  const samples = 2048;
  const results: LatLon[] = [];
  let previous = residual(0);
  if (Math.abs(previous) < 1e-7) results.push(path.at(0));
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const value = residual(t);
    if (Math.abs(value) < 1e-7) results.push(path.at(t));
    else if (previous * value < 0 && Math.abs(previous) >= 1e-7) {
      let low = (i - 1) / samples;
      let high = t;
      let lowValue = previous;
      for (let k = 0; k < 60; k++) {
        const middle = (low + high) / 2;
        const middleValue = residual(middle);
        if (lowValue * middleValue <= 0) high = middle;
        else {
          low = middle;
          lowValue = middleValue;
        }
      }
      results.push(path.at((low + high) / 2));
    }
    previous = value;
  }
  return results.filter(
    (point, index) =>
      results.findIndex(
        (other) => geometry.getDistance([other.lon, other.lat], [point.lon, point.lat]) < 1
      ) === index
  );
}

/** Crossing of two lines prolonged beyond their endpoints, in the displayed geometry. */
export function extendedLineIntersection(
  geometry: Geometry,
  first: LineSegmentElement,
  second: LineSegmentElement
): { point: LatLon; firstFraction: number; secondFraction: number } | null {
  const a = linePath(geometry, first);
  const b = linePath(geometry, second);
  const project = (p: LatLon) => fromLonLat([p.lon, p.lat]);
  // Initial guess: crossing of the straight projected chords.
  const [p1, p2, p3, p4] = [a.at(0), a.at(1), b.at(0), b.at(1)].map((p) => project(p));
  const d1 = [p2![0]! - p1![0]!, p2![1]! - p1![1]!];
  const d2 = [p4![0]! - p3![0]!, p4![1]! - p3![1]!];
  const det = d1[0]! * -d2[1]! + d2[0]! * d1[1]!;
  if (Math.abs(det) < 1e-6) return null;
  const rx = p3![0]! - p1![0]!;
  const ry = p3![1]! - p1![1]!;
  const s = (rx * -d2[1]! + d2[0]! * ry) / det;
  const u = (d1[0]! * ry - d1[1]! * rx) / det;
  const solved = newton(
    [s, u],
    (x, y) => {
      const pa = project(a.at(x));
      const pb = project(b.at(y));
      return [pa[0]! - pb[0]!, pa[1]! - pb[1]!];
    },
    1e-7,
    0.01
  );
  if (!solved) return null;
  const point = a.at(solved[0]);
  if (!Number.isFinite(point.lat) || Math.abs(point.lat) > 85) return null;
  const [lon, lat] = toLonLat(project(point));
  return {
    point: { lat: lat!, lon: normalizeLon(lon!) },
    firstFraction: solved[0],
    secondFraction: solved[1],
  };
}

/** Mean position: Mercator plane for straight-line projects, ellipsoid-free 3D mean otherwise. */
export function centroid(geometry: Geometry, points: LatLon[]): LatLon {
  if (points.length === 0) throw new Error('No points');
  if (geometry.isGeodesic()) {
    const sum = points
      .map((p) => toVector(p))
      .reduce<number[]>((acc, v) => acc.map((value, i) => value + v[i]!), [0, 0, 0]);
    if (Math.hypot(...sum) < 1e-12) throw new Error('These points have no defined centre');
    return fromVector(sum);
  }
  const projected = points.map((p) => fromLonLat([p.lon, p.lat]));
  const [lon, lat] = toLonLat([
    projected.reduce((sum, p) => sum + p[0]!, 0) / projected.length,
    projected.reduce((sum, p) => sum + p[1]!, 0) / projected.length,
  ]);
  return { lat: lat!, lon: lon! };
}

/** Bearing halfway between two directions, inside the angle they form. */
export function bisectorBearing(first: number, second: number): number {
  const difference = ((second - first + 540) % 360) - 180;
  return (first + difference / 2 + 360) % 360;
}

/** Point-in-polygon test on longitude/latitude vertices (edges included). */
export function isInsidePolygon(point: LatLon, vertices: LatLon[]): boolean {
  const ring = vertices.map((v) => [v.lon, v.lat]);
  return booleanPointInPolygon(
    turfPoint([point.lon, point.lat]),
    turfPolygon([[...ring, ring[0]!]])
  );
}

/** Position on a finite displayed line from a fraction or a distance, from either end. */
export function pointOnLine(
  line: LineSegmentElement,
  input: Record<string, unknown>,
  geometry: Geometry
) {
  const endpoint = geometry.getSegmentEndpoint(line);
  if (line.mode === 'parallel' || !endpoint)
    throw new Error('Choose a finite segment with two endpoints');
  if (geometry.getDistance([line.center.lon, line.center.lat], [endpoint.lon, endpoint.lat]) === 0)
    throw new Error('Choose distinct endpoints');
  if (
    !['fraction', 'kilometers'].includes(String(input.unit)) ||
    typeof input.from_end !== 'boolean'
  )
    throw new Error('Invalid position unit or origin');
  const position = input.position;
  const max = input.unit === 'fraction' ? 1 : 20_000;
  if (typeof position !== 'number' || !Number.isFinite(position) || position < 0 || position > max)
    throw new Error(`Expected number between 0 and ${max}`);
  const fromEnd = input.from_end;
  const origin = fromEnd ? endpoint : line.center;
  const coordinates =
    input.unit === 'fraction'
      ? geometry.interpolateLine(origin, fromEnd ? line.center : endpoint, position)
      : geometry.pointAtDistance(line.center, endpoint, position, fromEnd);
  const distanceKm =
    input.unit === 'kilometers'
      ? position
      : geometry.getDistance([origin.lon, origin.lat], [coordinates.lon, coordinates.lat]) / 1000;
  return {
    coordinates,
    lineId: line.id,
    construction: {
      lineId: line.id,
      distanceKm,
      fromEnd,
      ...(input.unit === 'fraction' ? { fraction: position } : {}),
    },
  };
}
