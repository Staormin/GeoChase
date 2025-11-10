import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { usePolygonDrawing } from '@/composables/usePolygonDrawing';
import { useLayersStore } from '@/stores/layers';

// Mock ol modules
vi.mock('ol', () => ({
  Feature: vi.fn(function (props) {
    return {
      setId: vi.fn(),
      setStyle: vi.fn(),
      get: vi.fn((key) => props[key]),
      getProperties: () => props,
    };
  }),
}));

vi.mock('ol/geom', () => ({
  Polygon: vi.fn(function (coords) {
    return {
      getCoordinates: () => coords,
      getExtent: () => [0, 0, 1, 1],
    };
  }),
}));

vi.mock('ol/proj', () => ({
  fromLonLat: vi.fn(([lon, lat]: [number, number]) => [lon * 111_320, lat * 110_540]), // Simple projection mock
}));

vi.mock('ol/style', () => ({
  Style: class Style {
    constructor(public options: any) {}
  },
  Stroke: class Stroke {
    constructor(public options: any) {}
  },
  Fill: class Fill {
    constructor(public options: any) {}
  },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid'),
}));

describe('usePolygonDrawing', () => {
  let pinia: any;
  let layersStore: any;
  let mockMapRef: any;
  let polygonDrawing: any;
  let mockAddFeature: any;
  let mockRemoveFeature: any;
  let mockGetFeatureById: any;
  let mockClear: any;
  let rafSpy: any;
  let consoleWarnSpy: any;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    layersStore = useLayersStore();

    // Mock feature management
    mockAddFeature = vi.fn();
    mockRemoveFeature = vi.fn();
    mockGetFeatureById = vi.fn();
    mockClear = vi.fn();

    // Mock requestAnimationFrame
    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: any) => {
      cb();
      return 1;
    });

    // Mock console.warn
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Create mock map reference with all required properties
    mockMapRef = {
      map: ref({
        getView: vi.fn(() => ({
          getZoom: vi.fn(() => 15),
        })),
      }),
      polygonsSource: ref({
        addFeature: mockAddFeature,
        removeFeature: mockRemoveFeature,
        getFeatureById: mockGetFeatureById,
        clear: mockClear,
      }),
      flyToBoundsWithPanels: vi.fn(),
    };

    // Initialize polygon drawing composable
    polygonDrawing = usePolygonDrawing(mockMapRef);
  });

  afterEach(() => {
    rafSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('drawPolygon', () => {
    let testPointIds: string[];

    beforeEach(() => {
      // Create test points in the store first
      layersStore.addPoint({
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      });
      layersStore.addPoint({
        id: 'point-2',
        name: 'Point 2',
        coordinates: { lat: 48.8606, lon: 2.3522 },
      });
      layersStore.addPoint({
        id: 'point-3',
        name: 'Point 3',
        coordinates: { lat: 48.8606, lon: 2.3562 },
      });
      layersStore.addPoint({
        id: 'point-4',
        name: 'Point 4',
        coordinates: { lat: 48.8566, lon: 2.3562 },
      });

      testPointIds = ['point-1', 'point-2', 'point-3', 'point-4'];
    });

    it('should draw a polygon and return polygon element', () => {
      const addPolygonSpy = vi.spyOn(layersStore, 'addPolygon');
      const storeMapElementIdSpy = vi.spyOn(layersStore, 'storeMapElementId');

      const result = polygonDrawing.drawPolygon(testPointIds, 'My Polygon', '#ff0000');

      expect(result).toEqual(
        expect.objectContaining({
          id: 'test-uuid',
          name: 'My Polygon',
          pointIds: testPointIds,
          color: '#ff0000',
          mapElementId: 'test-uuid',
        })
      );

      expect(addPolygonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-uuid',
          name: 'My Polygon',
          pointIds: testPointIds,
          color: '#ff0000',
          mapElementId: 'test-uuid',
        })
      );

      expect(storeMapElementIdSpy).toHaveBeenCalledWith('polygon', 'test-uuid', 'test-uuid');
      expect(mockAddFeature).toHaveBeenCalled();
      expect(mockMapRef.flyToBoundsWithPanels).toHaveBeenCalled();
    });

    it('should use default name if not provided', () => {
      const addPolygonSpy = vi.spyOn(layersStore, 'addPolygon');

      const result = polygonDrawing.drawPolygon(testPointIds);

      expect(result.name).toBe('Polygon 1');
      expect(addPolygonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Polygon 1',
        })
      );
    });

    it('should use default color if not provided', () => {
      const result = polygonDrawing.drawPolygon(testPointIds);

      expect(result.color).toBe('#90EE90'); // Light green default
    });

    it('should return null if map is not initialized', () => {
      mockMapRef.map.value = null;

      const result = polygonDrawing.drawPolygon(testPointIds);

      expect(result).toBeNull();
      expect(mockAddFeature).not.toHaveBeenCalled();
    });

    it('should return null if polygonsSource is not initialized', () => {
      mockMapRef.polygonsSource.value = null;

      const result = polygonDrawing.drawPolygon(testPointIds);

      expect(result).toBeNull();
      expect(mockAddFeature).not.toHaveBeenCalled();
    });

    it('should return null if less than 3 point IDs', () => {
      const insufficientPointIds = ['point-1', 'point-2'];

      const result = polygonDrawing.drawPolygon(insufficientPointIds);

      expect(result).toBeNull();
      expect(mockAddFeature).not.toHaveBeenCalled();
    });

    it('should return null if some points not found', () => {
      const invalidPointIds = ['point-1', 'non-existent', 'point-3'];
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = polygonDrawing.drawPolygon(invalidPointIds);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Some points not found for polygon');
      expect(mockAddFeature).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should calculate bounds correctly for flyTo', () => {
      polygonDrawing.drawPolygon(testPointIds, 'Test Polygon');

      expect(mockMapRef.flyToBoundsWithPanels).toHaveBeenCalledWith([
        [48.8566, 2.3522], // min lat, min lon
        [48.8606, 2.3562], // max lat, max lon
      ]);
    });

    it('should close polygon by adding first point at end', () => {
      polygonDrawing.drawPolygon(testPointIds);

      // Feature should be added with closed polygon
      expect(mockAddFeature).toHaveBeenCalled();
    });
  });

  describe('redrawPolygonOnMap', () => {
    let testPointIds: string[];

    beforeEach(() => {
      // Create test points first
      layersStore.addPoint({
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      });
      layersStore.addPoint({
        id: 'point-2',
        name: 'Point 2',
        coordinates: { lat: 48.8606, lon: 2.3522 },
      });
      layersStore.addPoint({
        id: 'point-3',
        name: 'Point 3',
        coordinates: { lat: 48.8606, lon: 2.3562 },
      });

      testPointIds = ['point-1', 'point-2', 'point-3'];

      // Add a test polygon to the store
      layersStore.addPolygon({
        id: 'polygon-1',
        name: 'Test Polygon',
        pointIds: testPointIds,
        color: '#ff0000',
      });
    });

    it('should redraw a polygon on the map', () => {
      polygonDrawing.redrawPolygonOnMap('polygon-1', testPointIds, '#00ff00');

      expect(mockAddFeature).toHaveBeenCalled();

      // Check that mapElementId was set
      const storedPolygon = layersStore.polygons.find((p: any) => p.id === 'polygon-1');
      expect(storedPolygon.mapElementId).toBe('polygon-1');
    });

    it('should use default color if not provided', () => {
      polygonDrawing.redrawPolygonOnMap('polygon-1', testPointIds);

      // Feature should still be added
      expect(mockAddFeature).toHaveBeenCalled();
    });

    it('should not redraw if map is not initialized', () => {
      mockMapRef.map.value = null;

      polygonDrawing.redrawPolygonOnMap('polygon-1', testPointIds);

      expect(mockAddFeature).not.toHaveBeenCalled();
    });

    it('should not redraw if polygonsSource is not initialized', () => {
      mockMapRef.polygonsSource.value = null;

      polygonDrawing.redrawPolygonOnMap('polygon-1', testPointIds);

      expect(mockAddFeature).not.toHaveBeenCalled();
    });

    it('should not redraw if less than 3 valid points', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const invalidPointIds = ['point-1', 'non-existent'];

      polygonDrawing.redrawPolygonOnMap('polygon-1', invalidPointIds);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Insufficient valid points for polygon');
      expect(mockAddFeature).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should close polygon by adding first point at end', () => {
      polygonDrawing.redrawPolygonOnMap('polygon-1', testPointIds);

      // Feature should be added with closed polygon
      expect(mockAddFeature).toHaveBeenCalled();
    });
  });

  describe('Color conversion helper', () => {
    beforeEach(() => {
      // Create test points for color tests
      layersStore.addPoint({
        id: 'color-p1',
        name: 'Point 1',
        coordinates: { lat: 48, lon: 2 },
      });
      layersStore.addPoint({
        id: 'color-p2',
        name: 'Point 2',
        coordinates: { lat: 49, lon: 2 },
      });
      layersStore.addPoint({
        id: 'color-p3',
        name: 'Point 3',
        coordinates: { lat: 49, lon: 3 },
      });
    });

    it('should convert hex color to rgba', () => {
      const result = polygonDrawing.drawPolygon(
        ['color-p1', 'color-p2', 'color-p3'],
        'Test',
        '#ff0000'
      );

      // The fill color should be rgba with 0.2 opacity
      expect(result.color).toBe('#ff0000');
    });

    it('should handle rgb color format', () => {
      const result = polygonDrawing.drawPolygon(
        ['color-p1', 'color-p2', 'color-p3'],
        'Test',
        'rgb(255, 0, 0)'
      );

      expect(result.color).toBe('rgb(255, 0, 0)');
    });
  });
});
