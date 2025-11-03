/**
 * Geometry service - Utility functions for geographic calculations
 * Reused from original application with TypeScript typing
 */

import { fromLonLat, toLonLat } from 'ol/proj';
import { getDistance as olGetDistance } from 'ol/sphere';

export interface LatLon {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_KM = 6371; // Earth's radius in km

/**
 * Convert degrees to radians
 */
export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 */
export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Calculate destination point given distance and bearing from start point
 * Uses spherical earth model
 */
export function destinationPoint(
  lat: number,
  lon: number,
  distanceKm: number,
  bearing: number
): LatLon {
  const δ = distanceKm / EARTH_RADIUS_KM; // angular distance
  const θ = toRadians(bearing);

  const φ1 = toRadians(lat);
  const λ1 = toRadians(lon);

  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));

  const λ2 =
    λ1 +
    Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));

  return {
    lat: toDegrees(φ2),
    lon: toDegrees(λ2),
  };
}

/**
 * Calculate bearing between two points
 */
export function calculateBearing(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number
): number {
  const φ1 = toRadians(fromLat);
  const λ1 = toRadians(fromLon);
  const φ2 = toRadians(toLat);
  const λ2 = toRadians(toLon);

  const Δλ = λ2 - λ1;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const bearing = toDegrees(Math.atan2(y, x));

  return (bearing + 360) % 360;
}

/**
 * Calculate inverse bearing (reverse azimuth) between two points
 * This is the bearing from point B back to point A
 */
export function calculateInverseBearing(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number
): number {
  // Inverse bearing is just the bearing from the destination back to the origin
  return calculateBearing(toLat, toLon, fromLat, fromLon);
}

/**
 * Calculate endpoint from start point through intersection point with specified distance
 * Compute endpoint so that the straight line in Web Mercator from start to end passes through the intersection point,
 * while the geodesic distance from start to end equals the provided distance.
 */
export function endpointFromIntersection(
  startLat: number,
  startLon: number,
  intersectLat: number,
  intersectLon: number,
  distanceKm: number
): LatLon {
  const D = distanceKm; // km

  // Project to Web Mercator (meters)
  const startProj = fromLonLat([startLon, startLat]);
  const P0x = startProj[0]!;
  const P0y = startProj[1]!;
  const intersectProj = fromLonLat([intersectLon, intersectLat]);
  const Pix = intersectProj[0]!;
  const Piy = intersectProj[1]!;

  let vx = Pix - P0x;
  let vy = Piy - P0y;
  let norm = Math.hypot(vx, vy);

  // Fallback direction if start and intersection project to the same point
  if (norm === 0) {
    vx = 1; // east
    vy = 0;
    norm = 1;
  }
  const v = { x: vx / norm, y: vy / norm };

  // s measured in meters along the projection ray from P0
  const sIntersection = Math.hypot(Pix - P0x, Piy - P0y);

  function endFromS(sMeters: number): LatLon {
    const x = P0x + sMeters * v.x;
    const y = P0y + sMeters * v.y;
    const coords = toLonLat([x, y]);
    return { lat: coords[1]!, lon: coords[0]! };
  }

  function f(sMeters: number): number {
    const end = endFromS(sMeters);
    return olGetDistance([startLon, startLat], [end.lon, end.lat]) / 1000 - D; // km
  }

  // If requested distance is exactly up to the intersection, return it
  const dStartToInter = olGetDistance([startLon, startLat], [intersectLon, intersectLat]) / 1000;
  if (Math.abs(dStartToInter - D) < 1e-6) {
    return { lat: intersectLat, lon: intersectLon };
  }

  // Bracket the root for s >= sIntersection
  const sLow = sIntersection;
  const fLow = f(sLow);

  // If D is smaller than distance to intersection, no solution while keeping the line passing through the point
  // The UI should prevent this; as a fallback, return the intersection to avoid incorrect direction.
  if (fLow > 0) {
    return { lat: intersectLat, lon: intersectLon };
  }

  // Increase sHigh until distance exceeds D (f >= 0)
  let sHigh = sLow + 1000; // start with +1 km in projected meters
  let fHigh = f(sHigh);
  const MAX_S = 40_000_000; // ~40,000 km in meters, safe upper cap
  let iter = 0;
  while (fHigh < 0 && sHigh < MAX_S && iter < 60) {
    sHigh *= 2;
    fHigh = f(sHigh);
    iter++;
  }

  // If still not bracketed, clamp to max
  if (fHigh < 0) {
    // Fall back to extend along the ray using destination point from current bearing
    const pEnd = endFromS(sHigh);
    return { lat: pEnd.lat, lon: pEnd.lon };
  }

  // Bisection to solve f(s)=0
  let a = sLow,
    b = sHigh;
  let _fa = fLow,
    _fb = fHigh;
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (a + b);
    const fm = f(mid);
    if (Math.abs(fm) < 1e-6 || Math.abs(b - a) < 0.01) {
      // ~1 cm in projected space
      const end = endFromS(mid);
      return { lat: end.lat, lon: end.lon };
    }
    if (fm > 0) {
      b = mid;
      _fb = fm;
    } else {
      a = mid;
      _fa = fm;
    }
  }
  // Return best mid if not converged
  const end = endFromS(0.5 * (a + b));
  return { lat: end.lat, lon: end.lon };
}

/**
 * Generate points along a line using linear interpolation in Web Mercator projection
 * This matches how OpenLayers draws line segments (straight lines appear straight in Web Mercator)
 * Used for buffer zone calculations to ensure alignment with displayed line segments
 */
export function generateLinePointsLinear(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  numPoints: number
): LatLon[] {
  const points: LatLon[] = [];

  // Project start and end points to Web Mercator
  const startMercator = fromLonLat([startLon, startLat]);
  const startX = startMercator[0]!;
  const startY = startMercator[1]!;
  const endMercator = fromLonLat([endLon, endLat]);
  const endX = endMercator[0]!;
  const endY = endMercator[1]!;

  // Interpolate linearly in Web Mercator space
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const x = startX + (endX - startX) * t;
    const y = startY + (endY - startY) * t;

    // Convert back to lat/lon
    const coords = toLonLat([x, y]);
    points.push({ lat: coords[1]!, lon: coords[0]! });
  }

  return points;
}

/**
 * Generate circle points at specified radius and number of points
 */
export function generateCircle(
  centerLat: number,
  centerLon: number,
  radiusKm: number,
  numPoints = 360
): LatLon[] {
  const points: LatLon[] = [];

  for (let i = 0; i < numPoints; i++) {
    const bearing = (360 / numPoints) * i;
    const point = destinationPoint(centerLat, centerLon, radiusKm, bearing);
    points.push(point);
  }

  // Close the circle by adding the first point again
  if (points.length > 0 && points[0]) {
    points.push(points[0]);
  }

  return points;
}
