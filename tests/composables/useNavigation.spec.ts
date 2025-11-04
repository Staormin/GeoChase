import type { CircleElement, LineSegmentElement } from '@/services/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNavigation } from '@/composables/useNavigation';

// Mock the geometry service
vi.mock('@/services/geometry', () => ({
  destinationPoint: vi.fn((lat, lon) => ({
    lat: lat + 1,
    lon: lon + 1,
  })),
  toRadians: vi.fn((degrees) => (degrees * Math.PI) / 180),
}));

// Mock ol/sphere
vi.mock('ol/sphere', () => ({
  getDistance: vi.fn(() => 10_000), // Always return 10km
}));

describe('useNavigation', () => {
  let navigation: ReturnType<typeof useNavigation>;

  beforeEach(() => {
    navigation = useNavigation();
  });

  describe('Initial State', () => {
    it('should initialize with inactive state', () => {
      expect(navigation.navigationState.value).toEqual({
        active: false,
        elementType: null,
        elementId: null,
        progress: 0,
        anglePosition: 0,
      });
      expect(navigation.isNavigationActive.value).toBe(false);
    });
  });

  describe('Navigation Movement Calculation', () => {
    it('should calculate movement based on zoom level', () => {
      // Test various zoom levels
      // Formula: Math.pow(2, 11 - zoomLevel) * 5 * 10
      expect(navigation.getNavigationMovement(5)).toBe(3200); // 2^6 * 50 = 64 * 50 = 3200
      expect(navigation.getNavigationMovement(10)).toBe(100); // 2^1 * 50 = 2 * 50 = 100
      expect(navigation.getNavigationMovement(15)).toBe(3.125); // 2^-4 * 50 = 0.0625 * 50 = 3.125
      expect(navigation.getNavigationMovement(18)).toBe(0.390_625); // 2^-7 * 50 = 0.0078125 * 50 = 0.390625
      expect(navigation.getNavigationMovement(20)).toBe(0.097_656_25); // 2^-9 * 50 = 0.001953125 * 50 = 0.09765625
    });

    it('should have minimum movement of 0.01km', () => {
      expect(navigation.getNavigationMovement(30)).toBe(0.01); // Very high zoom should hit minimum
    });
  });

  describe('Circle Navigation', () => {
    const mockCircle: CircleElement = {
      id: 'circle-1',
      name: 'Test Circle',
      center: { lat: 48.8566, lon: 2.3522 },
      centerLat: 48.8566,
      centerLon: 2.3522,
      radius: 10, // 10km radius
      color: '#ff0000',
      visible: true,
    };

    it('should start circle navigation', () => {
      navigation.startNavigation('circle', 'circle-1', mockCircle);

      expect(navigation.navigationState.value).toEqual({
        active: true,
        elementType: 'circle',
        elementId: 'circle-1',
        progress: 0,
        anglePosition: 0,
      });
      expect(navigation.isNavigationActive.value).toBe(true);
    });

    it('should navigate forward on circle', () => {
      navigation.startNavigation('circle', 'circle-1', mockCircle);
      const initialAngle = navigation.navigationState.value.anglePosition;

      navigation.navigateCircleForward(mockCircle, 15);

      expect(navigation.navigationState.value.anglePosition).toBeGreaterThan(initialAngle);
    });

    it('should navigate backward on circle', () => {
      navigation.startNavigation('circle', 'circle-1', mockCircle);
      navigation.navigationState.value.anglePosition = 45; // Start at 45 degrees

      navigation.navigateCircleBackward(mockCircle, 15);

      expect(navigation.navigationState.value.anglePosition).toBeLessThan(45);
    });

    it('should wrap angle position around 360 degrees', () => {
      navigation.startNavigation('circle', 'circle-1', mockCircle);
      navigation.navigationState.value.anglePosition = 350;

      // Navigate forward past 360
      navigation.navigateCircleForward(mockCircle, 10);

      expect(navigation.navigationState.value.anglePosition).toBeLessThan(360);
    });

    it('should calculate circle navigation coordinates', () => {
      navigation.startNavigation('circle', 'circle-1', mockCircle);
      navigation.navigationState.value.anglePosition = 90; // East

      const coords = navigation.getCircleNavigationCoords(mockCircle);

      expect(coords).toHaveProperty('lat');
      expect(coords).toHaveProperty('lon');
      expect(coords.lon).toBeGreaterThan(mockCircle.center.lon); // Should be east of center
    });
  });

  describe('Line Segment Navigation', () => {
    const mockSegment: LineSegmentElement = {
      id: 'line-1',
      name: 'Test Line',
      center: { lat: 48.8566, lon: 2.3522 },
      startLat: 48.8566,
      startLon: 2.3522,
      endpoint: { lat: 49.8566, lon: 3.3522 },
      endLat: 49.8566,
      endLon: 3.3522,
      color: '#0000ff',
      mode: 'coordinates',
      visible: true,
    };

    it('should start segment navigation', () => {
      navigation.startNavigation('lineSegment', 'line-1', undefined, mockSegment);

      expect(navigation.navigationState.value).toEqual({
        active: true,
        elementType: 'lineSegment',
        elementId: 'line-1',
        progress: 0,
        anglePosition: 0,
      });
    });

    it('should navigate forward on segment', () => {
      navigation.startNavigation('lineSegment', 'line-1', undefined, mockSegment);

      navigation.navigateSegmentForward(mockSegment, 15);

      expect(navigation.navigationState.value.progress).toBeGreaterThan(0);
      expect(navigation.navigationState.value.progress).toBeLessThanOrEqual(1);
    });

    it('should navigate backward on segment', () => {
      navigation.startNavigation('lineSegment', 'line-1', undefined, mockSegment);
      navigation.navigationState.value.progress = 0.5; // Start at midpoint

      navigation.navigateSegmentBackward(mockSegment, 15);

      expect(navigation.navigationState.value.progress).toBeLessThan(0.5);
      expect(navigation.navigationState.value.progress).toBeGreaterThanOrEqual(0);
    });

    it('should bounce at segment endpoints', () => {
      navigation.startNavigation('lineSegment', 'line-1', undefined, mockSegment);
      navigation.navigationState.value.progress = 0.95;

      // Navigate forward past end (should bounce back)
      navigation.navigateSegmentForward(mockSegment, 10);

      expect(navigation.navigationState.value.progress).toBeLessThanOrEqual(1);
    });

    it('should calculate segment navigation coordinates', () => {
      navigation.startNavigation('lineSegment', 'line-1', undefined, mockSegment);
      navigation.navigationState.value.progress = 0.5; // Midpoint

      const coords = navigation.getSegmentNavigationCoords(mockSegment);

      expect(coords.lat).toBeCloseTo((mockSegment.center.lat + mockSegment.endpoint!.lat) / 2, 5);
      expect(coords.lon).toBeCloseTo((mockSegment.center.lon + mockSegment.endpoint!.lon) / 2, 5);
    });

    it('should handle azimuth mode segments', () => {
      const azimuthSegment: LineSegmentElement = {
        id: 'line-2',
        name: 'Azimuth Line',
        center: { lat: 48.8566, lon: 2.3522 },
        startLat: 48.8566,
        startLon: 2.3522,
        mode: 'azimuth',
        azimuth: 45,
        distance: 100,
        color: '#00ff00',
        visible: true,
      };

      navigation.startNavigation('lineSegment', 'line-2', undefined, azimuthSegment);
      const coords = navigation.getSegmentNavigationCoords(azimuthSegment);

      expect(coords).toHaveProperty('lat');
      expect(coords).toHaveProperty('lon');
    });

    it('should handle segments without endpoints', () => {
      const noEndpointSegment: LineSegmentElement = {
        id: 'line-3',
        name: 'No Endpoint Line',
        center: { lat: 48.8566, lon: 2.3522 },
        startLat: 48.8566,
        startLon: 2.3522,
        color: '#ffff00',
        mode: 'coordinates',
        visible: true,
      };

      navigation.startNavigation('lineSegment', 'line-3', undefined, noEndpointSegment);
      const coords = navigation.getSegmentNavigationCoords(noEndpointSegment);

      // Should return center coordinates when no endpoint
      expect(coords.lat).toBe(noEndpointSegment.center.lat);
      expect(coords.lon).toBe(noEndpointSegment.center.lon);
    });
  });

  describe('Exit Navigation', () => {
    it('should reset all state when exiting navigation', () => {
      const mockCircle: CircleElement = {
        id: 'circle-1',
        name: 'Test Circle',
        center: { lat: 48.8566, lon: 2.3522 },
        centerLat: 48.8566,
        centerLon: 2.3522,
        radius: 10,
        color: '#ff0000',
        visible: true,
      };

      // Start navigation
      navigation.startNavigation('circle', 'circle-1', mockCircle);
      navigation.navigationState.value.anglePosition = 45;

      // Exit navigation
      navigation.exitNavigation();

      expect(navigation.navigationState.value).toEqual({
        active: false,
        elementType: null,
        elementId: null,
        progress: 0,
        anglePosition: 0,
      });
      expect(navigation.isNavigationActive.value).toBe(false);
    });
  });

  describe('Progress Boundaries', () => {
    const mockSegment: LineSegmentElement = {
      id: 'line-1',
      name: 'Test Line',
      center: { lat: 48.8566, lon: 2.3522 },
      startLat: 48.8566,
      startLon: 2.3522,
      endpoint: { lat: 49.8566, lon: 3.3522 },
      endLat: 49.8566,
      endLon: 3.3522,
      color: '#0000ff',
      mode: 'coordinates',
      visible: true,
    };

    it('should handle negative progress by reflecting', () => {
      navigation.startNavigation('lineSegment', 'line-1', undefined, mockSegment);
      navigation.navigationState.value.progress = 0.1;

      // Navigate backward past 0
      navigation.navigateSegmentBackward(mockSegment, 5);

      // Progress should be reflected (made positive)
      expect(navigation.navigationState.value.progress).toBeGreaterThanOrEqual(0);
    });

    it('should handle progress > 1 by reflecting', () => {
      navigation.startNavigation('lineSegment', 'line-1', undefined, mockSegment);
      navigation.navigationState.value.progress = 0.9;

      // Navigate forward past 1
      navigation.navigateSegmentForward(mockSegment, 5);

      // Progress should be reflected back
      expect(navigation.navigationState.value.progress).toBeLessThanOrEqual(1);
    });
  });
});
