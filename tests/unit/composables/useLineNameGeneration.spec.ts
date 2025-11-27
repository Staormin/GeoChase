import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLineNameGeneration } from '@/composables/useLineNameGeneration';
import { useCoordinatesStore } from '@/stores/coordinates';
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
  let coordinatesStore: any;
  let layersStore: any;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    coordinatesStore = useCoordinatesStore();
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
    it('should use saved coordinate name when available', () => {
      const { generateParallelName } = useLineNameGeneration();

      // Add a saved coordinate
      coordinatesStore.addCoordinate('Eiffel Tower', 48.8584, 2.2945, '1');

      // Test with exact match (within tolerance)
      expect(generateParallelName(48.8584)).toBe('Parallel to Eiffel Tower');

      // Test with value within tolerance
      expect(generateParallelName(48.858_45)).toBe('Parallel to Eiffel Tower');
    });

    it('should generate default name when no saved coordinate matches', () => {
      const { generateParallelName } = useLineNameGeneration();

      expect(generateParallelName(45.123_456)).toBe('Parallel at 45.123456°');
      expect(generateParallelName(-23.654_321)).toBe('Parallel at -23.654321°');
    });
  });

  describe('getLocationName', () => {
    it('should return saved coordinate name when available', async () => {
      const { getLocationName } = useLineNameGeneration();

      // Add a saved coordinate
      coordinatesStore.addCoordinate('Arc de Triomphe', 48.8738, 2.295, '1');

      const name = await getLocationName(48.8738, 2.295);
      expect(name).toBe('Arc de Triomphe');
    });

    it('should use reverse geocoding when no saved coordinate', async () => {
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
    it('should use both saved coordinate names when available', async () => {
      const { generateTwoPointsName } = useLineNameGeneration();

      // Add saved coordinates
      coordinatesStore.addCoordinate('Point A', 48.8584, 2.2945, '1');
      coordinatesStore.addCoordinate('Point B', 48.8738, 2.295, '2');

      const name = await generateTwoPointsName(48.8584, 2.2945, 48.8738, 2.295);
      expect(name).toBe('Point A => Point B');
    });

    it('should mix saved and geocoded names when only one is saved', async () => {
      const { generateTwoPointsName } = useLineNameGeneration();

      // Add one saved coordinate
      coordinatesStore.addCoordinate('Start Point', 48.8584, 2.2945, '1');

      // Start is saved, end will be geocoded
      const name1 = await generateTwoPointsName(48.8584, 2.2945, 48.8566, 2.3522);
      expect(name1).toBe('Start Point => Paris, France');

      // Start will be geocoded, end is saved
      coordinatesStore.addCoordinate('End Point', 51.5074, -0.1278, '2');

      const name2 = await generateTwoPointsName(48.8566, 2.3522, 51.5074, -0.1278);
      expect(name2).toBe('Paris, France => End Point');
    });

    it('should use geocoding for both points when no saved coordinates', async () => {
      const { generateTwoPointsName } = useLineNameGeneration();

      const name = await generateTwoPointsName(48.8566, 2.3522, 51.5074, -0.1278);
      expect(name).toBe('Paris, France => London, UK');
    });

    it('should fall back to coordinates when geocoding fails', async () => {
      const { generateTwoPointsName } = useLineNameGeneration();

      const name = await generateTwoPointsName(12.3456, 78.9012, 23.4567, 89.0123);
      expect(name).toBe('12.3456, 78.9012 => 23.4567, 89.0123');
    });

    it('should use coordinate fallback for end when start is saved and end geocode fails', async () => {
      const { generateTwoPointsName } = useLineNameGeneration();

      // Add saved coordinate for start point only
      coordinatesStore.addCoordinate('My Start', 48.8584, 2.2945, '1');

      // Start is saved, end coordinates don't match any mock address
      const name = await generateTwoPointsName(48.8584, 2.2945, 12.3456, 78.9012);
      expect(name).toBe('My Start => 12.3456, 78.9012');
    });

    it('should use coordinate fallback for start when end is saved and start geocode fails', async () => {
      const { generateTwoPointsName } = useLineNameGeneration();

      // Add saved coordinate for end point only
      coordinatesStore.addCoordinate('My End', 51.5074, -0.1278, '1');

      // End is saved, start coordinates don't match any mock address
      const name = await generateTwoPointsName(12.3456, 78.9012, 51.5074, -0.1278);
      expect(name).toBe('12.3456, 78.9012 => My End');
    });
  });

  describe('generateAzimuthName', () => {
    it('should use saved coordinate name when available', async () => {
      const { generateAzimuthName } = useLineNameGeneration();

      coordinatesStore.addCoordinate('Observation Point', 48.8584, 2.2945, '1');

      const name = await generateAzimuthName(48.8584, 2.2945, 45);
      expect(name).toBe('From Observation Point at 45°');
    });

    it('should use geocoded address when no saved coordinate', async () => {
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
    it('should use saved coordinate names when available', async () => {
      const { generateIntersectionName } = useLineNameGeneration();

      coordinatesStore.addCoordinate('Start Point', 48.8584, 2.2945, '1');
      coordinatesStore.addCoordinate('Intersection Point', 48.8738, 2.295, '2');

      const name = await generateIntersectionName(48.8584, 2.2945, 48.8738, 2.295);
      expect(name).toBe('From Start Point via Intersection Point');
    });

    it('should mix saved and geocoded names', async () => {
      const { generateIntersectionName } = useLineNameGeneration();

      coordinatesStore.addCoordinate('Origin', 48.8584, 2.2945, '1');

      const name = await generateIntersectionName(48.8584, 2.2945, 51.5074, -0.1278);
      expect(name).toBe('From Origin via London, UK');
    });

    it('should use geocoding for both points when no saved coordinates', async () => {
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
