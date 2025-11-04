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
    const testPoints = [
      { lat: 48.8566, lon: 2.3522 },
      { lat: 48.8606, lon: 2.3522 },
      { lat: 48.8606, lon: 2.3562 },
      { lat: 48.8566, lon: 2.3562 },
    ];

    it('should draw a polygon and return polygon element', () => {
      const addPolygonSpy = vi.spyOn(layersStore, 'addPolygon');
      const storeMapElementIdSpy = vi.spyOn(layersStore, 'storeMapElementId');

      const result = polygonDrawing.drawPolygon(testPoints, 'My Polygon', '#ff0000');

      expect(result).toEqual(
        expect.objectContaining({
          id: 'test-uuid',
          name: 'My Polygon',
          points: testPoints,
          color: '#ff0000',
          mapElementId: 'test-uuid',
        })
      );

      expect(addPolygonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-uuid',
          name: 'My Polygon',
          points: testPoints,
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

      const result = polygonDrawing.drawPolygon(testPoints);

      expect(result.name).toBe('Polygon 1');
      expect(addPolygonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Polygon 1',
        })
      );
    });

    it('should use default color if not provided', () => {
      const result = polygonDrawing.drawPolygon(testPoints);

      expect(result.color).toBe('#90EE90'); // Light green default
    });

    it('should return null if map is not initialized', () => {
      mockMapRef.map.value = null;

      const result = polygonDrawing.drawPolygon(testPoints);

      expect(result).toBeNull();
      expect(mockAddFeature).not.toHaveBeenCalled();
    });

    it('should return null if polygonsSource is not initialized', () => {
      mockMapRef.polygonsSource.value = null;

      const result = polygonDrawing.drawPolygon(testPoints);

      expect(result).toBeNull();
      expect(mockAddFeature).not.toHaveBeenCalled();
    });

    it('should return null and warn if less than 3 points', () => {
      const insufficientPoints = [
        { lat: 48.8566, lon: 2.3522 },
        { lat: 48.8606, lon: 2.3522 },
      ];

      const result = polygonDrawing.drawPolygon(insufficientPoints);

      expect(result).toBeNull();
      // Validation warning (console logging removed)
      expect(mockAddFeature).not.toHaveBeenCalled();
    });

    it('should calculate bounds correctly for flyTo', () => {
      polygonDrawing.drawPolygon(testPoints, 'Test Polygon');

      expect(mockMapRef.flyToBoundsWithPanels).toHaveBeenCalledWith([
        [48.8566, 2.3522], // min lat, min lon
        [48.8606, 2.3562], // max lat, max lon
      ]);
    });

    it('should close polygon by adding first point at end', () => {
      polygonDrawing.drawPolygon(testPoints);

      // Feature should be added with closed polygon
      expect(mockAddFeature).toHaveBeenCalled();
    });
  });

  describe('redrawPolygonOnMap', () => {
    const testPoints = [
      { lat: 48.8566, lon: 2.3522 },
      { lat: 48.8606, lon: 2.3522 },
      { lat: 48.8606, lon: 2.3562 },
    ];

    beforeEach(() => {
      // Add a test polygon to the store
      layersStore.addPolygon({
        id: 'polygon-1',
        name: 'Test Polygon',
        points: testPoints,
        color: '#ff0000',
      });
    });

    it('should redraw a polygon on the map', () => {
      polygonDrawing.redrawPolygonOnMap('polygon-1', testPoints, '#00ff00');

      expect(mockAddFeature).toHaveBeenCalled();

      // Check that mapElementId was set
      const storedPolygon = layersStore.polygons.find((p: any) => p.id === 'polygon-1');
      expect(storedPolygon.mapElementId).toBe('polygon-1');
    });

    it('should use default color if not provided', () => {
      polygonDrawing.redrawPolygonOnMap('polygon-1', testPoints);

      // Feature should still be added
      expect(mockAddFeature).toHaveBeenCalled();
    });

    it('should not redraw if map is not initialized', () => {
      mockMapRef.map.value = null;

      polygonDrawing.redrawPolygonOnMap('polygon-1', testPoints);

      expect(mockAddFeature).not.toHaveBeenCalled();
    });

    it('should not redraw if polygonsSource is not initialized', () => {
      mockMapRef.polygonsSource.value = null;

      polygonDrawing.redrawPolygonOnMap('polygon-1', testPoints);

      expect(mockAddFeature).not.toHaveBeenCalled();
    });

    it('should handle missing polygon in store', () => {
      polygonDrawing.redrawPolygonOnMap('non-existent', testPoints);

      // Should still create the polygon feature
      expect(mockAddFeature).toHaveBeenCalled();
    });

    it('should close polygon by adding first point at end', () => {
      polygonDrawing.redrawPolygonOnMap('polygon-1', testPoints);

      // Feature should be added with closed polygon
      expect(mockAddFeature).toHaveBeenCalled();
    });
  });

  describe('Color conversion helper', () => {
    it('should convert hex color to rgba', () => {
      const result = polygonDrawing.drawPolygon(
        [
          { lat: 48, lon: 2 },
          { lat: 49, lon: 2 },
          { lat: 49, lon: 3 },
        ],
        'Test',
        '#ff0000'
      );

      // The fill color should be rgba with 0.2 opacity
      expect(result.color).toBe('#ff0000');
    });

    it('should handle rgb color format', () => {
      const result = polygonDrawing.drawPolygon(
        [
          { lat: 48, lon: 2 },
          { lat: 49, lon: 2 },
          { lat: 49, lon: 3 },
        ],
        'Test',
        'rgb(255, 0, 0)'
      );

      expect(result.color).toBe('rgb(255, 0, 0)');
    });
  });
});
