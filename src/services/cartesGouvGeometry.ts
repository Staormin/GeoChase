import type { LatLon } from './geometry';
import { fromLonLat, transform } from 'ol/proj';
import { getDistance, offset } from 'ol/sphere';
import { calculateBearing as sphericalBearing } from './geometry';

/** cartes.gouv.fr MeasureAzimuth, audited against the deployed control on 2026-09-21.
 * Reference: https://cartes.gouv.fr/explorer-les-cartes/assets/index-ZDNodjBE.js
 * Above 500 m it samples the projected line at 500 / spherical endpoint distance.
 * Keep the unrounded value for construction; rounding belongs in the UI.
 */
export function cartesGouvBearing(from: LatLon, to: LatLon): number {
  const start = fromLonLat([from.lon, from.lat]);
  const end = fromLonLat([to.lon, to.lat]);
  const a = transform(start, 'EPSG:3857', 'EPSG:4326');
  let b = transform(end, 'EPSG:3857', 'EPSG:4326');
  const length = getDistance(a, b);
  if (length > 500) {
    const fraction = 500 / length;
    b = transform(
      [start[0]! + (end[0]! - start[0]!) * fraction, start[1]! + (end[1]! - start[1]!) * fraction],
      'EPSG:3857',
      'EPSG:4326'
    );
  }
  return sphericalBearing(a[1]!, a[0]!, b[1]!, b[0]!);
}

const angularDifference = (a: number, b: number) => ((((a - b + 540) % 360) + 360) % 360) - 180;

/** Invert the IGN measurement, keeping distance on the OpenLayers sphere.
 * A spherical destination alone would give the wrong angle on the Mercator line.
 */
export function cartesGouvDestination(from: LatLon, distanceKm: number, azimuth: number): LatLon {
  const distance = distanceKm * 1000;
  if (
    ![from.lat, from.lon, distance, azimuth].every((value) => Number.isFinite(value)) ||
    Math.abs(from.lat) >= 90 ||
    distance < 0 ||
    distance >= Math.PI * 6_371_008.8
  ) {
    throw new RangeError('Invalid Mercator destination');
  }
  if (distance === 0) return { ...from };
  const target = ((azimuth % 360) + 360) % 360;
  const at = (bearing: number): LatLon => {
    const [lon, lat] = offset([from.lon, from.lat], distance, (bearing * Math.PI) / 180);
    return { lat: lat!, lon: lon! };
  };
  const error = (bearing: number) =>
    angularDifference(cartesGouvBearing(from, at(bearing)), target);
  // Allow for floating-point projection noise on very short segments.
  const tolerance = Math.max(1e-8, ((1e-7 / Math.min(distance, 500)) * 180) / Math.PI);
  let bearing = target;
  for (let i = 0; i < 32; i++) {
    const residual = error(bearing);
    if (Math.abs(residual) < tolerance) return at(bearing);
    const delta = 0.001;
    const derivative =
      angularDifference(error(bearing + delta), error(bearing - delta)) / (2 * delta);
    if (!Number.isFinite(derivative) || Math.abs(derivative) < 1e-8) break;
    bearing -= Math.max(-30, Math.min(30, residual / derivative));
  }
  // Near poles the inverse is not globally monotone. Find a continuous bracket
  // instead of returning an unconverged point with an incorrect azimuth.
  for (let low = 0; low < 360; low += 5) {
    let left = low;
    let right = low + 5;
    let leftError = error(left);
    const rightError = error(right);
    if (leftError * rightError > 0 || Math.abs(leftError - rightError) > 180) continue;
    for (let i = 0; i < 50; i++) {
      const mid = (left + right) / 2;
      const residual = error(mid);
      if (Math.abs(residual) < tolerance) return at(mid);
      if (leftError * residual <= 0) right = mid;
      else {
        left = mid;
        leftError = residual;
      }
    }
  }
  throw new RangeError('This distance and azimuth cannot be reached by a Mercator line');
}
