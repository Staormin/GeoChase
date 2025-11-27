import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSearchZoneLayer, removeSearchZoneLayer } from '@/services/searchZone';

// Mock turf
vi.mock('@turf/turf', () => ({
  point: vi.fn((coords) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: coords },
  })),
  lineString: vi.fn((coords) => ({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
  })),
  buffer: vi.fn(() => ({
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
      ],
    },
  })),
}));

// Track which geometry type to return
let mockGeometryType = 'Polygon';

// Mock ol/format/GeoJSON
vi.mock('ol/format/GeoJSON', () => ({
  default: class MockGeoJSON {
    readFeatures() {
      return [
        {
          setStyle: vi.fn(),
          getGeometry: () => ({
            getType: () => mockGeometryType,
          }),
        },
      ];
    }
  },
}));

// Mock ol/layer/Vector
vi.mock('ol/layer/Vector', () => ({
  default: class MockVectorLayer {
    constructor() {
      return { getSource: vi.fn() };
    }
  },
}));

// Mock ol/source/Vector
vi.mock('ol/source/Vector', () => ({
  default: class MockVectorSource {
    addFeatures = vi.fn();
  },
}));

// Mock ol/style
vi.mock('ol/style', () => ({
  Style: class MockStyle {},
  Stroke: class MockStroke {},
  Fill: class MockFill {},
  Circle: class MockCircle {},
}));

describe('searchZone service', () => {
  let mockMapContainer: any;
  let mockMap: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGeometryType = 'Polygon'; // Reset to default

    mockMap = {
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
    };

    mockMapContainer = {
      map: { value: mockMap },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createSearchZoneLayer', () => {
    it('should return layer object', () => {
      const pathPoints = [{ lat: 48.8566, lon: 2.3522 }];

      const result = createSearchZoneLayer(mockMapContainer, pathPoints, 1);

      expect(result).toBeDefined();
    });

    it('should return layer without adding to map when map is not initialized', () => {
      // Set map to null to trigger the !mapInstance branch at line 38
      mockMapContainer.map = null;
      const pathPoints = [{ lat: 48.8566, lon: 2.3522 }];

      const result = createSearchZoneLayer(mockMapContainer, pathPoints, 1);

      expect(mockMap.addLayer).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return layer without adding when pathPoints is empty', () => {
      const result = createSearchZoneLayer(mockMapContainer, [], 1);

      expect(mockMap.addLayer).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return layer without adding when pathPoints is null/undefined', () => {
      const result = createSearchZoneLayer(mockMapContainer, null as any, 1);

      expect(mockMap.addLayer).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should handle single point path', async () => {
      const pathPoints = [{ lat: 48.8566, lon: 2.3522 }];

      createSearchZoneLayer(mockMapContainer, pathPoints, 1);

      const turf = await import('@turf/turf');
      expect(turf.point).toHaveBeenCalledWith([2.3522, 48.8566]);
    });

    it('should handle multiple point path', async () => {
      const pathPoints = [
        { lat: 48.8566, lon: 2.3522 },
        { lat: 49, lon: 2.5 },
      ];

      createSearchZoneLayer(mockMapContainer, pathPoints, 1);

      const turf = await import('@turf/turf');
      expect(turf.lineString).toHaveBeenCalledWith([
        [2.3522, 48.8566],
        [2.5, 49],
      ]);
    });

    it('should add layer to map on success', () => {
      const pathPoints = [{ lat: 48.8566, lon: 2.3522 }];

      createSearchZoneLayer(mockMapContainer, pathPoints, 1);

      expect(mockMap.addLayer).toHaveBeenCalled();
    });

    it('should handle map access via direct property', () => {
      const directMapContainer = {
        map: mockMap,
      };
      const pathPoints = [{ lat: 48.8566, lon: 2.3522 }];

      createSearchZoneLayer(directMapContainer, pathPoints, 1);

      expect(mockMap.addLayer).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const turf = await import('@turf/turf');
      vi.mocked(turf.buffer).mockImplementationOnce(() => {
        throw new Error('Buffer error');
      });

      const pathPoints = [{ lat: 48.8566, lon: 2.3522 }];

      const result = createSearchZoneLayer(mockMapContainer, pathPoints, 1);

      expect(result).toBeDefined();
    });

    it('should handle null buffer result', async () => {
      const turf = await import('@turf/turf');
      vi.mocked(turf.buffer).mockReturnValueOnce(null as any);

      const pathPoints = [{ lat: 48.8566, lon: 2.3522 }];

      const result = createSearchZoneLayer(mockMapContainer, pathPoints, 1);

      expect(result).toBeDefined();
    });

    it('should style Point features differently from line features', async () => {
      // Set geometry type to Point to test the Point styling branch
      mockGeometryType = 'Point';
      const pathPoints = [{ lat: 48.8566, lon: 2.3522 }];

      const result = createSearchZoneLayer(mockMapContainer, pathPoints, 1);

      expect(result).toBeDefined();
      expect(mockMap.addLayer).toHaveBeenCalled();
    });

    it('should style LineString features with stroke only', async () => {
      // Set geometry type to LineString to test the else branch
      mockGeometryType = 'LineString';
      const pathPoints = [
        { lat: 48.8566, lon: 2.3522 },
        { lat: 49, lon: 2.5 },
      ];

      const result = createSearchZoneLayer(mockMapContainer, pathPoints, 1);

      expect(result).toBeDefined();
      expect(mockMap.addLayer).toHaveBeenCalled();
    });
  });

  describe('removeSearchZoneLayer', () => {
    it('should remove layer from map', () => {
      const mockLayer = { id: 'test-layer' } as any;

      removeSearchZoneLayer(mockMapContainer, mockLayer);

      expect(mockMap.removeLayer).toHaveBeenCalledWith(mockLayer);
    });

    it('should not throw when map is not initialized', () => {
      // Set map to null to trigger the !mapInstance branch at line 158
      mockMapContainer.map = null;
      const mockLayer = { id: 'test-layer' } as any;

      expect(() => removeSearchZoneLayer(mockMapContainer, mockLayer)).not.toThrow();
    });

    it('should handle errors silently', () => {
      mockMap.removeLayer.mockImplementationOnce(() => {
        throw new Error('Remove error');
      });
      const mockLayer = { id: 'test-layer' } as any;

      expect(() => removeSearchZoneLayer(mockMapContainer, mockLayer)).not.toThrow();
    });

    it('should handle direct map access', () => {
      const directMapContainer = {
        map: mockMap,
      };
      const mockLayer = { id: 'test-layer' } as any;

      removeSearchZoneLayer(directMapContainer, mockLayer);

      expect(mockMap.removeLayer).toHaveBeenCalledWith(mockLayer);
    });
  });
});
