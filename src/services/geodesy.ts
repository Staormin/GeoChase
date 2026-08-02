/**
 * Geodesy service - WGS84 ellipsoid calculations for geodesic (great-circle) lines
 *
 * All functions work in WGS84 lon/lat degrees and meters.
 *
 * Geodesic computations are delegated to geographiclib-geodesic (Karney's
 * algorithm): it converges for all point pairs including nearly antipodal
 * ones and is accurate to nanometers, whereas Vincenty's inverse formula can
 * fail to converge near the antipode. Note that ol/sphere (getDistance,
 * offset) is spherical only (~0.5% error vs the ellipsoid), which is why it
 * is not used here.
 */

import type { LatLon } from './geometry';
import geographiclib from 'geographiclib-geodesic';

const geod = geographiclib.Geodesic.WGS84;
// LONG_UNROLL makes Position() return longitudes unwrapped relative to the
// start point (no ±180° jump at the antimeridian).
const STANDARD_UNROLLED = geographiclib.Geodesic.STANDARD | geographiclib.Geodesic.LONG_UNROLL;

// WGS84 ellipsoid constants (used by the rhumb implementation)
const WGS84_A = 6_378_137; // semi-major axis (m)
const WGS84_F = 1 / 298.257_223_563; // flattening
const WGS84_E2 = WGS84_F * (2 - WGS84_F); // first eccentricity squared
const WGS84_E = Math.sqrt(WGS84_E2);

const DEG = Math.PI / 180;

export interface GeodesicInverseResult {
  /** Geodesic distance in meters */
  distance: number;
  /** Azimuth of the geodesic at the origin, degrees clockwise from north */
  initialBearing: number;
  /** Azimuth of the geodesic at the destination, degrees clockwise from north */
  finalBearing: number;
}

export interface DensifyOptions {
  /** Target spacing between vertices in meters (default 10 km) */
  maxSegmentLengthM?: number;
  /** Minimum number of vertices (default 2) */
  minVertices?: number;
  /** Maximum number of vertices (default 512) */
  maxVertices?: number;
}

const DEFAULT_SEGMENT_LENGTH_M = 10_000;
const DEFAULT_MIN_VERTICES = 2;
const DEFAULT_MAX_VERTICES = 512;

/**
 * Solve the inverse geodesic problem: distance and bearings between two points.
 */
export function geodesicInverse(from: LatLon, to: LatLon): GeodesicInverseResult {
  const r = geod.Inverse(from.lat, from.lon, to.lat, to.lon);
  return {
    distance: r.s12!,
    initialBearing: (r.azi1! + 360) % 360,
    finalBearing: (r.azi2! + 360) % 360,
  };
}

/**
 * Geodesic (shortest-path) distance between two points, in meters.
 */
export function geodesicDistance(a: LatLon, b: LatLon): number {
  return geod.Inverse(a.lat, a.lon, b.lat, b.lon).s12!;
}

/**
 * Solve the direct geodesic problem: destination when travelling distanceM
 * meters along the geodesic leaving origin at initialBearingDeg.
 * The azimuth varies along the path; initialBearingDeg is the bearing at the origin.
 */
export function geodesicDestination(
  origin: LatLon,
  initialBearingDeg: number,
  distanceM: number
): LatLon {
  const r = geod.Direct(origin.lat, origin.lon, initialBearingDeg, distanceM);
  return { lat: r.lat2!, lon: r.lon2! };
}

/**
 * Point at the given fraction (0..1) along the geodesic from `from` to `to`.
 */
export function geodesicIntermediate(from: LatLon, to: LatLon, fraction: number): LatLon {
  const line = geod.InverseLine(from.lat, from.lon, to.lat, to.lon);
  const r = line.Position(line.s13 * fraction, STANDARD_UNROLLED);
  return { lat: r.lat2!, lon: normalizeLon(r.lon2!) };
}

/**
 * Number of vertices for a polyline approximating a geodesic of the given
 * length: ~1 vertex per maxSegmentLengthM, clamped to [minVertices, maxVertices].
 */
function vertexCount(distanceM: number, opts?: DensifyOptions): number {
  const spacing = opts?.maxSegmentLengthM ?? DEFAULT_SEGMENT_LENGTH_M;
  const min = opts?.minVertices ?? DEFAULT_MIN_VERTICES;
  const max = opts?.maxVertices ?? DEFAULT_MAX_VERTICES;
  return Math.min(max, Math.max(min, Math.ceil(distanceM / spacing) + 1));
}

/**
 * Sample a geographiclib GeodesicLine into an unwrapped LatLon polyline.
 */
function samplePath(line: any, totalDistanceM: number, opts?: DensifyOptions): LatLon[] {
  const n = vertexCount(totalDistanceM, opts);
  const points: LatLon[] = [];
  for (let i = 0; i < n; i++) {
    const r = line.Position((totalDistanceM * i) / (n - 1), STANDARD_UNROLLED);
    points.push({ lat: r.lat2!, lon: r.lon2! });
  }
  return points;
}

/**
 * Polyline approximating the geodesic arc between two points.
 *
 * Longitudes are unwrapped (successive vertices never jump by more than 180°,
 * values may exceed ±180°) so the rendered line does not jump across the map
 * at the antimeridian. The first vertex keeps the longitude of `from` as given.
 */
export function densifyGeodesic(from: LatLon, to: LatLon, opts?: DensifyOptions): LatLon[] {
  const line = geod.InverseLine(from.lat, from.lon, to.lat, to.lon);
  return samplePath(line, line.s13, opts);
}

/**
 * Polyline approximating the geodesic leaving `origin` at initialBearingDeg
 * for distanceM meters (direct problem). Longitudes are unwrapped.
 */
export function densifyGeodesicFromBearing(
  origin: LatLon,
  initialBearingDeg: number,
  distanceM: number,
  opts?: DensifyOptions
): LatLon[] {
  const line = geod.DirectLine(origin.lat, origin.lon, initialBearingDeg, distanceM);
  return samplePath(line, distanceM, opts);
}

/**
 * Normalize a longitude to (-180, 180].
 */
export function normalizeLon(lon: number): number {
  let result = lon % 360;
  if (result > 180) result -= 360;
  if (result <= -180) result += 360;
  return result;
}

/**
 * Meridian arc length from the equator to latitude phi (radians), in meters.
 * Standard series expansion in the first eccentricity squared.
 */
function meridianArc(phi: number): number {
  const e2 = WGS84_E2;
  const e4 = e2 * e2;
  const e6 = e4 * e2;
  return (
    WGS84_A *
    ((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * phi -
      ((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * phi) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * phi) -
      ((35 * e6) / 3072) * Math.sin(6 * phi))
  );
}

/**
 * Inverse of meridianArc: latitude (radians) whose meridian arc length is m.
 * Uses the standard footpoint-latitude series in e1.
 */
function inverseMeridianArc(m: number): number {
  const e2 = WGS84_E2;
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const mu = m / (WGS84_A * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256));
  return (
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu)
  );
}

/**
 * Isometric latitude on the WGS84 ellipsoid, for latitude phi (radians).
 */
function isometricLatitude(phi: number): number {
  const sinPhi = Math.sin(phi);
  return (
    Math.log(Math.tan(Math.PI / 4 + phi / 2)) -
    (WGS84_E / 2) * Math.log((1 + WGS84_E * sinPhi) / (1 - WGS84_E * sinPhi))
  );
}

/**
 * Solve the direct rhumb-line (loxodrome) problem on the WGS84 ellipsoid:
 * destination when travelling distanceM meters at CONSTANT bearing bearingDeg.
 *
 * This is the mathematical formalization of the app's historical line
 * semantics: a straight segment drawn in the Web Mercator projection is a
 * rhumb line. It is exposed so both behaviours (rhumb vs geodesic) have an
 * explicit, named implementation.
 */
export function rhumbDestination(origin: LatLon, bearingDeg: number, distanceM: number): LatLon {
  const theta = bearingDeg * DEG;
  const phi1 = origin.lat * DEG;
  const cosTheta = Math.cos(theta);

  // Latitude via the meridian arc: northward component of the run
  const phi2 = inverseMeridianArc(meridianArc(phi1) + distanceM * cosTheta);

  // Longitude via the isometric latitude difference
  let deltaLambda: number;
  if (Math.abs(cosTheta) > 1e-12) {
    deltaLambda = Math.tan(theta) * (isometricLatitude(phi2) - isometricLatitude(phi1));
  } else {
    // Due east/west: travel along the parallel of origin
    const sinPhi = Math.sin(phi1);
    const nu = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinPhi * sinPhi); // prime vertical radius
    deltaLambda = (distanceM * Math.sign(Math.sin(theta))) / (nu * Math.cos(phi1));
  }

  return {
    lat: phi2 / DEG,
    lon: normalizeLon(origin.lon + deltaLambda / DEG),
  };
}
