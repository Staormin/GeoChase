import type { LatLon } from './geometry';
import geographiclib from 'geographiclib-geodesic';

const geod = geographiclib.Geodesic.WGS84;
const unrolled = geographiclib.Geodesic.STANDARD | geographiclib.Geodesic.LONG_UNROLL;

export function geodesicInverse(from: LatLon, to: LatLon) {
  const result = geod.Inverse(from.lat, from.lon, to.lat, to.lon);
  return {
    distance: result.s12!,
    initialBearing: (result.azi1! + 360) % 360,
    finalBearing: (result.azi2! + 360) % 360,
  };
}

export function geodesicDestination(origin: LatLon, bearing: number, distanceM: number): LatLon {
  const result = geod.Direct(origin.lat, origin.lon, bearing, distanceM);
  return { lat: result.lat2!, lon: result.lon2! };
}

export function geodesicIntermediate(from: LatLon, to: LatLon, fraction: number): LatLon {
  const line = geod.InverseLine(from.lat, from.lon, to.lat, to.lon);
  const result = line.Position(line.s13 * fraction, unrolled);
  return { lat: result.lat2!, lon: result.lon2! };
}

/** Sample WGS84 geodesics at up to 10 km intervals, with a bounded vertex count.
 * Unwrapped longitudes keep paths continuous at the antimeridian.
 */
export function densifyGeodesic(from: LatLon, to: LatLon, minVertices = 2): LatLon[] {
  const line = geod.InverseLine(from.lat, from.lon, to.lat, to.lon);
  const count = Math.min(2048, Math.max(minVertices, Math.ceil(line.s13 / 10_000) + 1, 2));
  return Array.from({ length: count }, (_, index) => {
    const result = line.Position((line.s13 * index) / (count - 1), unrolled);
    return { lat: result.lat2!, lon: result.lon2! };
  });
}

/** Unsigned area of the smaller WGS84 region, in square meters. */
export function geodesicPolygonArea(points: LatLon[]): number {
  const polygon = geod.Polygon(false);
  for (const point of points) polygon.AddPoint(point.lat, point.lon);
  return Math.abs(polygon.Compute(false, true).area ?? 0);
}
