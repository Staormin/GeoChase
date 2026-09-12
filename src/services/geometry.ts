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
 * Extend the straight map line from start through the intersection point.
 * distanceKm is measured from the intersection point to the new endpoint.
 */
export function endpointFromIntersection(
  startLat: number,
  startLon: number,
  intersectLat: number,
  intersectLon: number,
  distanceKm: number
): LatLon {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new RangeError('Extension distance must be finite and non-negative');
  }
  if (distanceKm === 0) return { lat: intersectLat, lon: intersectLon };

  const start = fromLonLat([startLon, startLat]);
  const intersection = fromLonLat([intersectLon, intersectLat]);
  const dx = intersection[0]! - start[0]!;
  const dy = intersection[1]! - start[1]!;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length === 0) {
    throw new RangeError('Two distinct points are required to define the line direction');
  }

  // Keep start, intersection and endpoint collinear in the map projection.
  function endpointAt(offset: number): LatLon {
    const [lon, lat] = toLonLat([
      intersection[0]! + (offset * dx) / length,
      intersection[1]! + (offset * dy) / length,
    ]);
    return { lat: lat!, lon: lon! };
  }

  function distanceAt(offset: number): number {
    const endpoint = endpointAt(offset);
    return olGetDistance([intersectLon, intersectLat], [endpoint.lon, endpoint.lat]) / 1000;
  }

  // Find a projected offset whose ground distance reaches the requested extension.
  const maxOffset = 40_000_000;
  let low = 0;
  let high = 1000;
  while (distanceAt(high) < distanceKm && high < maxOffset) {
    high = Math.min(high * 2, maxOffset);
  }
  if (distanceAt(high) < distanceKm) {
    throw new RangeError('The requested distance cannot be reached in this direction');
  }

  for (let iteration = 0; iteration < 60; iteration++) {
    const mid = (low + high) / 2;
    const distance = distanceAt(mid);
    if (Math.abs(distance - distanceKm) < 1e-6 || high - low < 0.01) {
      return endpointAt(mid);
    }
    if (distance > distanceKm) high = mid;
    else low = mid;
  }
  return endpointAt((low + high) / 2);
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
