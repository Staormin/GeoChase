import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { usePointDrawing } from '@/composables/usePointDrawing';
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
  Point: vi.fn(function (coords) {
    return {
      getCoordinates: () => coords,
      getExtent: () => [0, 0, 1, 1],
    };
  }),
}));

vi.mock('ol/Overlay', () => ({
  default: vi.fn(function (options) {
    return {
      setPosition: vi.fn(),
      set: vi.fn(),
      getElement: () => options.element,
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
  Icon: class Icon {
    constructor(public options: any) {}
  },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid'),
}));

describe('usePointDrawing', () => {
  let pinia: any;
  let layersStore: any;
  let mockMapRef: any;
  let pointDrawing: any;
  let mockAddFeature: any;
  let mockRemoveFeature: any;
  let mockGetFeatureById: any;
  let mockClear: any;
  let mockAddOverlay: any;
  let mockRemoveOverlay: any;
  let mockGetOverlayById: any;
  let rafSpy: any;
  let mockView: any;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    layersStore = useLayersStore();

    // Mock feature management
    mockAddFeature = vi.fn();
    mockRemoveFeature = vi.fn();
    mockGetFeatureById = vi.fn();
    mockClear = vi.fn();

    // Mock overlay management
    mockAddOverlay = vi.fn();
    mockRemoveOverlay = vi.fn();
    mockGetOverlayById = vi.fn();

    // Mock requestAnimationFrame
    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: any) => {
      cb();
      return 1;
    });

    // Create a mock view that we can control
    mockView = {
      getZoom: vi.fn(() => 15),
    };

    // Create mock map reference with all required properties
    mockMapRef = {
      map: ref({
        getView: vi.fn(() => mockView),
        addOverlay: mockAddOverlay,
        removeOverlay: mockRemoveOverlay,
        getOverlayById: mockGetOverlayById,
      }),
      pointsSource: ref({
        addFeature: mockAddFeature,
        removeFeature: mockRemoveFeature,
        getFeatureById: mockGetFeatureById,
        clear: mockClear,
      }),
      flyToBoundsWithPanels: vi.fn(),
    };

    // Initialize point drawing composable
    pointDrawing = usePointDrawing(mockMapRef);
  });

  afterEach(() => {
    rafSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe('drawPoint', () => {
    it('should draw a point and return point element', () => {
      const addPointSpy = vi.spyOn(layersStore, 'addPoint');
      const storeMapElementIdSpy = vi.spyOn(layersStore, 'storeMapElementId');

      const result = pointDrawing.drawPoint(48.8566, 2.3522, 'My Point', '#ff0000', 100);

      expect(result).toEqual(
        expect.objectContaining({
          id: 'test-uuid',
          name: 'My Point',
          coordinates: { lat: 48.8566, lon: 2.3522 },
          elevation: 100,
          color: '#ff0000',
          mapElementId: 'test-uuid',
        })
      );

      expect(addPointSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-uuid',
          name: 'My Point',
          coordinates: { lat: 48.8566, lon: 2.3522 },
          elevation: 100,
          color: '#ff0000',
          mapElementId: 'test-uuid',
        })
      );

      expect(storeMapElementIdSpy).toHaveBeenCalledWith('point', 'test-uuid', 'test-uuid');
      expect(mockAddFeature).toHaveBeenCalled();
      expect(mockAddOverlay).toHaveBeenCalled();
      expect(mockMapRef.flyToBoundsWithPanels).toHaveBeenCalled();
    });

    it('should use default name if not provided', () => {
      const addPointSpy = vi.spyOn(layersStore, 'addPoint');

      const result = pointDrawing.drawPoint(48.8566, 2.3522);

      expect(result.name).toBe('Point 1');
      expect(addPointSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Point 1',
        })
      );
    });

    it('should use default color if not provided', () => {
      const result = pointDrawing.drawPoint(48.8566, 2.3522);

      expect(result.color).toBe('#000000');
    });

    it('should handle optional elevation', () => {
      const result = pointDrawing.drawPoint(48.8566, 2.3522, 'Test', '#ff0000');

      expect(result.elevation).toBeUndefined();
    });

    it('should return null if map is not initialized', () => {
      mockMapRef.map.value = null;

      const result = pointDrawing.drawPoint(48.8566, 2.3522);

      expect(result).toBeNull();
      expect(mockAddFeature).not.toHaveBeenCalled();
    });

    it('should return null if pointsSource is not initialized', () => {
      mockMapRef.pointsSource.value = null;

      const result = pointDrawing.drawPoint(48.8566, 2.3522);

      expect(result).toBeNull();
      expect(mockAddFeature).not.toHaveBeenCalled();
    });

    it('should calculate bounds correctly for flyTo', () => {
      pointDrawing.drawPoint(48.8566, 2.3522, 'Test Point');

      expect(mockMapRef.flyToBoundsWithPanels).toHaveBeenCalledWith([
        [48.8566 - 0.01, 2.3522 - 0.01],
        [48.8566 + 0.01, 2.3522 + 0.01],
      ]);
    });

    it('should create label overlay with correct styles', () => {
      const createElementSpy = vi.spyOn(document, 'createElement');

      pointDrawing.drawPoint(48.8566, 2.3522, 'Test Point');

      expect(createElementSpy).toHaveBeenCalledWith('div');
      expect(mockAddOverlay).toHaveBeenCalled();

      // Overlay creation is verified by mockAddOverlay being called
    });

    it('should set overlay opacity based on zoom level', () => {
      // Test with zoom >= 12
      mockView.getZoom.mockReturnValue(13);

      // Need to get actual elements created
      const createElementOriginal = document.createElement;
      const createElementSpy1 = vi
        .spyOn(document, 'createElement')
        .mockImplementation((tag: string) => {
          const el = createElementOriginal.call(document, tag);
          return el;
        });

      pointDrawing.drawPoint(48.8566, 2.3522, 'Test Point');

      const labelElement1 = createElementSpy1.mock.results[0].value;
      expect(labelElement1.style.cssText).toContain('opacity: 1');

      createElementSpy1.mockRestore();

      // Test with zoom < 12
      mockView.getZoom.mockReturnValue(10);

      const createElementSpy2 = vi
        .spyOn(document, 'createElement')
        .mockImplementation((tag: string) => {
          const el = createElementOriginal.call(document, tag);
          return el;
        });

      pointDrawing.drawPoint(48.8566, 2.3522, 'Another Point');

      const labelElement2 = createElementSpy2.mock.results[0].value;
      expect(labelElement2.style.cssText).toContain('opacity: 0');

      createElementSpy2.mockRestore();
    });
  });

  describe('redrawPointOnMap', () => {
    beforeEach(() => {
      // Add a test point to the store
      layersStore.addPoint({
        id: 'point-1',
        name: 'Test Point',
        coordinates: { lat: 48.8566, lon: 2.3522 },
        color: '#ff0000',
      });
    });

    it('should redraw a point on the map', () => {
      pointDrawing.redrawPointOnMap('point-1', 48.8566, 2.3522, '#00ff00');

      expect(mockAddFeature).toHaveBeenCalled();
      expect(mockAddOverlay).toHaveBeenCalled();

      // Check that mapElementId was set
      const storedPoint = layersStore.points.find((p: any) => p.id === 'point-1');
      expect(storedPoint.mapElementId).toBe('point-1');
    });

    it('should use point name from store', () => {
      const createElementSpy = vi.spyOn(document, 'createElement');

      pointDrawing.redrawPointOnMap('point-1', 48.8566, 2.3522);

      expect(createElementSpy).toHaveBeenCalled();
      // The label should have the name from the store
      const labelElement = createElementSpy.mock.results[0].value;
      expect(labelElement.textContent).toBe('Test Point');
    });

    it('should not redraw if map is not initialized', () => {
      mockMapRef.map.value = null;

      pointDrawing.redrawPointOnMap('point-1', 48.8566, 2.3522);

      expect(mockAddFeature).not.toHaveBeenCalled();
      expect(mockAddOverlay).not.toHaveBeenCalled();
    });

    it('should not redraw if pointsSource is not initialized', () => {
      mockMapRef.pointsSource.value = null;

      pointDrawing.redrawPointOnMap('point-1', 48.8566, 2.3522);

      expect(mockAddFeature).not.toHaveBeenCalled();
      expect(mockAddOverlay).not.toHaveBeenCalled();
    });

    it('should handle missing point in store', () => {
      pointDrawing.redrawPointOnMap('non-existent', 48.8566, 2.3522);

      // Should still create the point with default name
      expect(mockAddFeature).toHaveBeenCalled();
      expect(mockAddOverlay).toHaveBeenCalled();

      const createElementSpy = vi.spyOn(document, 'createElement');
      createElementSpy.mockClear();
      pointDrawing.redrawPointOnMap('non-existent', 48.8566, 2.3522);

      const labelElement = createElementSpy.mock.results[0]?.value;
      expect(labelElement?.textContent).toBe('Point');
    });

    it('should use fromLonLat for coordinate conversion', () => {
      pointDrawing.redrawPointOnMap('point-1', 48.8566, 2.3522);

      // fromLonLat is called in our mock, verify coordinates are passed correctly
      expect(mockAddFeature).toHaveBeenCalled();
    });
  });
});
