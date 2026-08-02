import { describe, expect, it } from 'vitest';
import {
  densifyGeodesic,
  densifyGeodesicFromBearing,
  geodesicDestination,
  geodesicDistance,
  geodesicIntermediate,
  geodesicInverse,
  normalizeLon,
  rhumbDestination,
} from '@/services/geodesy';

const PARIS = { lat: 48.8566, lon: 2.3522 };
const NEW_YORK = { lat: 40.7128, lon: -74.006 };
const TOKYO = { lat: 35.6762, lon: 139.7745 };
const SAN_FRANCISCO = { lat: 37.7749, lon: -122.4194 };

// Published reference for the direct/inverse problem (Geoscience Australia,
// "Flinders Peak to Buninyong" Vincenty example). The published values use
// GRS80, which differs from WGS84 by ~1e-11 in flattening — far below the
// 1 m tolerance asserted here.
const FLINDERS_PEAK = { lat: -(37 + 57 / 60 + 3.7203 / 3600), lon: 144 + 25 / 60 + 29.5244 / 3600 };
const BUNINYONG = { lat: -(37 + 39 / 60 + 10.1561 / 3600), lon: 143 + 55 / 60 + 35.3839 / 3600 };
const FLINDERS_TO_BUNINYONG_AZI1 = 306 + 52 / 60 + 5.37 / 3600; // degrees
const FLINDERS_TO_BUNINYONG_S = 54_972.271; // meters

// Meters per degree of latitude, approximately
const M_PER_DEG_LAT = 111_320;

describe('geodesy service', () => {
  describe('geodesicDestination (direct problem)', () => {
    it('matches the published Vincenty reference within 1 m', () => {
      const dest = geodesicDestination(
        FLINDERS_PEAK,
        FLINDERS_TO_BUNINYONG_AZI1,
        FLINDERS_TO_BUNINYONG_S
      );

      const errorM = geodesicDistance(dest, BUNINYONG);
      expect(errorM).toBeLessThan(1);
    });

    it('travels due north along a meridian', () => {
      const dest = geodesicDestination({ lat: 0, lon: 10 }, 0, 110_574); // ~1° of latitude at the equator
      expect(dest.lon).toBeCloseTo(10, 6);
      expect(dest.lat).toBeCloseTo(1, 2);
    });
  });

  describe('geodesicInverse / geodesicDistance', () => {
    it('matches the published Vincenty reference within 1 m and 0.001°', () => {
      const r = geodesicInverse(FLINDERS_PEAK, BUNINYONG);
      expect(Math.abs(r.distance - FLINDERS_TO_BUNINYONG_S)).toBeLessThan(1);
      expect(Math.abs(r.initialBearing - FLINDERS_TO_BUNINYONG_AZI1)).toBeLessThan(0.001);
    });

    it('is symmetric', () => {
      expect(geodesicDistance(PARIS, NEW_YORK)).toBeCloseTo(geodesicDistance(NEW_YORK, PARIS), 6);
    });

    it('converges for nearly antipodal points (Vincenty failure case)', () => {
      const a = { lat: 0, lon: 0 };
      const b = { lat: 0.5, lon: 179.7 };
      const d = geodesicDistance(a, b);
      expect(Number.isFinite(d)).toBe(true);
      // Roughly half the Earth's circumference
      expect(d).toBeGreaterThan(19_000_000);
      expect(d).toBeLessThan(20_100_000);
    });
  });

  describe('Paris → New York: geodesic vs straight line', () => {
    it('the geodesic passes clearly north of the straight (rhumb-like) path', () => {
      const geodesicMid = geodesicIntermediate(PARIS, NEW_YORK, 0.5);
      // A straight segment in Web Mercator (a rhumb line) never leaves the
      // latitude band of its endpoints, so the linear midpoint latitude is an
      // upper bound for the straight path at mid-course.
      const straightMidLat = (PARIS.lat + NEW_YORK.lat) / 2;

      const latDifferenceKm = ((geodesicMid.lat - straightMidLat) * M_PER_DEG_LAT) / 1000;
      expect(latDifferenceKm).toBeGreaterThan(200);
    });

    it('densified path length converges to the geodesic distance', () => {
      const path = densifyGeodesic(PARIS, NEW_YORK);
      let sum = 0;
      for (let i = 1; i < path.length; i++) {
        sum += geodesicDistance(path[i - 1]!, path[i]!);
      }
      expect(Math.abs(sum - geodesicDistance(PARIS, NEW_YORK))).toBeLessThan(1);
    });
  });

  describe('short lines', () => {
    it('geodesic and straight interpolation agree within a few centimeters under 1 km', () => {
      const a = { lat: 48.8566, lon: 2.3522 };
      const b = { lat: 48.8606, lon: 2.3376 }; // Louvre, ~1.2 km away
      const geodesicMid = geodesicIntermediate(a, b, 0.5);
      const linearMid = { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 };
      expect(geodesicDistance(geodesicMid, linearMid)).toBeLessThan(0.05);
    });

    it('short lines stay cheap: minimum vertex count is 2', () => {
      const a = { lat: 48.8566, lon: 2.3522 };
      const b = { lat: 48.8567, lon: 2.3523 };
      expect(densifyGeodesic(a, b)).toHaveLength(2);
    });

    it('vertex count is clamped to 512 for very long lines', () => {
      const path = densifyGeodesic({ lat: 0, lon: 0 }, { lat: 0.5, lon: 179 });
      expect(path.length).toBeLessThanOrEqual(512);
      expect(path.length).toBeGreaterThan(2);
    });

    it('uses ~1 vertex per 10 km', () => {
      const path = densifyGeodesic(PARIS, { lat: 48.8566, lon: 3.7 }); // ~99 km due east
      expect(path.length).toBeGreaterThanOrEqual(10);
      expect(path.length).toBeLessThanOrEqual(12);
    });
  });

  describe('antimeridian handling', () => {
    it('Tokyo → San Francisco produces monotonic unwrapped longitudes with no jump > 180°', () => {
      const path = densifyGeodesic(TOKYO, SAN_FRANCISCO);
      expect(path.length).toBeGreaterThan(2);
      expect(path[0]!.lon).toBeCloseTo(TOKYO.lon, 6);
      // Unwrapped: the final longitude is -122.42 + 360
      expect(path.at(-1)!.lon).toBeCloseTo(SAN_FRANCISCO.lon + 360, 6);

      for (let i = 1; i < path.length; i++) {
        const delta = path[i]!.lon - path[i - 1]!.lon;
        // Eastward and monotonic
        expect(delta).toBeGreaterThan(0);
        expect(delta).toBeLessThan(180);
      }
    });

    it('normalizeLon maps unwrapped longitudes back to (-180, 180]', () => {
      expect(normalizeLon(237.58)).toBeCloseTo(-122.42, 10);
      expect(normalizeLon(-190)).toBeCloseTo(170, 10);
      expect(normalizeLon(180)).toBe(180);
      expect(normalizeLon(2.35)).toBeCloseTo(2.35, 10);
    });
  });

  describe('densifyGeodesicFromBearing', () => {
    it('ends at the same point as geodesicDestination', () => {
      const path = densifyGeodesicFromBearing(PARIS, 291.8, 5_852_935);
      const dest = geodesicDestination(PARIS, 291.8, 5_852_935);
      const last = path.at(-1)!;
      expect(geodesicDistance({ lat: last.lat, lon: normalizeLon(last.lon) }, dest)).toBeLessThan(
        0.001
      );
    });
  });

  describe('rhumbDestination (loxodrome, WGS84 ellipsoid)', () => {
    /**
     * Independent reference: numerically integrate the rhumb-line ODEs
     *   dφ/ds = cos θ / M(φ)      dλ/ds = sin θ / (N(φ) cos φ)
     * with RK4. This shares no code with the implementation under test.
     */
    function rhumbReference(
      origin: { lat: number; lon: number },
      bearingDeg: number,
      distanceM: number
    ): { lat: number; lon: number } {
      const A = 6_378_137;
      const F = 1 / 298.257_223_563;
      const E2 = F * (2 - F);
      const theta = (bearingDeg * Math.PI) / 180;
      const derivatives = (phi: number): [number, number] => {
        const s = Math.sin(phi);
        const w2 = 1 - E2 * s * s;
        const M = (A * (1 - E2)) / Math.pow(w2, 1.5);
        const N = A / Math.sqrt(w2);
        return [Math.cos(theta) / M, Math.sin(theta) / (N * Math.cos(phi))];
      };

      let phi = (origin.lat * Math.PI) / 180;
      let lambda = (origin.lon * Math.PI) / 180;
      const steps = 5000;
      const h = distanceM / steps;
      for (let i = 0; i < steps; i++) {
        const [k1p, k1l] = derivatives(phi);
        const [k2p, k2l] = derivatives(phi + (h / 2) * k1p);
        const [k3p, k3l] = derivatives(phi + (h / 2) * k2p);
        const [k4p, k4l] = derivatives(phi + h * k3p);
        phi += (h / 6) * (k1p + 2 * k2p + 2 * k3p + k4p);
        lambda += (h / 6) * (k1l + 2 * k2l + 2 * k3l + k4l);
      }
      return { lat: (phi * 180) / Math.PI, lon: (lambda * 180) / Math.PI };
    }

    it.each([
      ['mid-latitude NE run', { lat: 40.6397, lon: -73.7789 }, 51, 3_000_000],
      ['southern hemisphere SW run', { lat: -33.8688, lon: 151.2093 }, 240, 1_500_000],
      ['high latitude', { lat: 60, lon: 5 }, 80, 800_000],
    ])('matches an independent RK4 integration: %s', (_name, origin, bearing, distance) => {
      const dest = rhumbDestination(origin, bearing, distance);
      const reference = rhumbReference(origin, bearing, distance);
      expect(geodesicDistance(dest, reference)).toBeLessThan(1);
    });

    it('due east stays on the parallel', () => {
      const dest = rhumbDestination({ lat: 45, lon: 0 }, 90, 500_000);
      expect(dest.lat).toBeCloseTo(45, 7);
      expect(dest.lon).toBeGreaterThan(0);
    });

    it('due north follows the meridian', () => {
      const dest = rhumbDestination({ lat: 10, lon: 20 }, 0, 1_000_000);
      expect(dest.lon).toBeCloseTo(20, 9);
      expect(dest.lat).toBeGreaterThan(10);
    });

    it('diverges from the geodesic over long distances', () => {
      const origin = { lat: 48.8566, lon: 2.3522 };
      const rhumb = rhumbDestination(origin, 270, 5_000_000);
      const geodesic = geodesicDestination(origin, 270, 5_000_000);
      // At mid latitudes over 5000 km the two endpoints are hundreds of km apart
      expect(geodesicDistance(rhumb, geodesic)).toBeGreaterThan(200_000);
    });
  });

  describe('geodesicIntermediate', () => {
    it('returns the endpoints at fractions 0 and 1', () => {
      const start = geodesicIntermediate(PARIS, NEW_YORK, 0);
      const end = geodesicIntermediate(PARIS, NEW_YORK, 1);
      expect(geodesicDistance(start, PARIS)).toBeLessThan(0.001);
      expect(geodesicDistance(end, NEW_YORK)).toBeLessThan(0.001);
    });

    it('fraction 0.5 is equidistant from both endpoints', () => {
      const mid = geodesicIntermediate(PARIS, NEW_YORK, 0.5);
      expect(geodesicDistance(mid, PARIS)).toBeCloseTo(geodesicDistance(mid, NEW_YORK), 3);
    });
  });
});
