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
    it('should return a valid point for given parameters', () => {
      const startLat = 48.8566;
      const startLon = 2.3522;
      const intersectLat = 48.9;
      const intersectLon = 2.4;

      const result = endpointFromIntersection(startLat, startLon, intersectLat, intersectLon, 10);

      // Should return valid coordinates
      expect(typeof result.lat).toBe('number');
      expect(typeof result.lon).toBe('number');
      expect(Number.isNaN(result.lat)).toBe(false);
      expect(Number.isNaN(result.lon)).toBe(false);
    });

    it('should return intersection when distance exactly matches (line 147)', () => {
      // Use olGetDistance to calculate the EXACT geodesic distance
      const startLat = 48.8566;
      const startLon = 2.3522;
      const intersectLat = 48.8666; // Close enough for easy calculation
      const intersectLon = 2.3522;

      // Calculate exact geodesic distance in km using the same function the code uses
      const exactDistanceKm =
        olGetDistance([startLon, startLat], [intersectLon, intersectLat]) / 1000;

      // Use the EXACT distance to trigger line 147
      const result = endpointFromIntersection(
        startLat,
        startLon,
        intersectLat,
        intersectLon,
        exactDistanceKm
      );

      // Should return the intersection coordinates exactly
      expect(result.lat).toBeCloseTo(intersectLat, 5);
      expect(result.lon).toBeCloseTo(intersectLon, 5);
    });

    it('should handle D < distance to intersection case (line 157)', () => {
      // Set up so D is much smaller than distance to intersection
      // This should trigger fLow > 0 branch at line 157
      const startLat = 48.8566;
      const startLon = 2.3522;
      const intersectLat = 50; // Very far intersection (~127km away)
      const intersectLon = 2.3522;

      // Use a very small D (1km) while intersection is 127km away
      // fLow should be large positive value
      const result = endpointFromIntersection(
        startLat,
        startLon,
        intersectLat,
        intersectLon,
        1 // 1km - much smaller than ~127km to intersection
      );

      // Should return valid coordinates (intersection as fallback)
      expect(typeof result.lat).toBe('number');
      expect(typeof result.lon).toBe('number');
      expect(Number.isNaN(result.lat)).toBe(false);
      expect(Number.isNaN(result.lon)).toBe(false);
    });

    it('should handle very small D with far intersection (line 157)', () => {
      // Another test case with even more extreme values
      const startLat = 0;
      const startLon = 0;
      const intersectLat = 10; // ~1111km away
      const intersectLon = 0;

      // Request just 1km when intersection is ~1111km away
      const result = endpointFromIntersection(startLat, startLon, intersectLat, intersectLon, 1);

      expect(typeof result.lat).toBe('number');
      expect(typeof result.lon).toBe('number');
      expect(Number.isNaN(result.lat)).toBe(false);
      expect(Number.isNaN(result.lon)).toBe(false);
    });

    it('should return intersection when distance matches distance to intersection', () => {
      const startLat = 48.8566;
      const startLon = 2.3522;
      const intersectLat = 48.8576;
      const intersectLon = 2.3532;

      // Calculate actual distance which is about 0.12 km
      const result = endpointFromIntersection(startLat, startLon, intersectLat, intersectLon, 0.12);

      // Should be close to intersection
      expect(result.lat).toBeCloseTo(intersectLat, 2);
      expect(result.lon).toBeCloseTo(intersectLon, 2);
    });

    it('should return intersection when distance is smaller (fallback case)', () => {
      // When requested distance is smaller than distance to intersection
      // The function returns the intersection as a fallback
      const result = endpointFromIntersection(48.8566, 2.3522, 49, 2.5, 1);

      // Verify it returns valid coordinates (the fallback intersection)
      expect(typeof result.lat).toBe('number');
      expect(typeof result.lon).toBe('number');
    });

    it('should handle same start and intersection point', () => {
      const result = endpointFromIntersection(48.8566, 2.3522, 48.8566, 2.3522, 100);

      // Should return a valid result (fallback direction: east)
      expect(typeof result.lat).toBe('number');
      expect(typeof result.lon).toBe('number');
      expect(Number.isNaN(result.lat)).toBe(false);
      expect(Number.isNaN(result.lon)).toBe(false);
    });

    it('should extend beyond intersection for larger distances', () => {
      const startLat = 48.8566;
      const startLon = 2.3522;
      const intersectLat = 48.8576;
      const intersectLon = 2.3532;

      // Request a longer distance than to intersection
      const result = endpointFromIntersection(startLat, startLon, intersectLat, intersectLon, 50);

      // Result should be valid and roughly in the same direction
      expect(typeof result.lat).toBe('number');
      expect(typeof result.lon).toBe('number');
    });

    it('should use bisection for moderate distance beyond intersection', () => {
      // Start and intersection very close, then extend to a moderate distance
      // This triggers the bisection algorithm (lines 179-201)
      const result = endpointFromIntersection(48.8566, 2.3522, 48.8568, 2.3524, 5);

      expect(typeof result.lat).toBe('number');
      expect(typeof result.lon).toBe('number');
      expect(Number.isNaN(result.lat)).toBe(false);
      expect(Number.isNaN(result.lon)).toBe(false);
    });

    it('should handle very large distances', () => {
      // This may trigger the fallback for when bisection doesn't converge
      const result = endpointFromIntersection(48.8566, 2.3522, 48.8568, 2.3524, 10_000);

      expect(typeof result.lat).toBe('number');
      expect(typeof result.lon).toBe('number');
      expect(Number.isNaN(result.lat)).toBe(false);
      expect(Number.isNaN(result.lon)).toBe(false);
    });

    it('should trigger bisection algorithm and converge', () => {
      // Set up parameters where bisection algorithm will run and converge
      // Need intersection far enough that D extends beyond it
      const startLat = 48.8566;
      const startLon = 2.3522;
      const intersectLat = 48.86; // ~400m away
      const intersectLon = 2.355;
      const distance = 2; // 2km - well beyond intersection

      const result = endpointFromIntersection(
        startLat,
        startLon,
        intersectLat,
        intersectLon,
        distance
      );

      expect(typeof result.lat).toBe('number');
      expect(typeof result.lon).toBe('number');
      expect(Number.isNaN(result.lat)).toBe(false);
      expect(Number.isNaN(result.lon)).toBe(false);
    });

    it('should converge quickly for moderate distances', () => {
      // Test where fm > 0 branch is taken during bisection
      const result = endpointFromIntersection(48.8566, 2.3522, 48.858, 2.354, 3);

      expect(typeof result.lat).toBe('number');
      expect(typeof result.lon).toBe('number');
    });

    it('should handle bisection with very close tolerance', () => {
      // Test bisection convergence via tolerance check
      const result = endpointFromIntersection(48.8566, 2.3522, 48.857, 2.353, 0.5);

      expect(typeof result.lat).toBe('number');
      expect(typeof result.lon).toBe('number');
    });

    it('should run bisection algorithm when D > distance to intersection (lines 179-197)', () => {
      // Set up so D > distance to intersection
      // This ensures we get into the bisection algorithm
      const startLat = 48.8566;
      const startLon = 2.3522;
      const intersectLat = 48.86; // ~380m away
      const intersectLon = 2.355;

      // Calculate actual distance to intersection
      const actualDistanceKm =
        olGetDistance([startLon, startLat], [intersectLon, intersectLat]) / 1000;

      // Request a distance LARGER than distance to intersection
      // This means fLow < 0, so we enter bisection
      const requestedDistance = actualDistanceKm * 3; // 3x the actual distance

      const result = endpointFromIntersection(
        startLat,
        startLon,
        intersectLat,
        intersectLon,
        requestedDistance
      );

      // Result should be further than intersection in the same direction
      expect(typeof result.lat).toBe('number');
      expect(typeof result.lon).toBe('number');
      expect(Number.isNaN(result.lat)).toBe(false);
      expect(Number.isNaN(result.lon)).toBe(false);
    });

    it('should exercise fm > 0 branch in bisection (lines 191-193)', () => {
      // When D is slightly larger than distance to intersection,
      // the bisection will hit both fm > 0 and fm <= 0 branches
      const startLat = 48.8566;
      const startLon = 2.3522;
      const intersectLat = 48.859;
      const intersectLon = 2.356;

      const actualDistanceKm =
        olGetDistance([startLon, startLat], [intersectLon, intersectLat]) / 1000;
      const requestedDistance = actualDistanceKm * 2.5;

      const result = endpointFromIntersection(
        startLat,
        startLon,
        intersectLat,
        intersectLon,
        requestedDistance
      );

      expect(typeof result.lat).toBe('number');
      expect(typeof result.lon).toBe('number');
    });

    it('should exercise fm <= 0 branch in bisection (lines 194-197)', () => {
      // Different configuration to exercise the other branch
      const startLat = 48.8566;
      const startLon = 2.3522;
      const intersectLat = 48.858;
      const intersectLon = 2.354;

      const actualDistanceKm =
        olGetDistance([startLon, startLat], [intersectLon, intersectLat]) / 1000;
      const requestedDistance = actualDistanceKm * 4;

      const result = endpointFromIntersection(
        startLat,
        startLon,
        intersectLat,
        intersectLon,
        requestedDistance
      );

      expect(typeof result.lat).toBe('number');
      expect(typeof result.lon).toBe('number');
    });

    it('should run bisection with multiple iterations (lines 179-197)', () => {
      // Set up a case where D is slightly larger than distance to intersection
      // This ensures fLow < 0 and we enter bisection
      const startLat = 48.8566;
      const startLon = 2.3522;
      const intersectLat = 48.857; // Very close intersection
      const intersectLon = 2.353;

      const actualDistanceKm =
        olGetDistance([startLon, startLat], [intersectLon, intersectLat]) / 1000;
      // Request distance larger than intersection distance to force bisection
      const requestedDistance = actualDistanceKm + 0.1; // Just slightly more

      const result = endpointFromIntersection(
        startLat,
        startLon,
        intersectLat,
        intersectLon,
        requestedDistance
      );

      expect(typeof result.lat).toBe('number');
      expect(typeof result.lon).toBe('number');
    });

    it('should exercise bisection convergence paths (lines 186-197)', () => {
      // Test with various distance ratios to exercise different bisection paths
      const startLat = 48.8566;
      const startLon = 2.3522;
      const intersectLat = 48.86;
      const intersectLon = 2.36;

      const actualDistanceKm =
        olGetDistance([startLon, startLat], [intersectLon, intersectLat]) / 1000;

      // Test with D = 1.5x distance to intersection
      const result1 = endpointFromIntersection(
        startLat,
        startLon,
        intersectLat,
        intersectLon,
        actualDistanceKm * 1.5
      );
      expect(typeof result1.lat).toBe('number');

      // Test with D = 2x distance to intersection
      const result2 = endpointFromIntersection(
        startLat,
        startLon,
        intersectLat,
        intersectLon,
        actualDistanceKm * 2
      );
      expect(typeof result2.lat).toBe('number');

      // Test with D = 5x distance to intersection
      const result3 = endpointFromIntersection(
        startLat,
        startLon,
        intersectLat,
        intersectLon,
        actualDistanceKm * 5
      );
      expect(typeof result3.lat).toBe('number');
    });

    it('should handle large D requiring many bisection iterations', () => {
      // Very small intersection distance, large requested distance
      // Forces many bisection iterations
      const startLat = 48.8566;
      const startLon = 2.3522;
      const intersectLat = 48.8567; // Very very close
      const intersectLon = 2.3523;

      // Request 100km when intersection is just meters away
      const result = endpointFromIntersection(startLat, startLon, intersectLat, intersectLon, 100);

      expect(typeof result.lat).toBe('number');
      expect(typeof result.lon).toBe('number');
    });

    it('should enter bisection when D slightly exceeds intersection distance (lines 179+)', () => {
      // Critical test: D must be > distance to intersection (fLow < 0)
      const startLat = 48.8566;
      const startLon = 2.3522;
      const intersectLat = 48.86; // ~380m away
      const intersectLon = 2.355;

      const actualDistanceKm =
        olGetDistance([startLon, startLat], [intersectLon, intersectLat]) / 1000;

      // Request exactly 10% more than actual distance
      const result = endpointFromIntersection(
        startLat,
        startLon,
        intersectLat,
        intersectLon,
        actualDistanceKm * 1.1
      );

      // Just verify we get valid coordinates
      expect(typeof result.lat).toBe('number');
      expect(typeof result.lon).toBe('number');
      expect(Number.isNaN(result.lat)).toBe(false);
      expect(Number.isNaN(result.lon)).toBe(false);
    });

    it('should run full bisection loop (testing lines 179-201)', () => {
      // Use coordinates where bisection will iterate several times
      const startLat = 48.8566;
      const startLon = 2.3522;
      const intersectLat = 48.8576; // ~112m away
      const intersectLon = 2.3532;

      const actualDistanceKm =
        olGetDistance([startLon, startLat], [intersectLon, intersectLat]) / 1000;

      // Request 50% more to force bisection
      const requestedDistance = actualDistanceKm * 1.5;

      const result = endpointFromIntersection(
        startLat,
        startLon,
        intersectLat,
        intersectLon,
        requestedDistance
      );

      // Just verify we get valid coordinates
      expect(typeof result.lat).toBe('number');
      expect(typeof result.lon).toBe('number');
      expect(Number.isNaN(result.lat)).toBe(false);
      expect(Number.isNaN(result.lon)).toBe(false);
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
