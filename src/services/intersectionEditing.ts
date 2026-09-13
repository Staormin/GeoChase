import type { LatLon } from './geometry';
import type { ProjectProjection } from '@/types/project';
import { fromLonLat, transform } from 'ol/proj';
import { geodesicDestination, geodesicInverse } from './geodesy';
import { createProjectGeometry } from './projectGeometry';

export interface RayPosition {
  parameter: number;
  coordinate: number[];
}

export interface SnapLine {
  id: string;
  name: string;
  coordinates: number[][];
  // Only finite lines have endpoints; sampled vertices and closed outlines do not.
  endpoints?: number[][];
}

const WORLD_WIDTH = 40_075_016.68557849;

function squaredDistance(a: number[], b: number[]): number {
  return (a[0]! - b[0]!) ** 2 + (a[1]! - b[1]!) ** 2;
}

function segmentFraction(point: number[], start: number[], end: number[]): number {
  const dx = end[0]! - start[0]!;
  const dy = end[1]! - start[1]!;
  const lengthSquared = dx * dx + dy * dy;
  return lengthSquared === 0
    ? 0
    : Math.max(
        0,
        Math.min(1, ((point[0]! - start[0]!) * dx + (point[1]! - start[1]!) * dy) / lengthSquared)
      );
}

function interpolate(start: number[], end: number[], fraction: number): number[] {
  return [
    start[0]! + (end[0]! - start[0]!) * fraction,
    start[1]! + (end[1]! - start[1]!) * fraction,
  ];
}

/** The editable endpoint is restricted to the forward continuation through the imposed point. */
export function createIntersectionRay(
  start: LatLon,
  through: LatLon,
  projection: ProjectProjection
) {
  const geometry = createProjectGeometry(() => projection);
  const anchor =
    projection === 'geodesic'
      ? { ...through, lon: through.lon + Math.round((start.lon - through.lon) / 360) * 360 }
      : through;
  const origin = fromLonLat([anchor.lon, anchor.lat]);
  const projectedStart = fromLonLat([start.lon, start.lat]);
  const dx = origin[0]! - projectedStart[0]!;
  const dy = origin[1]! - projectedStart[1]!;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length < 0.000001)
    throw new Error('Two distinct points are required');
  const bearing = projection === 'geodesic' ? geodesicInverse(start, through).finalBearing : 0;
  const limit = 20_037_508.342789244; // Web Mercator's visible latitude boundary.
  const maxParameter =
    projection === 'geodesic'
      ? 20_000_000
      : Math.min(
          40_000_000,
          dy === 0
            ? Number.POSITIVE_INFINITY
            : Math.max(0, ((Math.sign(dy) * limit - origin[1]!) * length) / dy)
        );

  function pointAt(parameter: number): LatLon {
    if (projection === 'geodesic') {
      const point = geodesicDestination(anchor, bearing, parameter);
      // Keep the same displayed world when crossing the antimeridian.
      point.lon += Math.round((anchor.lon - point.lon) / 360) * 360;
      return point;
    }
    const [lon, lat] = transform(
      [origin[0]! + (parameter * dx) / length, origin[1]! + (parameter * dy) / length],
      'EPSG:3857',
      'EPSG:4326'
    );
    return { lat: lat!, lon: lon! };
  }

  function at(parameter: number): RayPosition {
    const point = pointAt(parameter);
    return { parameter, coordinate: fromLonLat([point.lon, point.lat]) };
  }

  const count = projection === 'geodesic' ? 512 : 1;
  const samples = Array.from({ length: count + 1 }, (_, index) =>
    at((maxParameter * index) / count)
  );

  function closest(coordinate: number[]): RayPosition {
    if (projection === 'mercator') {
      const parameter =
        ((coordinate[0]! - origin[0]!) * dx + (coordinate[1]! - origin[1]!) * dy) / length;
      return at(Math.max(0, Math.min(maxParameter, parameter)));
    }
    let index = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i]!.coordinate;
      const b = samples[i + 1]!.coordinate;
      const distance = squaredDistance(
        coordinate,
        interpolate(a, b, segmentFraction(coordinate, a, b))
      );
      if (distance < bestDistance) {
        index = i;
        bestDistance = distance;
      }
    }
    let low = samples[Math.max(0, index - 1)]!.parameter;
    let high = samples[Math.min(samples.length - 1, index + 2)]!.parameter;
    // Refine on the actual WGS84 curve, rather than on a sampled chord.
    for (let iteration = 0; iteration < 48; iteration++) {
      const left = low + (high - low) / 3;
      const right = high - (high - low) / 3;
      if (
        squaredDistance(at(left).coordinate, coordinate) <
        squaredDistance(at(right).coordinate, coordinate)
      )
        high = right;
      else low = left;
    }
    return [at(0), at((low + high) / 2), at(maxParameter)].reduce((best, position) =>
      squaredDistance(position.coordinate, coordinate) <
      squaredDistance(best.coordinate, coordinate)
        ? position
        : best
    );
  }

  function snap(
    position: RayPosition,
    lines: SnapLine[],
    tolerance: number,
    endpointAlignmentTolerance = 0.01
  ): { position: RayPosition; line: SnapLine } | null {
    let best: { position: RayPosition; line: SnapLine } | null = null;
    let bestDistance = tolerance ** 2;
    // Prefer a nearby endpoint over a crossing or any point on an overlapping line.
    for (const line of lines) {
      for (const endpoint of line.endpoints ?? []) {
        const shift =
          Math.round((position.coordinate[0]! - endpoint[0]!) / WORLD_WIDTH) * WORLD_WIDTH;
        const coordinate = [endpoint[0]! + shift, endpoint[1]!];
        const distance = squaredDistance(coordinate, position.coordinate);
        if (distance > bestDistance) continue;
        const candidate = closest(coordinate);
        // Stay on the imposed path. The caller may allow subpixel sampling drift for curves.
        if (squaredDistance(candidate.coordinate, coordinate) > endpointAlignmentTolerance ** 2)
          continue;
        if (candidate.parameter === 0 && squaredDistance(coordinate, origin) > 0.01 ** 2) continue;
        bestDistance = distance;
        best = { position: candidate, line };
      }
    }
    if (best) return best;

    for (const line of lines) {
      for (let j = 0; j < line.coordinates.length - 1; j++) {
        const start = line.coordinates[j]!;
        const end = line.coordinates[j + 1]!;
        const shift =
          Math.round((position.coordinate[0]! - (start[0]! + end[0]!) / 2) / WORLD_WIDTH) *
          WORLD_WIDTH;
        const a = [start[0]! + shift, start[1]!];
        const b = [end[0]! + shift, end[1]!];
        const nearest = interpolate(a, b, segmentFraction(position.coordinate, a, b));
        if (squaredDistance(nearest, position.coordinate) > tolerance ** 2) continue;
        const cross = (coordinate: number[]) =>
          (coordinate[0]! - a[0]!) * (b[1]! - a[1]!) - (coordinate[1]! - a[1]!) * (b[0]! - a[0]!);
        const candidates: RayPosition[] = [];
        for (let i = 0; i < samples.length - 1; i++) {
          const first = samples[i]!;
          const last = samples[i + 1]!;
          const nearRay = interpolate(
            first.coordinate,
            last.coordinate,
            segmentFraction(position.coordinate, first.coordinate, last.coordinate)
          );
          // Allow the small difference between a geodesic and its cached chord.
          if (squaredDistance(nearRay, position.coordinate) > (tolerance + 1000) ** 2) continue;
          let low = first.parameter;
          let high = last.parameter;
          let lowCross = cross(first.coordinate);
          const highCross = cross(last.coordinate);
          if (lowCross * highCross > 0) continue;
          if (Math.abs(lowCross) < 0.000001 && Math.abs(highCross) < 0.000001) {
            candidates.push(closest(nearest));
            continue;
          }
          if (lowCross === 0) {
            candidates.push(first);
            continue;
          }
          if (highCross === 0) {
            candidates.push(last);
            continue;
          }
          for (let iteration = 0; iteration < 48; iteration++) {
            const mid = (low + high) / 2;
            const value = cross(at(mid).coordinate);
            if (value >= 0 === lowCross >= 0) {
              low = mid;
              lowCross = value;
            } else high = mid;
          }
          candidates.push(at((low + high) / 2));
        }
        for (const candidate of candidates) {
          const onTarget = interpolate(a, b, segmentFraction(candidate.coordinate, a, b));
          if (squaredDistance(onTarget, candidate.coordinate) > 0.01 ** 2) continue;
          const distance = squaredDistance(candidate.coordinate, position.coordinate);
          if (distance <= bestDistance) {
            bestDistance = distance;
            best = { position: candidate, line };
          }
        }
      }
    }
    return best;
  }

  function extension(position: RayPosition): number {
    if (projection === 'geodesic') return position.parameter / 1000;
    const point = pointAt(position.parameter);
    return geometry.getDistance([through.lon, through.lat], [point.lon, point.lat]) / 1000;
  }

  return { at, closest, snap, pointAt, extension };
}
