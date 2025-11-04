import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useViewDataSync } from '@/composables/useViewDataSync';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';

// Mock ol/proj
vi.mock('ol/proj', () => ({
  fromLonLat: vi.fn((coords) => coords), // Simple pass-through for testing
}));

describe('useViewDataSync', () => {
  let pinia: any;
  let projectsStore: any;
  let uiStore: any;
  let mockMapContainer: any;
  let viewDataSync: any;
  let mockView: any;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    projectsStore = useProjectsStore();
    uiStore = useUIStore();

    // Reset timers
    vi.useFakeTimers();

    // Create mock view
    mockView = {
      setCenter: vi.fn(),
      setZoom: vi.fn(),
      on: vi.fn(),
    };

    // Create mock map container
    mockMapContainer = {
      map: ref({
        getView: vi.fn(() => mockView),
        updateSize: vi.fn(),
      }),
      getCenter: vi.fn(() => ({ lat: 48.8566, lon: 2.3522 })),
      getZoom: vi.fn(() => 15),
    };

    // Initialize view data sync
    viewDataSync = useViewDataSync(mockMapContainer);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('Save View Data', () => {
    it('should save current view data to project store', () => {
      const updateViewDataSpy = vi.spyOn(projectsStore, 'updateViewData');

      // Set UI state
      uiStore.topBarOpen = true;
      uiStore.sidebarOpen = false;

      // Save view data
      viewDataSync.saveViewData();

      expect(updateViewDataSpy).toHaveBeenCalledWith({
        topPanelOpen: true,
        sidePanelOpen: false,
        mapView: {
          lat: 48.8566,
          lon: 2.3522,
          zoom: 15,
        },
      });
    });

    it('should handle missing map gracefully', () => {
      const updateViewDataSpy = vi.spyOn(projectsStore, 'updateViewData');

      mockMapContainer.map.value = null;

      viewDataSync.saveViewData();

      expect(updateViewDataSpy).not.toHaveBeenCalled();
    });

    it('should handle missing center gracefully', () => {
      const updateViewDataSpy = vi.spyOn(projectsStore, 'updateViewData');

      mockMapContainer.getCenter = vi.fn(() => null);

      viewDataSync.saveViewData();

      expect(updateViewDataSpy).not.toHaveBeenCalled();
    });
  });

  describe('Restore View Data', () => {
    it('should restore view data from project store', () => {
      const mockViewData = {
        topPanelOpen: true,
        sidePanelOpen: false,
        mapView: {
          lat: 51.5074,
          lon: -0.1278,
          zoom: 12,
        },
      };

      vi.spyOn(projectsStore, 'getViewData').mockReturnValue(mockViewData);

      viewDataSync.restoreViewData();

      // Should restore UI state
      expect(uiStore.topBarOpen).toBe(true);
      expect(uiStore.sidebarOpen).toBe(false);

      // Should update map size
      expect(mockMapContainer.map.value.updateSize).toHaveBeenCalled();

      // Should restore map view
      expect(mockView.setCenter).toHaveBeenCalledWith([
        mockViewData.mapView.lon,
        mockViewData.mapView.lat,
      ]);
      expect(mockView.setZoom).toHaveBeenCalledWith(12);
    });

    it('should handle missing view data', () => {
      vi.spyOn(projectsStore, 'getViewData').mockReturnValue(null);

      viewDataSync.restoreViewData();

      expect(mockView.setCenter).not.toHaveBeenCalled();
      expect(mockView.setZoom).not.toHaveBeenCalled();
    });

    it('should handle missing map view data', () => {
      vi.spyOn(projectsStore, 'getViewData').mockReturnValue({
        topPanelOpen: true,
        sidePanelOpen: false,
        mapView: null,
      });

      viewDataSync.restoreViewData();

      expect(mockView.setCenter).not.toHaveBeenCalled();
      expect(mockView.setZoom).not.toHaveBeenCalled();
    });

    it('should handle missing map', () => {
      vi.spyOn(projectsStore, 'getViewData').mockReturnValue({
        topPanelOpen: true,
        sidePanelOpen: false,
        mapView: {
          lat: 51.5074,
          lon: -0.1278,
          zoom: 12,
        },
      });

      mockMapContainer.map.value = null;

      viewDataSync.restoreViewData();

      // Should not throw
      expect(() => viewDataSync.restoreViewData()).not.toThrow();
    });
  });

  describe('Setup Watchers', () => {
    it('should register view event listeners', () => {
      viewDataSync.setupWatchers();

      // Should register center and resolution change listeners
      expect(mockView.on).toHaveBeenCalledWith('change:center', expect.any(Function));
      expect(mockView.on).toHaveBeenCalledWith('change:resolution', expect.any(Function));
    });

    it('should handle missing map when setting up watchers', () => {
      mockMapContainer.map.value = null;

      // Should not throw
      expect(() => viewDataSync.setupWatchers()).not.toThrow();
    });
  });
});
