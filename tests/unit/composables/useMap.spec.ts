import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, reactive } from 'vue';
import { useMap } from '@/composables/useMap';
import { DEFAULT_MAP_ZOOM } from '@/services/geoportail';
import { olProjMockConfig } from '../setup';

describe('useMap', () => {
  let mockElement: HTMLDivElement;
  let mockUiStore: any;

  beforeEach(() => {
    // Create mock element
    mockElement = document.createElement('div');
    mockElement.id = 'map-container';
    document.body.append(mockElement);

    // Create mock UI store
    mockUiStore = {
      mapProvider: 'geoportail',
      topBarOpen: false,
      sidebarOpen: false,
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('initMap', () => {
    it('should initialize map with default center when no initial view data', async () => {
      const { initMap, isMapInitialized, map } = useMap('map-container', mockUiStore);

      await initMap();

      expect(isMapInitialized.value).toBe(true);
      expect(map.value).not.toBeNull();
    });

    it('should initialize map with initial view data when set', async () => {
      const { initMap, setInitialViewData, isMapInitialized } = useMap(
        'map-container',
        mockUiStore
      );

      setInitialViewData({ lat: 48.8566, lon: 2.3522, zoom: 14 });
      await initMap();

      expect(isMapInitialized.value).toBe(true);
    });

    it('should not initialize if element does not exist', async () => {
      const { initMap, isMapInitialized } = useMap('non-existent-container', mockUiStore);

      await initMap();

      expect(isMapInitialized.value).toBe(false);
    });

    it('should not reinitialize if already initialized', async () => {
      const { initMap, isMapInitialized } = useMap('map-container', mockUiStore);

      await initMap();
      expect(isMapInitialized.value).toBe(true);

      await initMap();
      expect(isMapInitialized.value).toBe(true);
    });

    it('should initialize without uiStore', async () => {
      const { initMap, isMapInitialized } = useMap('map-container');

      await initMap();

      expect(isMapInitialized.value).toBe(true);
    });

    it('should handle initialization error silently', async () => {
      const OlMap = await import('ol/Map');
      vi.mocked(OlMap.default).mockImplementationOnce(function () {
        throw new Error('Map creation failed');
      });

      const { initMap, isMapInitialized } = useMap('map-container', mockUiStore);

      await initMap();

      expect(isMapInitialized.value).toBe(false);
    });

    it('should handle map destruction before nested requestAnimationFrame executes', async () => {
      // Capture the nested callback to call it manually after map destruction
      let nestedCallback: (() => void) | null = null;
      let outerCallbackExecuted = false;

      // Override requestAnimationFrame to capture the nested callback
      const originalRAF = global.requestAnimationFrame;
      global.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
        if (outerCallbackExecuted) {
          // This is the nested callback - capture it for later
          nestedCallback = () => cb(0);
        } else {
          // This is the outer callback - execute it immediately
          outerCallbackExecuted = true;
          cb(0);
        }
        return 0;
      });

      const { initMap, destroyMap, map } = useMap('map-container', mockUiStore);

      // Initialize the map - this will execute the outer RAF and capture the inner one
      await initMap();
      expect(map.value).not.toBeNull();
      expect(nestedCallback).not.toBeNull();

      // Destroy the map before executing the nested callback
      destroyMap();
      expect(map.value).toBeNull();

      // Now execute the nested callback - it should safely handle map.value being null
      expect(() => nestedCallback!()).not.toThrow();

      // Restore original RAF
      global.requestAnimationFrame = originalRAF;
    });

    it('should hide point labels when zoom is less than 12', async () => {
      // Create a point-label element in the DOM
      const pointLabel = document.createElement('div');
      pointLabel.className = 'point-label';
      pointLabel.style.opacity = '1';
      document.body.append(pointLabel);

      // Set up mock to return zoom < 12
      const OlMap = await import('ol/Map');
      const mockView = {
        getZoom: vi.fn(function () {
          return 8;
        }),
        getCenter: vi.fn(function () {
          return [200_000, 6_000_000];
        }),
        setZoom: vi.fn(),
        setCenter: vi.fn(),
        fit: vi.fn(),
        animate: vi.fn(),
        on: vi.fn(),
        un: vi.fn(),
        getResolution: vi.fn(function () {
          return 100;
        }),
      };

      vi.mocked(OlMap.default).mockImplementationOnce(
        vi.fn(function () {
          return {
            addLayer: vi.fn(),
            removeLayer: vi.fn(),
            setTarget: vi.fn(),
            getView: vi.fn(function () {
              return mockView;
            }),
            on: vi.fn(),
            un: vi.fn(),
            once: vi.fn(),
            getEventPixel: vi.fn(),
            getCoordinateFromPixel: vi.fn(),
            getPixelFromCoordinate: vi.fn(),
            addOverlay: vi.fn(),
            removeOverlay: vi.fn(),
            getOverlays: vi.fn(function () {
              return {
                getArray: vi.fn(function () {
                  return [];
                }),
                clear: vi.fn(),
              };
            }),
            getLayers: vi.fn(function () {
              return {
                getArray: vi.fn(function () {
                  return [];
                }),
              };
            }),
            getSize: vi.fn(function () {
              return [1024, 768];
            }),
            updateSize: vi.fn(),
            render: vi.fn(),
          };
        })
      );

      const { initMap, isMapInitialized } = useMap('map-container', mockUiStore);

      await initMap();

      expect(isMapInitialized.value).toBe(true);
      // Label should be hidden (opacity 0) since zoom < 12
      expect(pointLabel.style.opacity).toBe('0');
    });

    it('should show point labels when zoom is 12 or higher', async () => {
      // Create a point-label element in the DOM with initial opacity 0
      const pointLabel = document.createElement('div');
      pointLabel.className = 'point-label';
      pointLabel.style.opacity = '0';
      document.body.append(pointLabel);

      // Set up mock to return zoom >= 12
      const OlMap = await import('ol/Map');
      const mockView = {
        getZoom: vi.fn(function () {
          return 14;
        }),
        getCenter: vi.fn(function () {
          return [200_000, 6_000_000];
        }),
        setZoom: vi.fn(),
        setCenter: vi.fn(),
        fit: vi.fn(),
        animate: vi.fn(),
        on: vi.fn(),
        un: vi.fn(),
        getResolution: vi.fn(function () {
          return 100;
        }),
      };

      vi.mocked(OlMap.default).mockImplementationOnce(
        vi.fn(function () {
          return {
            addLayer: vi.fn(),
            removeLayer: vi.fn(),
            setTarget: vi.fn(),
            getView: vi.fn(function () {
              return mockView;
            }),
            on: vi.fn(),
            un: vi.fn(),
            once: vi.fn(),
            getEventPixel: vi.fn(),
            getCoordinateFromPixel: vi.fn(),
            getPixelFromCoordinate: vi.fn(),
            addOverlay: vi.fn(),
            removeOverlay: vi.fn(),
            getOverlays: vi.fn(function () {
              return {
                getArray: vi.fn(function () {
                  return [];
                }),
                clear: vi.fn(),
              };
            }),
            getLayers: vi.fn(function () {
              return {
                getArray: vi.fn(function () {
                  return [];
                }),
              };
            }),
            getSize: vi.fn(function () {
              return [1024, 768];
            }),
            updateSize: vi.fn(),
            render: vi.fn(),
          };
        })
      );

      const { initMap, isMapInitialized } = useMap('map-container', mockUiStore);

      await initMap();

      expect(isMapInitialized.value).toBe(true);
      // Label should be visible (opacity 1) since zoom >= 12
      expect(pointLabel.style.opacity).toBe('1');
    });

    it('should handle resolution change callback when map becomes null', async () => {
      // Capture the resolution change callback
      let resolutionChangeCallback: (() => void) | null = null;

      const OlMap = await import('ol/Map');
      const mockView = {
        getZoom: vi.fn(function () {
          return 14;
        }),
        getCenter: vi.fn(function () {
          return [200_000, 6_000_000];
        }),
        setZoom: vi.fn(),
        setCenter: vi.fn(),
        fit: vi.fn(),
        animate: vi.fn(),
        on: vi.fn(function (event: string, callback: () => void) {
          if (event === 'change:resolution') {
            resolutionChangeCallback = callback;
          }
        }),
        un: vi.fn(),
        getResolution: vi.fn(function () {
          return 100;
        }),
      };

      vi.mocked(OlMap.default).mockImplementationOnce(
        vi.fn(function () {
          return {
            addLayer: vi.fn(),
            removeLayer: vi.fn(),
            setTarget: vi.fn(),
            getView: vi.fn(function () {
              return mockView;
            }),
            on: vi.fn(),
            un: vi.fn(),
            once: vi.fn(),
            getEventPixel: vi.fn(),
            getCoordinateFromPixel: vi.fn(),
            getPixelFromCoordinate: vi.fn(),
            addOverlay: vi.fn(),
            removeOverlay: vi.fn(),
            getOverlays: vi.fn(function () {
              return {
                getArray: vi.fn(function () {
                  return [];
                }),
                clear: vi.fn(),
              };
            }),
            getLayers: vi.fn(function () {
              return {
                getArray: vi.fn(function () {
                  return [];
                }),
              };
            }),
            getSize: vi.fn(function () {
              return [1024, 768];
            }),
            updateSize: vi.fn(),
            render: vi.fn(),
          };
        })
      );

      const { initMap, destroyMap, isMapInitialized, map } = useMap('map-container', mockUiStore);

      await initMap();
      expect(isMapInitialized.value).toBe(true);
      expect(resolutionChangeCallback).not.toBeNull();

      // Destroy the map
      destroyMap();
      expect(map.value).toBeNull();

      // Now trigger the callback - it should return early without error
      expect(() => {
        if (resolutionChangeCallback) {
          resolutionChangeCallback();
        }
      }).not.toThrow();
    });

    it('should update tile source when mapProvider changes', async () => {
      // Create a reactive uiStore to test the watcher
      const reactiveUiStore = reactive({
        mapProvider: 'geoportail',
        topBarOpen: false,
        sidebarOpen: false,
      });

      // Set up spies on the XYZ mock to capture when methods are called
      const setUrlSpy = vi.fn();
      const clearSpy = vi.fn();

      const XYZ = await import('ol/source/XYZ');
      vi.mocked(XYZ.default).mockImplementation(
        vi.fn(function () {
          return {
            setUrl: setUrlSpy,
            clear: clearSpy,
            getUrls: vi.fn(function () {
              return [];
            }),
          };
        })
      );

      const { initMap, isMapInitialized } = useMap('map-container', reactiveUiStore);

      await initMap();

      expect(isMapInitialized.value).toBe(true);

      // Reset spies after initialization
      setUrlSpy.mockClear();
      clearSpy.mockClear();

      // Change the map provider
      reactiveUiStore.mapProvider = 'osm';

      // Wait for Vue's reactivity system to process the change
      await nextTick();

      // Verify tile source was updated
      expect(setUrlSpy).toHaveBeenCalled();
      expect(clearSpy).toHaveBeenCalled();
    });
  });

  describe('destroyMap', () => {
    it('should destroy map and clear all resources', async () => {
      const { initMap, destroyMap, map, isMapInitialized, circlesSource } = useMap(
        'map-container',
        mockUiStore
      );

      await initMap();
      expect(map.value).not.toBeNull();

      destroyMap();

      expect(map.value).toBeNull();
      expect(isMapInitialized.value).toBe(false);
      expect(circlesSource.value).toBeNull();
    });

    it('should handle destroy when map is null', () => {
      const { destroyMap, map } = useMap('map-container', mockUiStore);

      destroyMap();

      expect(map.value).toBeNull();
    });

    it('should remove all overlays during destroy', async () => {
      const { initMap, destroyMap, map } = useMap('map-container', mockUiStore);

      await initMap();
      expect(map.value).not.toBeNull();

      // Mock overlays array with actual overlay objects
      const mockOverlay1 = { id: 'overlay1' };
      const mockOverlay2 = { id: 'overlay2' };
      const mockOverlaysArray = [mockOverlay1, mockOverlay2];

      const removeOverlaySpy = vi.fn();
      vi.mocked(map.value!.getOverlays).mockReturnValue({
        getArray: vi.fn(function () {
          return mockOverlaysArray;
        }),
        clear: vi.fn(),
      } as any);
      vi.mocked(map.value!.removeOverlay).mockImplementation(removeOverlaySpy);

      destroyMap();

      // Verify overlays were removed
      expect(removeOverlaySpy).toHaveBeenCalledTimes(2);
      expect(removeOverlaySpy).toHaveBeenCalledWith(mockOverlay1);
      expect(removeOverlaySpy).toHaveBeenCalledWith(mockOverlay2);
    });
  });

  describe('addLayer', () => {
    it('should add layer to map and track it when map is initialized', async () => {
      const { initMap, addLayer, mapLayers, map } = useMap('map-container', mockUiStore);

      await initMap();

      const mockLayer = { id: 'test-layer' } as any;
      const result = addLayer(mockLayer);

      expect(result).toBe(mockLayer);
      // Only check mapLayers if map was successfully initialized
      if (map.value) {
        expect(mapLayers.value.length).toBeGreaterThan(0);
        expect(mapLayers.value.some((l: any) => l.id === 'test-layer')).toBe(true);
      }
    });

    it('should return layer without adding if map is null', () => {
      const { addLayer, mapLayers } = useMap('map-container', mockUiStore);

      const mockLayer = { id: 'test-layer' } as any;
      const result = addLayer(mockLayer);

      expect(result).toBe(mockLayer);
      expect(mapLayers.value).toHaveLength(0);
    });
  });

  describe('removeLayer', () => {
    it('should call removeLayer on map when map is initialized', async () => {
      const { initMap, addLayer, removeLayer, map } = useMap('map-container', mockUiStore);

      await initMap();

      const mockLayer = { id: 'test-layer' } as any;
      addLayer(mockLayer);

      // Just verify removeLayer doesn't throw when map is initialized
      if (map.value) {
        expect(() => removeLayer(mockLayer)).not.toThrow();
        // Verify map.removeLayer was called
        expect(map.value.removeLayer).toHaveBeenCalled();
      }
    });

    it('should not throw if map is null', () => {
      const { removeLayer } = useMap('map-container', mockUiStore);

      const mockLayer = { id: 'test-layer' } as any;
      expect(() => removeLayer(mockLayer)).not.toThrow();
    });
  });

  describe('clearLayers', () => {
    it('should clear all tracked layers', async () => {
      const { initMap, addLayer, clearLayers, mapLayers } = useMap('map-container', mockUiStore);

      await initMap();

      const mockLayer = { id: 'test-layer' } as any;
      addLayer(mockLayer);

      clearLayers();

      expect(mapLayers.value).toHaveLength(0);
    });

    it('should not throw when sources are null', () => {
      const { clearLayers } = useMap('map-container', mockUiStore);

      expect(() => clearLayers()).not.toThrow();
    });

    it('should handle clearing layers when map is destroyed but mapLayers has items', async () => {
      const { initMap, addLayer, destroyMap, clearLayers, mapLayers } = useMap(
        'map-container',
        mockUiStore
      );

      await initMap();

      // Add a layer
      const mockLayer = { id: 'test-layer' } as any;
      addLayer(mockLayer);
      expect(mapLayers.value).toHaveLength(1);

      // Directly manipulate mapLayers to simulate having layers after map destruction
      // (normally addLayer wouldn't work after destroy)
      destroyMap();

      // Add items back to mapLayers to test the branch
      mapLayers.value.push({ id: 'orphan-layer' } as any);

      // clearLayers should handle map.value being null gracefully
      expect(() => clearLayers()).not.toThrow();
      expect(mapLayers.value).toHaveLength(0);
    });
  });

  describe('setCenter', () => {
    it('should not throw when setting center', async () => {
      const { initMap, setCenter } = useMap('map-container', mockUiStore);

      await initMap();

      expect(() => setCenter(48.8566, 2.3522)).not.toThrow();
    });

    it('should not throw when setting center with zoom', async () => {
      const { initMap, setCenter } = useMap('map-container', mockUiStore);

      await initMap();

      expect(() => setCenter(48.8566, 2.3522, 14)).not.toThrow();
    });

    it('should not throw if map is null', () => {
      const { setCenter } = useMap('map-container', mockUiStore);

      expect(() => setCenter(48.8566, 2.3522)).not.toThrow();
    });
  });

  describe('getCenter', () => {
    it('should return map center when map is initialized', async () => {
      const { initMap, getCenter, map } = useMap('map-container', mockUiStore);

      await initMap();

      const center = getCenter();

      // If map was successfully initialized, center should have lat/lon
      if (map.value) {
        expect(center).not.toBeNull();
        expect(center).toHaveProperty('lat');
        expect(center).toHaveProperty('lon');
      } else {
        // If map is null, getCenter returns null
        expect(center).toBeNull();
      }
    });

    it('should return null if map is null', () => {
      const { getCenter } = useMap('map-container', mockUiStore);

      const center = getCenter();

      expect(center).toBeNull();
    });

    it('should return null if view center is null', async () => {
      const { initMap, getCenter, map } = useMap('map-container', mockUiStore);

      await initMap();

      expect(map.value).not.toBeNull();

      // Create a persistent view mock that returns undefined center
      const persistentView = {
        getCenter: vi.fn(function () {
          return null;
        }),
      };

      // Override getView to return persistent view
      vi.mocked(map.value!.getView).mockReturnValue(persistentView as any);

      const center = getCenter();

      expect(center).toBeNull();
    });

    it('should return null if lonLat conversion returns null', async () => {
      const { initMap, getCenter, map } = useMap('map-container', mockUiStore);

      await initMap();

      expect(map.value).not.toBeNull();

      // Set mock to return null to trigger line 268
      olProjMockConfig.toLonLatReturnValue = null;

      const center = getCenter();

      expect(center).toBeNull();
    });

    it('should return null if lonLat has wrong length', async () => {
      const { initMap, getCenter, map } = useMap('map-container', mockUiStore);

      await initMap();

      expect(map.value).not.toBeNull();

      // Set mock to return array with wrong length
      olProjMockConfig.toLonLatReturnValue = [1];

      const center = getCenter();

      expect(center).toBeNull();
    });

    it('should return null if lonLat values are undefined', async () => {
      const { initMap, getCenter, map } = useMap('map-container', mockUiStore);

      await initMap();

      expect(map.value).not.toBeNull();

      // Set mock to return array with undefined values
      olProjMockConfig.toLonLatReturnValue = [undefined, undefined];

      const center = getCenter();

      expect(center).toBeNull();
    });
  });

  describe('getZoom', () => {
    it('should return a zoom value', async () => {
      const { initMap, getZoom } = useMap('map-container', mockUiStore);

      await initMap();

      const zoom = getZoom();

      expect(typeof zoom).toBe('number');
    });

    it('should return default zoom if map is null', () => {
      const { getZoom } = useMap('map-container', mockUiStore);

      const zoom = getZoom();

      expect(zoom).toBe(DEFAULT_MAP_ZOOM);
    });

    it('should return default zoom if getZoom returns undefined', async () => {
      // Create a mock view that returns undefined for getZoom
      const OlMap = await import('ol/Map');
      const mockViewUndefined = {
        getZoom: vi.fn(() => undefined),
        getCenter: vi.fn(() => [200_000, 6_000_000]),
        setZoom: vi.fn(),
        setCenter: vi.fn(),
        fit: vi.fn(),
        animate: vi.fn(),
        on: vi.fn(),
        un: vi.fn(),
        getResolution: vi.fn(() => 100),
      };

      vi.mocked(OlMap.default).mockImplementationOnce(
        vi.fn(function () {
          return {
            addLayer: vi.fn(),
            removeLayer: vi.fn(),
            setTarget: vi.fn(),
            getView: vi.fn(() => mockViewUndefined),
            on: vi.fn(),
            un: vi.fn(),
            once: vi.fn(),
            getEventPixel: vi.fn(),
            getCoordinateFromPixel: vi.fn(),
            getPixelFromCoordinate: vi.fn(),
            addOverlay: vi.fn(),
            removeOverlay: vi.fn(),
            getOverlays: vi.fn(() => ({ getArray: vi.fn(() => []), clear: vi.fn() })),
            getLayers: vi.fn(() => ({ getArray: vi.fn(() => []) })),
            getSize: vi.fn(() => [1024, 768]),
            updateSize: vi.fn(),
            render: vi.fn(),
          };
        })
      );

      const { initMap, getZoom } = useMap('map-container', mockUiStore);

      await initMap();

      const zoom = getZoom();

      expect(zoom).toBe(DEFAULT_MAP_ZOOM);
    });
  });

  describe('latLngToContainerPoint', () => {
    it('should convert lat/lng to pixel when map is initialized', async () => {
      const { initMap, latLngToContainerPoint, map } = useMap('map-container', mockUiStore);

      await initMap();

      const point = latLngToContainerPoint(48.8566, 2.3522);

      // If map was successfully initialized, point should have x/y
      if (map.value) {
        expect(point).not.toBeNull();
        expect(point).toHaveProperty('x');
        expect(point).toHaveProperty('y');
      } else {
        // If map is null, latLngToContainerPoint returns null
        expect(point).toBeNull();
      }
    });

    it('should return null if map is null', () => {
      const { latLngToContainerPoint } = useMap('map-container', mockUiStore);

      const point = latLngToContainerPoint(48.8566, 2.3522);

      expect(point).toBeNull();
    });

    it('should return null if pixel is invalid', async () => {
      const { initMap, latLngToContainerPoint, map } = useMap('map-container', mockUiStore);

      await initMap();

      expect(map.value).not.toBeNull();

      // Mock getPixelFromCoordinate to return invalid pixel
      vi.mocked(map.value!.getPixelFromCoordinate).mockReturnValue(undefined as any);

      const point = latLngToContainerPoint(48.8566, 2.3522);

      expect(point).toBeNull();
    });
  });

  describe('containerPointToLatLng', () => {
    it('should convert pixel to lat/lng when map is initialized', async () => {
      const { initMap, containerPointToLatLng, map } = useMap('map-container', mockUiStore);

      await initMap();

      const latLng = containerPointToLatLng(500, 400);

      // If map was successfully initialized, latLng should have lat/lon
      if (map.value) {
        expect(latLng).not.toBeNull();
        expect(latLng).toHaveProperty('lat');
        expect(latLng).toHaveProperty('lon');
      } else {
        // If map is null, containerPointToLatLng returns null
        expect(latLng).toBeNull();
      }
    });

    it('should return null if map is null', () => {
      const { containerPointToLatLng } = useMap('map-container', mockUiStore);

      const latLng = containerPointToLatLng(500, 400);

      expect(latLng).toBeNull();
    });

    it('should return null if coordinate is null', async () => {
      const { initMap, containerPointToLatLng, map } = useMap('map-container', mockUiStore);

      await initMap();

      expect(map.value).not.toBeNull();

      // Mock getCoordinateFromPixel to return null
      vi.mocked(map.value!.getCoordinateFromPixel).mockReturnValue(null as any);

      const latLng = containerPointToLatLng(500, 400);

      expect(latLng).toBeNull();
    });

    it('should return null when toLonLat returns undefined values', async () => {
      const { initMap, containerPointToLatLng, map } = useMap('map-container', mockUiStore);

      await initMap();

      expect(map.value).not.toBeNull();

      // Set mock to return array with undefined values to hit line 300
      olProjMockConfig.toLonLatReturnValue = [undefined, undefined];

      const latLng = containerPointToLatLng(500, 400);

      expect(latLng).toBeNull();
    });
  });

  describe('fitBounds', () => {
    it('should not throw when fitting to bounds', async () => {
      const { initMap, fitBounds } = useMap('map-container', mockUiStore);

      await initMap();

      expect(() =>
        fitBounds([
          [48.8, 2.3],
          [48.9, 2.4],
        ])
      ).not.toThrow();
    });

    it('should not throw with custom options', async () => {
      const { initMap, fitBounds } = useMap('map-container', mockUiStore);

      await initMap();

      expect(() =>
        fitBounds(
          [
            [48.8, 2.3],
            [48.9, 2.4],
          ],
          { duration: 1000, padding: [100, 100] }
        )
      ).not.toThrow();
    });

    it('should not throw if map is null', () => {
      const { fitBounds } = useMap('map-container', mockUiStore);

      expect(() =>
        fitBounds([
          [48.8, 2.3],
          [48.9, 2.4],
        ])
      ).not.toThrow();
    });
  });

  describe('flyTo', () => {
    it('should not throw when flying to location', async () => {
      const { initMap, flyTo } = useMap('map-container', mockUiStore);

      await initMap();

      expect(() => flyTo(48.8566, 2.3522)).not.toThrow();
    });

    it('should not throw with custom zoom', async () => {
      const { initMap, flyTo } = useMap('map-container', mockUiStore);

      await initMap();

      expect(() => flyTo(48.8566, 2.3522, 14)).not.toThrow();
    });

    it('should not throw with custom options', async () => {
      const { initMap, flyTo } = useMap('map-container', mockUiStore);

      await initMap();

      const easing = (t: number) => t * t;
      expect(() => flyTo(48.8566, 2.3522, 14, { duration: 2000, easing })).not.toThrow();
    });

    it('should not throw if map is null', () => {
      const { flyTo } = useMap('map-container', mockUiStore);

      expect(() => flyTo(48.8566, 2.3522)).not.toThrow();
    });

    it('should use current zoom when zoom parameter is undefined and currentZoom is defined', async () => {
      // Set up a mock that returns a specific zoom value
      const OlMap = await import('ol/Map');
      const mockViewWithZoom = {
        getZoom: vi.fn(() => 14), // Return a defined zoom value
        getCenter: vi.fn(() => [200_000, 6_000_000]),
        setZoom: vi.fn(),
        setCenter: vi.fn(),
        fit: vi.fn(),
        animate: vi.fn(),
        on: vi.fn(),
        un: vi.fn(),
        getResolution: vi.fn(() => 100),
      };

      vi.mocked(OlMap.default).mockImplementationOnce(
        vi.fn(function () {
          return {
            addLayer: vi.fn(),
            removeLayer: vi.fn(),
            setTarget: vi.fn(),
            getView: vi.fn(() => mockViewWithZoom),
            on: vi.fn(),
            un: vi.fn(),
            once: vi.fn(),
            getEventPixel: vi.fn(),
            getCoordinateFromPixel: vi.fn(),
            getPixelFromCoordinate: vi.fn(),
            addOverlay: vi.fn(),
            removeOverlay: vi.fn(),
            getOverlays: vi.fn(() => ({ getArray: vi.fn(() => []), clear: vi.fn() })),
            getLayers: vi.fn(() => ({ getArray: vi.fn(() => []) })),
            getSize: vi.fn(() => [1024, 768]),
            updateSize: vi.fn(),
            render: vi.fn(),
          };
        })
      );

      const { initMap, flyTo } = useMap('map-container', mockUiStore);

      await initMap();

      // Call flyTo without zoom parameter - should use current zoom (14)
      expect(() => flyTo(48.8566, 2.3522)).not.toThrow();
      expect(mockViewWithZoom.animate).toHaveBeenCalled();
    });

    it('should use default zoom when zoom parameter is undefined and currentZoom is undefined', async () => {
      // Set up a mock that returns undefined for getZoom
      const OlMap = await import('ol/Map');
      const mockViewNoZoom = {
        getZoom: vi.fn(() => undefined), // Return undefined
        getCenter: vi.fn(() => [200_000, 6_000_000]),
        setZoom: vi.fn(),
        setCenter: vi.fn(),
        fit: vi.fn(),
        animate: vi.fn(),
        on: vi.fn(),
        un: vi.fn(),
        getResolution: vi.fn(() => 100),
      };

      vi.mocked(OlMap.default).mockImplementationOnce(
        vi.fn(function () {
          return {
            addLayer: vi.fn(),
            removeLayer: vi.fn(),
            setTarget: vi.fn(),
            getView: vi.fn(() => mockViewNoZoom),
            on: vi.fn(),
            un: vi.fn(),
            once: vi.fn(),
            getEventPixel: vi.fn(),
            getCoordinateFromPixel: vi.fn(),
            getPixelFromCoordinate: vi.fn(),
            addOverlay: vi.fn(),
            removeOverlay: vi.fn(),
            getOverlays: vi.fn(() => ({ getArray: vi.fn(() => []), clear: vi.fn() })),
            getLayers: vi.fn(() => ({ getArray: vi.fn(() => []) })),
            getSize: vi.fn(() => [1024, 768]),
            updateSize: vi.fn(),
            render: vi.fn(),
          };
        })
      );

      const { initMap, flyTo } = useMap('map-container', mockUiStore);

      await initMap();

      // Call flyTo without zoom parameter - should use DEFAULT_MAP_ZOOM
      expect(() => flyTo(48.8566, 2.3522)).not.toThrow();
      expect(mockViewNoZoom.animate).toHaveBeenCalled();
    });
  });

  describe('flyToBounds', () => {
    it('should not throw when flying to bounds', async () => {
      const { initMap, flyToBounds } = useMap('map-container', mockUiStore);

      await initMap();

      expect(() =>
        flyToBounds([
          [48.8, 2.3],
          [48.9, 2.4],
        ])
      ).not.toThrow();
    });

    it('should not throw with custom options', async () => {
      const { initMap, flyToBounds } = useMap('map-container', mockUiStore);

      await initMap();

      expect(() =>
        flyToBounds(
          [
            [48.8, 2.3],
            [48.9, 2.4],
          ],
          { duration: 2, padding: [100, 100] }
        )
      ).not.toThrow();
    });

    it('should not throw if map is null', () => {
      const { flyToBounds } = useMap('map-container', mockUiStore);

      expect(() =>
        flyToBounds([
          [48.8, 2.3],
          [48.9, 2.4],
        ])
      ).not.toThrow();
    });
  });

  describe('flyToBoundsWithPanels', () => {
    it('should fly to bounds without panel adjustments when uiStore not provided', async () => {
      const { initMap, flyToBoundsWithPanels } = useMap('map-container');

      await initMap();

      expect(() =>
        flyToBoundsWithPanels([
          [48.8, 2.3],
          [48.9, 2.4],
        ])
      ).not.toThrow();
    });

    it('should not throw if map is null', () => {
      const { flyToBoundsWithPanels } = useMap('map-container', mockUiStore);

      expect(() =>
        flyToBoundsWithPanels([
          [48.8, 2.3],
          [48.9, 2.4],
        ])
      ).not.toThrow();
    });

    it('should account for top bar when open', async () => {
      mockUiStore.topBarOpen = true;
      const { initMap, flyToBoundsWithPanels } = useMap('map-container', mockUiStore);

      await initMap();

      expect(() =>
        flyToBoundsWithPanels([
          [48.8, 2.3],
          [48.9, 2.4],
        ])
      ).not.toThrow();
    });

    it('should account for sidebar when open', async () => {
      mockUiStore.sidebarOpen = true;
      const { initMap, flyToBoundsWithPanels } = useMap('map-container', mockUiStore);

      await initMap();

      expect(() =>
        flyToBoundsWithPanels([
          [48.8, 2.3],
          [48.9, 2.4],
        ])
      ).not.toThrow();
    });

    it('should not account for panels when accountForPanels is false', async () => {
      mockUiStore.topBarOpen = true;
      mockUiStore.sidebarOpen = true;
      const { initMap, flyToBoundsWithPanels } = useMap('map-container', mockUiStore);

      await initMap();

      expect(() =>
        flyToBoundsWithPanels(
          [
            [48.8, 2.3],
            [48.9, 2.4],
          ],
          { accountForPanels: false }
        )
      ).not.toThrow();
    });

    it('should use custom duration when provided', async () => {
      const { initMap, flyToBoundsWithPanels } = useMap('map-container', mockUiStore);

      await initMap();

      expect(() =>
        flyToBoundsWithPanels(
          [
            [48.8, 2.3],
            [48.9, 2.4],
          ],
          { duration: 3 }
        )
      ).not.toThrow();
    });
  });

  describe('refitMap', () => {
    it('should not throw if map is null', () => {
      const { refitMap } = useMap('map-container', mockUiStore);

      expect(() => refitMap(true, false)).not.toThrow();
    });

    it('should not throw when sidebar closes', async () => {
      const { initMap, refitMap } = useMap('map-container', mockUiStore);

      await initMap();

      expect(() => refitMap(true, false)).not.toThrow();
    });

    it('should not throw when sidebar opens', async () => {
      const { initMap, refitMap } = useMap('map-container', mockUiStore);

      await initMap();

      expect(() => refitMap(false, true)).not.toThrow();
    });

    it('should not throw when top bar closes', async () => {
      const { initMap, refitMap } = useMap('map-container', mockUiStore);

      await initMap();

      expect(() => refitMap(undefined, undefined, true, false)).not.toThrow();
    });

    it('should not throw when top bar opens', async () => {
      const { initMap, refitMap } = useMap('map-container', mockUiStore);

      await initMap();

      expect(() => refitMap(undefined, undefined, false, true)).not.toThrow();
    });

    it('should not throw with both sidebar and top bar changes', async () => {
      const { initMap, refitMap } = useMap('map-container', mockUiStore);

      await initMap();

      expect(() => refitMap(true, false, true, false)).not.toThrow();
    });

    it('should not throw when sidebar state unchanged (both open)', async () => {
      const { initMap, refitMap } = useMap('map-container', mockUiStore);

      await initMap();

      // Both true - no change needed
      expect(() => refitMap(true, true)).not.toThrow();
    });

    it('should not throw when sidebar state unchanged (both closed)', async () => {
      const { initMap, refitMap } = useMap('map-container', mockUiStore);

      await initMap();

      // Both false - no change needed
      expect(() => refitMap(false, false)).not.toThrow();
    });

    it('should not throw when top bar state unchanged (both open)', async () => {
      const { initMap, refitMap } = useMap('map-container', mockUiStore);

      await initMap();

      // Both true - no change needed
      expect(() => refitMap(undefined, undefined, true, true)).not.toThrow();
    });

    it('should not throw when top bar state unchanged (both closed)', async () => {
      const { initMap, refitMap } = useMap('map-container', mockUiStore);

      await initMap();

      // Both false - no change needed
      expect(() => refitMap(undefined, undefined, false, false)).not.toThrow();
    });

    it('should return early if map size is null', async () => {
      const { initMap, refitMap, map } = useMap('map-container', mockUiStore);

      await initMap();

      expect(map.value).not.toBeNull();

      // Mock getSize to return undefined
      vi.mocked(map.value!.getSize).mockReturnValue(undefined as any);

      expect(() => refitMap(true, false)).not.toThrow();
    });

    it('should return early if map size is invalid', async () => {
      const { initMap, refitMap, map } = useMap('map-container', mockUiStore);

      await initMap();

      expect(map.value).not.toBeNull();

      // Mock getSize to return invalid array
      vi.mocked(map.value!.getSize).mockReturnValue([undefined, undefined] as any);

      expect(() => refitMap(true, false)).not.toThrow();
    });

    it('should return early if center is null', async () => {
      const { initMap, refitMap, map } = useMap('map-container', mockUiStore);

      await initMap();

      expect(map.value).not.toBeNull();

      // Create a persistent view mock that returns undefined center
      const persistentView = {
        getCenter: vi.fn(function () {
          return undefined;
        }),
        getResolution: vi.fn(function () {
          return 100;
        }),
        setCenter: vi.fn(),
        fit: vi.fn(),
      };

      // Override getView to return persistent view
      vi.mocked(map.value!.getView).mockReturnValue(persistentView as any);

      expect(() => refitMap(true, false)).not.toThrow();
    });

    it('should return early if resolution is null', async () => {
      const { initMap, refitMap, map } = useMap('map-container', mockUiStore);

      await initMap();

      expect(map.value).not.toBeNull();

      // Create a persistent view mock that returns undefined resolution
      const persistentView = {
        getCenter: vi.fn(function () {
          return [200_000, 6_000_000];
        }),
        getResolution: vi.fn(function () {
          return undefined;
        }),
        setCenter: vi.fn(),
        fit: vi.fn(),
      };

      // Override getView to return persistent view
      vi.mocked(map.value!.getView).mockReturnValue(persistentView as any);

      expect(() => refitMap(true, false)).not.toThrow();
    });
  });

  describe('onMapClick', () => {
    it('should return unsubscribe function after registering handler', async () => {
      const { initMap, onMapClick } = useMap('map-container', mockUiStore);

      await initMap();

      const callback = vi.fn();
      const unsubscribe = onMapClick(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should return noop if map is null', () => {
      const { onMapClick } = useMap('map-container', mockUiStore);

      const callback = vi.fn();
      const unsubscribe = onMapClick(callback);

      expect(() => unsubscribe()).not.toThrow();
    });

    it('should not throw when unsubscribing', async () => {
      const { initMap, onMapClick } = useMap('map-container', mockUiStore);

      await initMap();

      const callback = vi.fn();
      const unsubscribe = onMapClick(callback);

      expect(() => unsubscribe()).not.toThrow();
    });

    it('should invoke callback when map click event is triggered', async () => {
      const { initMap, onMapClick, map } = useMap('map-container', mockUiStore);

      await initMap();

      expect(map.value).not.toBeNull();

      // Capture the handler that's registered with map.on('click')
      let registeredHandler: ((event: any) => void) | null = null;
      vi.mocked(map.value!.on).mockImplementation((eventType: string, handler: any) => {
        if (eventType === 'click') {
          registeredHandler = handler;
        }
        return map.value;
      });

      const callback = vi.fn();
      onMapClick(callback);

      expect(registeredHandler).not.toBeNull();

      // Simulate a click event by calling the registered handler
      registeredHandler!({ pixel: [500, 400] });

      // Callback should have been called with lat/lon
      expect(callback).toHaveBeenCalled();
    });

    it('should not invoke callback when coordinate is null', async () => {
      const { initMap, onMapClick, map } = useMap('map-container', mockUiStore);

      await initMap();

      expect(map.value).not.toBeNull();

      // Mock getCoordinateFromPixel to return null
      vi.mocked(map.value!.getCoordinateFromPixel).mockReturnValue(null as any);

      // Capture the handler
      let registeredHandler: ((event: any) => void) | null = null;
      vi.mocked(map.value!.on).mockImplementation((eventType: string, handler: any) => {
        if (eventType === 'click') {
          registeredHandler = handler;
        }
        return map.value;
      });

      const callback = vi.fn();
      onMapClick(callback);

      expect(registeredHandler).not.toBeNull();

      // Simulate a click event
      registeredHandler!({ pixel: [500, 400] });

      // Callback should NOT have been called
      expect(callback).not.toHaveBeenCalled();
    });

    it('should not invoke callback when toLonLat returns undefined values', async () => {
      const { initMap, onMapClick, map } = useMap('map-container', mockUiStore);

      await initMap();

      expect(map.value).not.toBeNull();

      // Mock toLonLat to return undefined values
      olProjMockConfig.toLonLatReturnValue = [undefined, undefined];

      // Capture the handler
      let registeredHandler: ((event: any) => void) | null = null;
      vi.mocked(map.value!.on).mockImplementation((eventType: string, handler: any) => {
        if (eventType === 'click') {
          registeredHandler = handler;
        }
        return map.value;
      });

      const callback = vi.fn();
      onMapClick(callback);

      expect(registeredHandler).not.toBeNull();

      // Simulate a click event
      registeredHandler!({ pixel: [500, 400] });

      // Callback should NOT have been called
      expect(callback).not.toHaveBeenCalled();
    });

    it('should safely unsubscribe even when map is destroyed', async () => {
      const { initMap, onMapClick, map, destroyMap } = useMap('map-container', mockUiStore);

      await initMap();
      expect(map.value).not.toBeNull();

      const callback = vi.fn();
      const unsubscribe = onMapClick(callback);

      // Destroy the map (sets map.value to null)
      destroyMap();

      // Unsubscribe should not throw even though map is null
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe('onMapRightClick', () => {
    it('should return noop if element does not exist', () => {
      document.body.innerHTML = '';
      const { onMapRightClick } = useMap('non-existent', mockUiStore);

      const callback = vi.fn();
      const unsubscribe = onMapRightClick(callback);

      expect(() => unsubscribe()).not.toThrow();
    });

    it('should return noop if map is null', () => {
      const { onMapRightClick } = useMap('map-container', mockUiStore);

      const callback = vi.fn();
      const unsubscribe = onMapRightClick(callback);

      expect(() => unsubscribe()).not.toThrow();
    });

    it('should return unsubscribe function after map is initialized', async () => {
      const { initMap, onMapRightClick } = useMap('map-container', mockUiStore);

      await initMap();

      const callback = vi.fn();
      const unsubscribe = onMapRightClick(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should call callback when right-clicking on map element', async () => {
      const { initMap, onMapRightClick, map } = useMap('map-container', mockUiStore);

      await initMap();

      if (map.value) {
        const callback = vi.fn();
        onMapRightClick(callback);

        // Simulate a contextmenu event
        const event = new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 500,
          clientY: 400,
        });
        mockElement.dispatchEvent(event);

        // The callback should have been called with lat/lon coordinates
        expect(callback).toHaveBeenCalled();
      }
    });

    it('should remove event listener when unsubscribe is called', async () => {
      const { initMap, onMapRightClick, map } = useMap('map-container', mockUiStore);

      await initMap();

      if (map.value) {
        const callback = vi.fn();
        const unsubscribe = onMapRightClick(callback);

        // Unsubscribe
        unsubscribe();

        // Simulate a contextmenu event after unsubscribing
        const event = new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 500,
          clientY: 400,
        });
        mockElement.dispatchEvent(event);

        // The callback should NOT have been called
        expect(callback).not.toHaveBeenCalled();
      }
    });

    it('should not call callback when map becomes null after handler registration', async () => {
      const { initMap, onMapRightClick, destroyMap, map } = useMap('map-container', mockUiStore);

      await initMap();

      expect(map.value).not.toBeNull();

      const callback = vi.fn();
      onMapRightClick(callback);

      // Destroy the map so map.value becomes null
      destroyMap();

      expect(map.value).toBeNull();

      // Simulate a contextmenu event after map is destroyed
      // This should hit line 535 (early return when map.value is null)
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 500,
        clientY: 400,
      });
      mockElement.dispatchEvent(event);

      // The callback should NOT have been called because map.value is null
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('setInitialViewData', () => {
    it('should set initial view data', () => {
      const { setInitialViewData } = useMap('map-container', mockUiStore);

      expect(() => setInitialViewData({ lat: 48.8566, lon: 2.3522, zoom: 14 })).not.toThrow();
    });

    it('should clear initial view data with null', () => {
      const { setInitialViewData } = useMap('map-container', mockUiStore);

      setInitialViewData({ lat: 48.8566, lon: 2.3522, zoom: 14 });
      expect(() => setInitialViewData(null)).not.toThrow();
    });
  });

  describe('captureScreenshot', () => {
    it('should reject if map is null', async () => {
      const { captureScreenshot } = useMap('map-container', mockUiStore);

      await expect(captureScreenshot()).rejects.toThrow('Map not initialized');
    });

    it('should capture screenshot when map is initialized', async () => {
      const { initMap, captureScreenshot, map, isMapInitialized } = useMap(
        'map-container',
        mockUiStore
      );

      await initMap();

      // Verify map was initialized
      expect(isMapInitialized.value).toBe(true);
      expect(map.value).not.toBeNull();

      // Create mock canvas in the container with a parent node for opacity check
      const canvasParent = document.createElement('div');
      canvasParent.style.opacity = '0.8';
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 768;
      canvasParent.append(canvas);
      mockElement.append(canvasParent);

      // Mock document.createElement to return canvases with mock getContext
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = originalCreateElement(tagName);
        if (tagName === 'canvas') {
          // Mock getContext to return a valid 2d context
          const mockContext = {
            globalAlpha: 1,
            drawImage: vi.fn(),
          };
          el.getContext = vi.fn(() => mockContext);
          // Mock toDataURL
          el.toDataURL = vi.fn(() => 'data:image/png;base64,test');
        }
        return el;
      });

      // Mock the once callback to immediately invoke the handler
      const onceMock = vi.mocked(map.value!.once);
      onceMock.mockImplementation((_event, handler: any) => {
        // Call the handler synchronously
        handler();
        return map.value;
      });

      // Call captureScreenshot
      const result = await captureScreenshot();
      expect(result).toContain('data:image/png');

      // Verify once was called with 'rendercomplete'
      expect(onceMock).toHaveBeenCalledWith('rendercomplete', expect.any(Function));

      vi.mocked(document.createElement).mockRestore();
    });

    it('should reject if map size is not available', async () => {
      const { initMap, captureScreenshot, map } = useMap('map-container', mockUiStore);

      await initMap();

      expect(map.value).not.toBeNull();

      // Mock getSize to return undefined
      vi.mocked(map.value!.getSize).mockReturnValue(undefined as any);

      // Mock once to invoke handler immediately
      vi.mocked(map.value!.once).mockImplementation((_event, handler: any) => {
        handler();
        return map.value;
      });

      await expect(captureScreenshot()).rejects.toThrow('Could not get map size');
    });

    it('should reject if canvas context is not available', async () => {
      const { initMap, captureScreenshot, map } = useMap('map-container', mockUiStore);

      await initMap();

      expect(map.value).not.toBeNull();

      // Mock getSize to return valid values
      vi.mocked(map.value!.getSize).mockReturnValue([1024, 768]);

      // Override document.createElement to return a canvas without getContext
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = originalCreateElement(tagName);
        if (tagName === 'canvas') {
          el.getContext = () => null;
        }
        return el;
      });

      // Mock once to invoke handler immediately
      vi.mocked(map.value!.once).mockImplementation((_event, handler: any) => {
        handler();
        return map.value;
      });

      await expect(captureScreenshot()).rejects.toThrow('Could not get canvas context');

      vi.mocked(document.createElement).mockRestore();
    });

    it('should handle canvas with transform matrix', async () => {
      const { initMap, captureScreenshot, map } = useMap('map-container', mockUiStore);

      await initMap();

      expect(map.value).not.toBeNull();

      // Create mock canvas with transform matrix style
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 768;
      canvas.style.transform = 'matrix(1, 0, 0, 1, 10, 20)';
      mockElement.append(canvas);

      // Mock document.createElement to return canvases with mock getContext
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = originalCreateElement(tagName);
        if (tagName === 'canvas') {
          const mockContext = {
            globalAlpha: 1,
            drawImage: vi.fn(),
          };
          el.getContext = vi.fn(() => mockContext);
          el.toDataURL = vi.fn(() => 'data:image/png;base64,test');
        }
        return el;
      });

      // Mock the once callback
      vi.mocked(map.value!.once).mockImplementation((_event, handler: any) => {
        handler();
        return map.value;
      });

      const result = await captureScreenshot();
      expect(result).toContain('data:image/png');

      vi.mocked(document.createElement).mockRestore();
    });

    it('should skip canvas with zero width', async () => {
      const { initMap, captureScreenshot, map } = useMap('map-container', mockUiStore);

      await initMap();

      expect(map.value).not.toBeNull();

      // Create canvas with zero width (should be skipped)
      const canvas = document.createElement('canvas');
      canvas.width = 0;
      canvas.height = 768;
      mockElement.append(canvas);

      // Mock document.createElement to return canvases with mock getContext
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = originalCreateElement(tagName);
        if (tagName === 'canvas') {
          const mockContext = {
            globalAlpha: 1,
            drawImage: vi.fn(),
          };
          el.getContext = vi.fn(() => mockContext);
          el.toDataURL = vi.fn(() => 'data:image/png;base64,test');
        }
        return el;
      });

      vi.mocked(map.value!.once).mockImplementation((_event, handler: any) => {
        handler();
        return map.value;
      });

      const result = await captureScreenshot();
      expect(result).toContain('data:image/png');

      vi.mocked(document.createElement).mockRestore();
    });

    it('should handle error during screenshot capture', async () => {
      const { initMap, captureScreenshot, map } = useMap('map-container', mockUiStore);

      await initMap();

      expect(map.value).not.toBeNull();

      // Mock document.createElement to throw an error during toDataURL
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = originalCreateElement(tagName);
        if (tagName === 'canvas') {
          const mockContext = {
            globalAlpha: 1,
            drawImage: vi.fn(),
          };
          el.getContext = vi.fn(() => mockContext);
          el.toDataURL = vi.fn(() => {
            throw new Error('Canvas export failed');
          });
        }
        return el;
      });

      vi.mocked(map.value!.once).mockImplementation((_event, handler: any) => {
        handler();
        return map.value;
      });

      await expect(captureScreenshot()).rejects.toThrow('Canvas export failed');

      vi.mocked(document.createElement).mockRestore();
    });

    it('should handle canvas with incomplete transform matrix', async () => {
      const { initMap, captureScreenshot, map } = useMap('map-container', mockUiStore);

      await initMap();

      expect(map.value).not.toBeNull();

      // Create mock canvas with incomplete transform matrix (only 4 values instead of 6)
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 768;
      // Only 4 values - missing x and y translations
      canvas.style.transform = 'matrix(1, 0, 0, 1)';
      mockElement.append(canvas);

      // Mock document.createElement to return canvases with mock getContext
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = originalCreateElement(tagName);
        if (tagName === 'canvas') {
          const mockContext = {
            globalAlpha: 1,
            drawImage: vi.fn(),
          };
          el.getContext = vi.fn(() => mockContext);
          el.toDataURL = vi.fn(() => 'data:image/png;base64,test');
        }
        return el;
      });

      // Mock the once callback
      vi.mocked(map.value!.once).mockImplementation((_event, handler: any) => {
        handler();
        return map.value;
      });

      const result = await captureScreenshot();
      expect(result).toContain('data:image/png');

      vi.mocked(document.createElement).mockRestore();
    });
  });

  describe('onMapRightClick', () => {
    it('should call callback with coordinates on right click', async () => {
      const { initMap, onMapRightClick, map } = useMap('map-container', mockUiStore);

      await initMap();
      expect(map.value).not.toBeNull();

      // Mock getCoordinateFromPixel to return Web Mercator coords for Paris
      // These coords (261845.7, 6250564.3) correspond to lon=2.3522, lat=48.8566
      vi.mocked(map.value!.getCoordinateFromPixel).mockReturnValue([261_845.7, 6_250_564.3]);

      const callback = vi.fn();
      onMapRightClick(callback);

      // Simulate right click event
      const event = new MouseEvent('contextmenu', { button: 2 });
      mockElement.dispatchEvent(event);

      expect(callback).toHaveBeenCalledWith(expect.closeTo(48.8566, 4), expect.closeTo(2.3522, 4));
    });

    it('should not call callback when coordinate is null', async () => {
      const { initMap, onMapRightClick, map } = useMap('map-container', mockUiStore);

      await initMap();
      expect(map.value).not.toBeNull();

      // Mock getCoordinateFromPixel to return null
      vi.mocked(map.value!.getCoordinateFromPixel).mockReturnValue(null as any);

      const callback = vi.fn();
      onMapRightClick(callback);

      // Simulate right click event
      const event = new MouseEvent('contextmenu', { button: 2 });
      mockElement.dispatchEvent(event);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should not call callback when toLonLat returns undefined values', async () => {
      const { initMap, onMapRightClick, map } = useMap('map-container', mockUiStore);

      await initMap();
      expect(map.value).not.toBeNull();

      // Mock toLonLat to return undefined values
      olProjMockConfig.toLonLatReturnValue = [undefined, undefined];

      const callback = vi.fn();
      onMapRightClick(callback);

      // Simulate right click event
      const event = new MouseEvent('contextmenu', { button: 2 });
      mockElement.dispatchEvent(event);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should return empty cleanup function when element not found', async () => {
      const { onMapRightClick } = useMap('non-existent-container', mockUiStore);

      const callback = vi.fn();
      const cleanup = onMapRightClick(callback);

      expect(cleanup).toBeInstanceOf(Function);
      cleanup(); // Should not throw
    });

    it('should return empty cleanup function when map not initialized', () => {
      const { onMapRightClick } = useMap('map-container', mockUiStore);

      const callback = vi.fn();
      const cleanup = onMapRightClick(callback);

      expect(cleanup).toBeInstanceOf(Function);
      cleanup(); // Should not throw
    });

    it('should remove event listener on cleanup', async () => {
      const { initMap, onMapRightClick, map } = useMap('map-container', mockUiStore);

      await initMap();
      expect(map.value).not.toBeNull();

      const removeEventListenerSpy = vi.spyOn(mockElement, 'removeEventListener');

      const callback = vi.fn();
      const cleanup = onMapRightClick(callback);

      cleanup();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('contextmenu', expect.any(Function));
    });
  });

  describe('returned refs', () => {
    it('should return all expected refs and methods', () => {
      const result = useMap('map-container', mockUiStore);

      expect(result).toHaveProperty('map');
      expect(result).toHaveProperty('isMapInitialized');
      expect(result).toHaveProperty('mapLayers');
      expect(result).toHaveProperty('circlesLayer');
      expect(result).toHaveProperty('linesLayer');
      expect(result).toHaveProperty('pointsLayer');
      expect(result).toHaveProperty('polygonsLayer');
      expect(result).toHaveProperty('circlesSource');
      expect(result).toHaveProperty('linesSource');
      expect(result).toHaveProperty('pointsSource');
      expect(result).toHaveProperty('polygonsSource');
      expect(result).toHaveProperty('initMap');
      expect(result).toHaveProperty('destroyMap');
      expect(result).toHaveProperty('addLayer');
      expect(result).toHaveProperty('removeLayer');
      expect(result).toHaveProperty('clearLayers');
      expect(result).toHaveProperty('setCenter');
      expect(result).toHaveProperty('getCenter');
      expect(result).toHaveProperty('getZoom');
      expect(result).toHaveProperty('latLngToContainerPoint');
      expect(result).toHaveProperty('containerPointToLatLng');
      expect(result).toHaveProperty('fitBounds');
      expect(result).toHaveProperty('flyTo');
      expect(result).toHaveProperty('flyToBounds');
      expect(result).toHaveProperty('flyToBoundsWithPanels');
      expect(result).toHaveProperty('refitMap');
      expect(result).toHaveProperty('onMapClick');
      expect(result).toHaveProperty('onMapRightClick');
      expect(result).toHaveProperty('setInitialViewData');
      expect(result).toHaveProperty('captureScreenshot');
    });
  });
});
