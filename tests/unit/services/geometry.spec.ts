import { fromLonLat } from 'ol/proj';
import { getDistance as olGetDistance } from 'ol/sphere';
import { describe, expect, it } from 'vitest';
import {
  calculateBearing,
  calculateInverseBearing,
  destinationPoint,
  endpointFromIntersection,
  generateCircle,
  generateLinePointsLinear,
  toDegrees,
  toRadians,
} from '@/services/geometry';

describe('geometry service', () => {
  describe('toRadians', () => {
    it('should convert 0 degrees to 0 radians', () => {
      expect(toRadians(0)).toBe(0);
    });

    it('should convert 90 degrees to PI/2 radians', () => {
      expect(toRadians(90)).toBeCloseTo(Math.PI / 2, 10);
    });

    it('should convert 180 degrees to PI radians', () => {
      expect(toRadians(180)).toBeCloseTo(Math.PI, 10);
    });

    it('should convert 360 degrees to 2*PI radians', () => {
      expect(toRadians(360)).toBeCloseTo(2 * Math.PI, 10);
    });

    it('should convert negative degrees', () => {
      expect(toRadians(-90)).toBeCloseTo(-Math.PI / 2, 10);
    });
  });

  describe('toDegrees', () => {
    it('should convert 0 radians to 0 degrees', () => {
      expect(toDegrees(0)).toBe(0);
    });

    it('should convert PI/2 radians to 90 degrees', () => {
      expect(toDegrees(Math.PI / 2)).toBeCloseTo(90, 10);
    });

    it('should convert PI radians to 180 degrees', () => {
      expect(toDegrees(Math.PI)).toBeCloseTo(180, 10);
    });

    it('should convert 2*PI radians to 360 degrees', () => {
      expect(toDegrees(2 * Math.PI)).toBeCloseTo(360, 10);
    });

    it('should convert negative radians', () => {
      expect(toDegrees(-Math.PI / 2)).toBeCloseTo(-90, 10);
    });
  });

  describe('destinationPoint', () => {
    it('should return same point for 0 distance', () => {
      const result = destinationPoint(48.8566, 2.3522, 0, 0);

      expect(result.lat).toBeCloseTo(48.8566, 6);
      expect(result.lon).toBeCloseTo(2.3522, 6);
    });

    it('should calculate point 1km north', () => {
      const result = destinationPoint(48.8566, 2.3522, 1, 0);

      // 1km north should increase latitude by ~0.009 degrees
      expect(result.lat).toBeGreaterThan(48.8566);
      expect(result.lat).toBeCloseTo(48.8656, 2);
      expect(result.lon).toBeCloseTo(2.3522, 4);
    });

    it('should calculate point 1km east', () => {
      const result = destinationPoint(48.8566, 2.3522, 1, 90);

      expect(result.lat).toBeCloseTo(48.8566, 2);
      expect(result.lon).toBeGreaterThan(2.3522);
    });

    it('should calculate point 1km south', () => {
      const result = destinationPoint(48.8566, 2.3522, 1, 180);

      expect(result.lat).toBeLessThan(48.8566);
      expect(result.lon).toBeCloseTo(2.3522, 4);
    });

    it('should calculate point 1km west', () => {
      const result = destinationPoint(48.8566, 2.3522, 1, 270);

      expect(result.lat).toBeCloseTo(48.8566, 2);
      expect(result.lon).toBeLessThan(2.3522);
    });

    it('should handle large distances', () => {
      const result = destinationPoint(48.8566, 2.3522, 1000, 45);

      // Should be northeast of Paris
      expect(result.lat).toBeGreaterThan(48.8566);
      expect(result.lon).toBeGreaterThan(2.3522);
    });
  });

  describe('calculateBearing', () => {
    it('should return 0 for due north', () => {
      const bearing = calculateBearing(48.8566, 2.3522, 49.8566, 2.3522);
      expect(bearing).toBeCloseTo(0, 0);
    });

    it('should return ~90 for due east', () => {
      const bearing = calculateBearing(48.8566, 2.3522, 48.8566, 3.3522);
      expect(bearing).toBeCloseTo(90, 0);
    });

    it('should return 180 for due south', () => {
      const bearing = calculateBearing(48.8566, 2.3522, 47.8566, 2.3522);
      expect(bearing).toBeCloseTo(180, 0);
    });

    it('should return ~270 for due west', () => {
      const bearing = calculateBearing(48.8566, 2.3522, 48.8566, 1.3522);
      expect(bearing).toBeCloseTo(270, 0);
    });

    it('should return ~45 for northeast', () => {
      const bearing = calculateBearing(48.8566, 2.3522, 49.8566, 3.8522);
      expect(bearing).toBeGreaterThan(30);
      expect(bearing).toBeLessThan(60);
    });

    it('should return value between 0 and 360', () => {
      const bearing = calculateBearing(0, 0, -10, -10);
      expect(bearing).toBeGreaterThanOrEqual(0);
      expect(bearing).toBeLessThan(360);
    });
  });

  describe('calculateInverseBearing', () => {
    it('should return reverse bearing', () => {
      const forward = calculateBearing(48.8566, 2.3522, 49.8566, 3.3522);
      const inverse = calculateInverseBearing(48.8566, 2.3522, 49.8566, 3.3522);

      // Inverse should be ~180 degrees different from forward
      const diff = Math.abs(forward - inverse);
      expect(Math.min(diff, 360 - diff)).toBeCloseTo(180, -1);
    });

    it('should return ~180 when forward is ~0', () => {
      const inverse = calculateInverseBearing(48.8566, 2.3522, 49.8566, 2.3522);
      expect(inverse).toBeCloseTo(180, 0);
    });
  });

  describe('endpointFromIntersection', () => {
    const start = { lat: 43.208829, lon: 2.35458 };
    const intersection = { lat: 46.69318, lon: -1.926687 };

    it('stops exactly at the intersection for a zero extension', () => {
      expect(
        endpointFromIntersection(start.lat, start.lon, intersection.lat, intersection.lon, 0)
      ).toEqual(intersection);
    });

    it.each([0.1, 5, 500])(
      'extends %s km past the intersection, independent of the approach distance',
      (distance) => {
        const endpoint = endpointFromIntersection(
          start.lat,
          start.lon,
          intersection.lat,
          intersection.lon,
          distance
        );
        const extension =
          olGetDistance([intersection.lon, intersection.lat], [endpoint.lon, endpoint.lat]) / 1000;
        expect(extension).toBeCloseTo(distance, 5);

        const a = fromLonLat([start.lon, start.lat]);
        const b = fromLonLat([intersection.lon, intersection.lat]);
        const c = fromLonLat([endpoint.lon, endpoint.lat]);
        const approach = [b[0]! - a[0]!, b[1]! - a[1]!];
        const beyond = [c[0]! - b[0]!, c[1]! - b[1]!];
        // The extension must continue forwards on the same straight map line.
        const cosine =
          (approach[0]! * beyond[0]! + approach[1]! * beyond[1]!) /
          (Math.hypot(...approach) * Math.hypot(...beyond));
        expect(cosine).toBeCloseTo(1, 10);
      }
    );

    it.each([
      [48, 2, 49, 2],
      [49, 2, 48, 2],
      [48, 2, 48, 3],
      [48, 3, 48, 2],
      [-20, -40, -21, -41],
    ])(
      'supports different directions from (%s, %s) through (%s, %s)',
      (lat, lon, throughLat, throughLon) => {
        const endpoint = endpointFromIntersection(lat, lon, throughLat, throughLon, 25);
        expect(
          olGetDistance([throughLon, throughLat], [endpoint.lon, endpoint.lat]) / 1000
        ).toBeCloseTo(25, 5);
      }
    );

    it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
      'rejects invalid extension %s',
      (distance) => {
        expect(() =>
          endpointFromIntersection(
            start.lat,
            start.lon,
            intersection.lat,
            intersection.lon,
            distance
          )
        ).toThrow(RangeError);
      }
    );

    it('rejects coincident points that cannot define a direction', () => {
      expect(() => endpointFromIntersection(48, 2, 48, 2, 5)).toThrow(RangeError);
    });

    it('rejects an unreachable extension instead of returning an incorrect distance', () => {
      expect(() =>
        endpointFromIntersection(start.lat, start.lon, intersection.lat, intersection.lon, 30_000)
      ).toThrow(RangeError);
    });
  });

  describe('generateLinePointsLinear', () => {
    it('should generate correct number of points', () => {
      const points = generateLinePointsLinear(48.8566, 2.3522, 49.8566, 3.3522, 10);

      // Should have numPoints + 1 points (including start and end)
      expect(points).toHaveLength(11);
    });

    it('should start at the start point', () => {
      const points = generateLinePointsLinear(48.8566, 2.3522, 49.8566, 3.3522, 10);

      expect(points[0]?.lat).toBeCloseTo(48.8566, 2);
      expect(points[0]?.lon).toBeCloseTo(2.3522, 2);
    });

    it('should return valid LatLon objects for all points', () => {
      const points = generateLinePointsLinear(48.8566, 2.3522, 49.8566, 3.3522, 10);

      // All points should be valid LatLon objects
      for (const point of points) {
        expect(typeof point.lat).toBe('number');
        expect(typeof point.lon).toBe('number');
        expect(Number.isNaN(point.lat)).toBe(false);
        expect(Number.isNaN(point.lon)).toBe(false);
      }
    });

    it('should generate intermediate points with different coordinates', () => {
      const points = generateLinePointsLinear(48.8566, 2.3522, 49.8566, 3.3522, 2);

      // Should have 3 points
      expect(points).toHaveLength(3);
      // Middle point should have valid coordinates
      expect(points[1]?.lat).toBeDefined();
      expect(points[1]?.lon).toBeDefined();
      expect(typeof points[1]?.lat).toBe('number');
      expect(typeof points[1]?.lon).toBe('number');
    });

    it('should handle single point (numPoints = 0)', () => {
      const points = generateLinePointsLinear(48.8566, 2.3522, 49.8566, 3.3522, 0);

      // Division by zero would give NaN, but the loop should handle it
      expect(points).toHaveLength(1);
    });
  });

  describe('generateCircle', () => {
    it('should generate correct number of points', () => {
      const points = generateCircle(48.8566, 2.3522, 1, 36);

      // Should have numPoints + 1 (closing the circle)
      expect(points).toHaveLength(37);
    });

    it('should close the circle (first and last points should be same)', () => {
      const points = generateCircle(48.8566, 2.3522, 1, 36);

      expect(points[0]?.lat).toBeCloseTo(points[36]?.lat || 0, 10);
      expect(points[0]?.lon).toBeCloseTo(points[36]?.lon || 0, 10);
    });

    it('should generate points at approximately correct distance from center', () => {
      const centerLat = 48.8566;
      const centerLon = 2.3522;
      const radiusKm = 1;
      const points = generateCircle(centerLat, centerLon, radiusKm, 4);

      // Check first point (north)
      const latDiff = Math.abs(points[0]!.lat - centerLat);
      // 1km should be about 0.009 degrees latitude
      expect(latDiff).toBeCloseTo(0.009, 2);
    });

    it('should use default 360 points', () => {
      const points = generateCircle(48.8566, 2.3522, 1);

      expect(points).toHaveLength(361);
    });

    it('should handle zero radius', () => {
      const points = generateCircle(48.8566, 2.3522, 0, 4);

      // All points should be at center
      for (const point of points) {
        expect(point.lat).toBeCloseTo(48.8566, 4);
        expect(point.lon).toBeCloseTo(2.3522, 4);
      }
    });

    it('should handle zero numPoints (empty circle)', () => {
      const points = generateCircle(48.8566, 2.3522, 1, 0);

      // With 0 points, the loop doesn't run, so no closing point is added
      expect(points).toHaveLength(0);
    });
  });
});
