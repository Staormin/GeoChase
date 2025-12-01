import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLineNameGeneration } from '@/composables/useLineNameGeneration';
import { useLayersStore } from '@/stores/layers';

// Mock the address service
vi.mock('@/services/address', () => ({
  getReverseGeocodeAddress: vi.fn().mockImplementation(async (lat: number, lon: number) => {
    // Return predictable addresses based on coordinates
    if (lat === 48.8566 && lon === 2.3522) {
      return { address: 'Paris, France' };
    }
    if (lat === 51.5074 && lon === -0.1278) {
      return { address: 'London, UK' };
    }
    if (lat === 40.7128 && lon === -74.006) {
      return { address: 'New York, USA' };
    }
    return { address: null };
  }),
}));

describe('useLineNameGeneration', () => {
  let pinia: any;
  let layersStore: any;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    layersStore = useLayersStore();
  });

  describe('generateFallbackName', () => {
    it('should generate fallback name based on line count', () => {
      const { generateFallbackName } = useLineNameGeneration();

      // Initial state - no lines
      expect(generateFallbackName()).toBe('Line 1');

      // Add some lines to the store
      layersStore.addLineSegment({
        id: '1',
        name: 'Test Line 1',
        startLat: 0,
        startLon: 0,
        endLat: 1,
        endLon: 1,
        color: '#000000',
        mode: 'coordinates',
        visible: true,
      });

      expect(generateFallbackName()).toBe('Line 2');

      // Add another line
      layersStore.addLineSegment({
        id: '2',
        name: 'Test Line 2',
        startLat: 1,
        startLon: 1,
        endLat: 2,
        endLon: 2,
        color: '#000000',
        mode: 'coordinates',
        visible: true,
      });

      expect(generateFallbackName()).toBe('Line 3');
    });
  });

  describe('generateParallelName', () => {
    it('should use point name when available', () => {
      const { generateParallelName } = useLineNameGeneration();

      // Add a point
      layersStore.addPoint({
        id: '1',
        name: 'Eiffel Tower',
        coordinates: { lat: 48.8584, lon: 2.2945 },
      });

      // Test with exact match (within tolerance)
      expect(generateParallelName(48.8584)).toBe('Parallel to Eiffel Tower');

      // Test with value within tolerance
      expect(generateParallelName(48.8585)).toBe('Parallel to Eiffel Tower');
    });

    it('should generate default name when no point matches', () => {
      const { generateParallelName } = useLineNameGeneration();

      expect(generateParallelName(45.123_456)).toBe('Parallel at 45.123456°');
      expect(generateParallelName(-23.654_321)).toBe('Parallel at -23.654321°');
    });
  });

  describe('getLocationName', () => {
    it('should return point name when available', async () => {
      const { getLocationName } = useLineNameGeneration();

      // Add a point
      layersStore.addPoint({
        id: '1',
        name: 'Arc de Triomphe',
        coordinates: { lat: 48.8738, lon: 2.295 },
      });

      const name = await getLocationName(48.8738, 2.295);
      expect(name).toBe('Arc de Triomphe');
    });

    it('should use reverse geocoding when no point matches', async () => {
      const { getLocationName } = useLineNameGeneration();

      // Test with Paris coordinates
      const name = await getLocationName(48.8566, 2.3522);
      expect(name).toBe('Paris, France');
    });

    it('should fall back to coordinates when reverse geocoding returns null', async () => {
      const { getLocationName } = useLineNameGeneration();

      // Test with coordinates that return null from mock
      const name = await getLocationName(12.3456, 78.9012);
      expect(name).toBe('12.3456, 78.9012');
    });
  });

  describe('generateTwoPointsName', () => {
    it('should use both point names when available', async () => {
      const { generateTwoPointsName } = useLineNameGeneration();

      // Add points
      layersStore.addPoint({
        id: '1',
        name: 'Point A',
        coordinates: { lat: 48.8584, lon: 2.2945 },
      });
      layersStore.addPoint({
        id: '2',
        name: 'Point B',
        coordinates: { lat: 48.8738, lon: 2.295 },
      });

      const name = await generateTwoPointsName(48.8584, 2.2945, 48.8738, 2.295);
      expect(name).toBe('Point A => Point B');
    });

    it('should mix point and geocoded names when only one is a point', async () => {
      const { generateTwoPointsName } = useLineNameGeneration();

      // Add one point
      layersStore.addPoint({
        id: '1',
        name: 'Start Point',
        coordinates: { lat: 48.8584, lon: 2.2945 },
      });

      // Start is point, end will be geocoded
      const name1 = await generateTwoPointsName(48.8584, 2.2945, 48.8566, 2.3522);
      expect(name1).toBe('Start Point => Paris, France');

      // Start will be geocoded, end is point
      layersStore.addPoint({
        id: '2',
        name: 'End Point',
        coordinates: { lat: 51.5074, lon: -0.1278 },
      });

      const name2 = await generateTwoPointsName(48.8566, 2.3522, 51.5074, -0.1278);
      expect(name2).toBe('Paris, France => End Point');
    });

    it('should use geocoding for both points when no points match', async () => {
      const { generateTwoPointsName } = useLineNameGeneration();

      const name = await generateTwoPointsName(48.8566, 2.3522, 51.5074, -0.1278);
      expect(name).toBe('Paris, France => London, UK');
    });

    it('should fall back to coordinates when geocoding fails', async () => {
      const { generateTwoPointsName } = useLineNameGeneration();

      const name = await generateTwoPointsName(12.3456, 78.9012, 23.4567, 89.0123);
      expect(name).toBe('12.3456, 78.9012 => 23.4567, 89.0123');
    });

    it('should use coordinate fallback for end when start is a point and end geocode fails', async () => {
      const { generateTwoPointsName } = useLineNameGeneration();

      // Add point for start point only
      layersStore.addPoint({
        id: '1',
        name: 'My Start',
        coordinates: { lat: 48.8584, lon: 2.2945 },
      });

      // Start is point, end coordinates don't match any mock address
      const name = await generateTwoPointsName(48.8584, 2.2945, 12.3456, 78.9012);
      expect(name).toBe('My Start => 12.3456, 78.9012');
    });

    it('should use coordinate fallback for start when end is a point and start geocode fails', async () => {
      const { generateTwoPointsName } = useLineNameGeneration();

      // Add point for end point only
      layersStore.addPoint({
        id: '1',
        name: 'My End',
        coordinates: { lat: 51.5074, lon: -0.1278 },
      });

      // End is point, start coordinates don't match any mock address
      const name = await generateTwoPointsName(12.3456, 78.9012, 51.5074, -0.1278);
      expect(name).toBe('12.3456, 78.9012 => My End');
    });
  });

  describe('generateAzimuthName', () => {
    it('should use point name when available', async () => {
      const { generateAzimuthName } = useLineNameGeneration();

      layersStore.addPoint({
        id: '1',
        name: 'Observation Point',
        coordinates: { lat: 48.8584, lon: 2.2945 },
      });

      const name = await generateAzimuthName(48.8584, 2.2945, 45);
      expect(name).toBe('From Observation Point at 45°');
    });

    it('should use geocoded address when no point matches', async () => {
      const { generateAzimuthName } = useLineNameGeneration();

      const name = await generateAzimuthName(48.8566, 2.3522, 90);
      expect(name).toBe('From Paris, France at 90°');
    });

    it('should fall back to coordinates when geocoding fails', async () => {
      const { generateAzimuthName } = useLineNameGeneration();

      const name = await generateAzimuthName(12.3456, 78.9012, 180);
      expect(name).toBe('From 12.3456, 78.9012 at 180°');
    });
  });

  describe('generateIntersectionName', () => {
    it('should use point names when available', async () => {
      const { generateIntersectionName } = useLineNameGeneration();

      layersStore.addPoint({
        id: '1',
        name: 'Start Point',
        coordinates: { lat: 48.8584, lon: 2.2945 },
      });
      layersStore.addPoint({
        id: '2',
        name: 'Intersection Point',
        coordinates: { lat: 48.8738, lon: 2.295 },
      });

      const name = await generateIntersectionName(48.8584, 2.2945, 48.8738, 2.295);
      expect(name).toBe('From Start Point via Intersection Point');
    });

    it('should mix point and geocoded names', async () => {
      const { generateIntersectionName } = useLineNameGeneration();

      layersStore.addPoint({
        id: '1',
        name: 'Origin',
        coordinates: { lat: 48.8584, lon: 2.2945 },
      });

      const name = await generateIntersectionName(48.8584, 2.2945, 51.5074, -0.1278);
      expect(name).toBe('From Origin via London, UK');
    });

    it('should use geocoding for both points when no points match', async () => {
      const { generateIntersectionName } = useLineNameGeneration();

      const name = await generateIntersectionName(48.8566, 2.3522, 40.7128, -74.006);
      expect(name).toBe('From Paris, France via New York, USA');
    });

    it('should fall back to coordinates when geocoding fails', async () => {
      const { generateIntersectionName } = useLineNameGeneration();

      const name = await generateIntersectionName(12.3456, 78.9012, 23.4567, 89.0123);
      expect(name).toBe('From 12.3456, 78.9012 via 23.4567, 89.0123');
    });
  });
});
