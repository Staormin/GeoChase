import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useCircleDrawing } from '@/composables/useCircleDrawing';
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
  LineString: vi.fn(function (coords) {
    return {
      getCoordinates: () => coords,
      getExtent: () => [0, 0, 1, 1],
    };
  }),
}));

vi.mock('ol/geom/Polygon', () => ({
  circular: vi.fn(() => ({
    transform: vi.fn(),
    getLinearRing: vi.fn(() => ({
      getCoordinates: () => Array.from({ length: 64 }).fill([0, 0]),
    })),
  })),
}));

vi.mock('ol/style', () => ({
  Style: vi.fn(function (options) {
    return options;
  }),
  Stroke: vi.fn(function (options) {
    return options;
  }),
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid'),
}));

describe('useCircleDrawing', () => {
  let pinia: any;
  let layersStore: any;
  let mockMapRef: any;
  let circleDrawing: any;
  let mockAddFeature: any;
  let mockRemoveFeature: any;
  let mockGetFeatureById: any;
  let mockClear: any;
  let rafSpy: any;

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

    // Create mock map reference with all required properties
    mockMapRef = {
      map: ref({
        getView: vi.fn(() => ({
          getZoom: vi.fn(() => 15),
        })),
      }),
      circlesSource: ref({
        addFeature: mockAddFeature,
        removeFeature: mockRemoveFeature,
        getFeatureById: mockGetFeatureById,
        clear: mockClear,
      }),
      flyToBoundsWithPanels: vi.fn(),
    };

    // Initialize circle drawing composable
    circleDrawing = useCircleDrawing(mockMapRef);
  });

  afterEach(() => {
    rafSpy.mockRestore();
  });

  describe('drawCircle', () => {
    it('should draw a circle and return circle element', () => {
      const addCircleSpy = vi.spyOn(layersStore, 'addCircle');
      const storeMapElementIdSpy = vi.spyOn(layersStore, 'storeMapElementId');

      const result = circleDrawing.drawCircle(48.8566, 2.3522, 5, 'My Circle');

      expect(result).toEqual(
        expect.objectContaining({
          id: 'test-uuid',
          name: 'My Circle',
          center: { lat: 48.8566, lon: 2.3522 },
          radius: 5,
          color: '#000000',
          mapElementId: 'test-uuid',
        })
      );

      expect(addCircleSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-uuid',
          name: 'My Circle',
          center: { lat: 48.8566, lon: 2.3522 },
          radius: 5,
          color: '#000000',
          mapElementId: 'test-uuid',
        })
      );

      expect(storeMapElementIdSpy).toHaveBeenCalledWith('circle', 'test-uuid', 'test-uuid');
      expect(mockAddFeature).toHaveBeenCalled();
      expect(mockMapRef.flyToBoundsWithPanels).toHaveBeenCalled();
    });

    it('should use default name if not provided', () => {
      const addCircleSpy = vi.spyOn(layersStore, 'addCircle');

      const result = circleDrawing.drawCircle(48.8566, 2.3522, 10);

      expect(result.name).toBe('Circle 1');
      expect(addCircleSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Circle 1',
        })
      );
    });

    it('should return null if map is not initialized', () => {
      mockMapRef.map.value = null;

      const result = circleDrawing.drawCircle(48.8566, 2.3522, 5);

      expect(result).toBeNull();
      expect(mockAddFeature).not.toHaveBeenCalled();
    });

    it('should return null if circlesSource is not initialized', () => {
      mockMapRef.circlesSource.value = null;

      const result = circleDrawing.drawCircle(48.8566, 2.3522, 5);

      expect(result).toBeNull();
      expect(mockAddFeature).not.toHaveBeenCalled();
    });

    it('should handle different radius values', () => {
      const addCircleSpy = vi.spyOn(layersStore, 'addCircle');

      // Small radius
      let result = circleDrawing.drawCircle(48.8566, 2.3522, 0.1);
      expect(result.radius).toBe(0.1);
      expect(addCircleSpy).toHaveBeenCalledWith(expect.objectContaining({ radius: 0.1 }));

      // Reset mock ID for next test
      vi.mocked(vi.fn()).mockReturnValue('test-uuid-2');

      // Large radius
      result = circleDrawing.drawCircle(48.8566, 2.3522, 100);
      expect(result.radius).toBe(100);
    });

    it('should calculate bounds correctly for flyTo', () => {
      circleDrawing.drawCircle(48.8566, 2.3522, 5, 'Test Circle');

      expect(mockMapRef.flyToBoundsWithPanels).toHaveBeenCalledWith([
        [48.8566 - 5 / 111, 2.3522 - 5 / 111],
        [48.8566 + 5 / 111, 2.3522 + 5 / 111],
      ]);
    });
  });

  describe('updateCircle', () => {
    beforeEach(() => {
      // Add a test circle to the store
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Test Circle',
        center: { lat: 48.8566, lon: 2.3522 },
        radius: 5,
        color: '#ff0000',
      });
    });

    it('should update circle properties and redraw', () => {
      const updateCircleSpy = vi.spyOn(layersStore, 'updateCircle');
      mockGetFeatureById.mockReturnValue({
        setStyle: vi.fn(),
      });

      circleDrawing.updateCircle('circle-1', 49, 3, 10, 'Updated Circle');

      expect(updateCircleSpy).toHaveBeenCalledWith('circle-1', {
        name: 'Updated Circle',
        center: { lat: 49, lon: 3 },
        radius: 10,
      });

      expect(mockGetFeatureById).toHaveBeenCalledWith('circle-1');
      expect(mockRemoveFeature).toHaveBeenCalled();
      expect(mockAddFeature).toHaveBeenCalled(); // Called by redrawCircleOnMap
    });

    it('should not update if circleId is undefined', () => {
      const updateCircleSpy = vi.spyOn(layersStore, 'updateCircle');

      circleDrawing.updateCircle(undefined, 49, 3, 10, 'Should not update');

      expect(updateCircleSpy).not.toHaveBeenCalled();
      expect(mockGetFeatureById).not.toHaveBeenCalled();
    });

    it('should not update if map is not initialized', () => {
      mockMapRef.map.value = null;
      const updateCircleSpy = vi.spyOn(layersStore, 'updateCircle');

      circleDrawing.updateCircle('circle-1', 49, 3, 10, 'Should not update');

      expect(updateCircleSpy).not.toHaveBeenCalled();
      expect(mockGetFeatureById).not.toHaveBeenCalled();
    });

    it('should handle missing feature gracefully', () => {
      const updateCircleSpy = vi.spyOn(layersStore, 'updateCircle');
      mockGetFeatureById.mockReturnValue(undefined);

      circleDrawing.updateCircle('circle-1', 49, 3, 10, 'Updated Circle');

      expect(updateCircleSpy).toHaveBeenCalled();
      expect(mockRemoveFeature).not.toHaveBeenCalled();
      // redrawCircleOnMap should still be called
      expect(mockAddFeature).toHaveBeenCalled();
    });
  });

  describe('redrawCircleOnMap', () => {
    it('should redraw a circle on the map', () => {
      // Add circle to store first
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Test Circle',
        center: { lat: 48.8566, lon: 2.3522 },
        radius: 5,
        color: '#ff0000',
      });

      circleDrawing.redrawCircleOnMap('circle-1', 48.8566, 2.3522, 5, '#00ff00');

      expect(mockAddFeature).toHaveBeenCalled();
    });

    it('should not redraw if map is not initialized', () => {
      mockMapRef.map.value = null;

      circleDrawing.redrawCircleOnMap('circle-1', 48.8566, 2.3522, 5, '#00ff00');

      expect(mockAddFeature).not.toHaveBeenCalled();
    });

    it('should not redraw if circlesSource is not initialized', () => {
      mockMapRef.circlesSource.value = null;

      circleDrawing.redrawCircleOnMap('circle-1', 48.8566, 2.3522, 5, '#00ff00');

      expect(mockAddFeature).not.toHaveBeenCalled();
    });

    it('should update mapElementId if circle exists in store', () => {
      // Add circle to store
      const circle = {
        id: 'circle-1',
        name: 'Test Circle',
        center: { lat: 48.8566, lon: 2.3522 },
        radius: 5,
        color: '#ff0000',
      };
      layersStore.addCircle(circle);

      circleDrawing.redrawCircleOnMap('circle-1', 48.8566, 2.3522, 5, '#00ff00');

      // Check that mapElementId was set
      const storedCircle = layersStore.circles.find((c: any) => c.id === 'circle-1');
      expect(storedCircle.mapElementId).toBe('circle-1');
    });

    it('should use default color if not provided', () => {
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Test Circle',
        center: { lat: 48.8566, lon: 2.3522 },
        radius: 5,
      });

      circleDrawing.redrawCircleOnMap('circle-1', 48.8566, 2.3522, 5);

      // The function should use DEFAULT_COLOR which is '#000000'
      expect(mockAddFeature).toHaveBeenCalled();
    });
  });
});
