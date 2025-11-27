import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
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
        pdfPanelOpen: false,
        pdfPanelWidth: 500,
        pdfCurrentPage: 1,
        pdfZoomLevel: 1,
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

    it('should restore pdfPanelOpen when present in view data', () => {
      const setPdfPanelOpenSpy = vi.spyOn(uiStore, 'setPdfPanelOpen');
      const mockViewData = {
        topPanelOpen: true,
        sidePanelOpen: false,
        pdfPanelOpen: true,
        mapView: {
          lat: 51.5074,
          lon: -0.1278,
          zoom: 12,
        },
      };

      vi.spyOn(projectsStore, 'getViewData').mockReturnValue(mockViewData);

      viewDataSync.restoreViewData();

      // Should restore pdfPanelOpen
      expect(setPdfPanelOpenSpy).toHaveBeenCalledWith(true);
    });

    it('should restore pdfPanelWidth when present in view data', () => {
      const setPdfPanelWidthSpy = vi.spyOn(uiStore, 'setPdfPanelWidth');
      const mockViewData = {
        topPanelOpen: true,
        sidePanelOpen: false,
        pdfPanelWidth: 700,
        mapView: {
          lat: 51.5074,
          lon: -0.1278,
          zoom: 12,
        },
      };

      vi.spyOn(projectsStore, 'getViewData').mockReturnValue(mockViewData);

      viewDataSync.restoreViewData();

      // Should restore pdfPanelWidth
      expect(setPdfPanelWidthSpy).toHaveBeenCalledWith(700);
    });

    it('should restore pdfCurrentPage when present in view data', () => {
      const setPdfCurrentPageSpy = vi.spyOn(uiStore, 'setPdfCurrentPage');
      const mockViewData = {
        topPanelOpen: true,
        sidePanelOpen: false,
        pdfCurrentPage: 5,
        mapView: {
          lat: 51.5074,
          lon: -0.1278,
          zoom: 12,
        },
      };

      vi.spyOn(projectsStore, 'getViewData').mockReturnValue(mockViewData);

      viewDataSync.restoreViewData();

      // Should restore pdfCurrentPage
      expect(setPdfCurrentPageSpy).toHaveBeenCalledWith(5);
    });

    it('should restore pdfZoomLevel when present in view data', () => {
      const setPdfZoomLevelSpy = vi.spyOn(uiStore, 'setPdfZoomLevel');
      const mockViewData = {
        topPanelOpen: true,
        sidePanelOpen: false,
        pdfZoomLevel: 1.5,
        mapView: {
          lat: 51.5074,
          lon: -0.1278,
          zoom: 12,
        },
      };

      vi.spyOn(projectsStore, 'getViewData').mockReturnValue(mockViewData);

      viewDataSync.restoreViewData();

      // Should restore pdfZoomLevel
      expect(setPdfZoomLevelSpy).toHaveBeenCalledWith(1.5);
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

    it('should trigger saveViewData on center change after debounce', async () => {
      const updateViewDataSpy = vi.spyOn(projectsStore, 'updateViewData');
      viewDataSync.setupWatchers();

      // Get the center change callback
      const centerChangeCall = mockView.on.mock.calls.find(
        (call: any) => call[0] === 'change:center'
      );
      const centerChangeCallback = centerChangeCall[1];

      // Trigger the callback
      centerChangeCallback();

      // Before debounce timeout, updateViewData should not be called
      expect(updateViewDataSpy).not.toHaveBeenCalled();

      // Advance timers past debounce delay (500ms)
      vi.advanceTimersByTime(500);

      // Now it should have been called
      expect(updateViewDataSpy).toHaveBeenCalled();
    });

    it('should trigger saveViewData on resolution change after debounce', async () => {
      const updateViewDataSpy = vi.spyOn(projectsStore, 'updateViewData');
      viewDataSync.setupWatchers();

      // Get the resolution change callback
      const resolutionChangeCall = mockView.on.mock.calls.find(
        (call: any) => call[0] === 'change:resolution'
      );
      const resolutionChangeCallback = resolutionChangeCall[1];

      // Trigger the callback
      resolutionChangeCallback();

      // Advance timers past debounce delay (500ms)
      vi.advanceTimersByTime(500);

      expect(updateViewDataSpy).toHaveBeenCalled();
    });

    it('should trigger saveViewData on sidebar state change after debounce', async () => {
      const updateViewDataSpy = vi.spyOn(projectsStore, 'updateViewData');
      viewDataSync.setupWatchers();

      // Change sidebar state
      uiStore.sidebarOpen = !uiStore.sidebarOpen;

      // Wait for Vue reactivity to process the change
      await nextTick();

      // Advance timers past debounce delay (500ms)
      vi.advanceTimersByTime(500);

      expect(updateViewDataSpy).toHaveBeenCalled();
    });

    it('should trigger saveViewData on pdfPanelOpen change after debounce', async () => {
      const updateViewDataSpy = vi.spyOn(projectsStore, 'updateViewData');
      viewDataSync.setupWatchers();

      // Change pdfPanelOpen state
      uiStore.setPdfPanelOpen(true);

      // Wait for Vue reactivity to process the change
      await nextTick();

      // Advance timers past debounce delay (500ms)
      vi.advanceTimersByTime(500);

      expect(updateViewDataSpy).toHaveBeenCalled();
    });

    it('should trigger saveViewData on pdfPanelWidth change after debounce', async () => {
      const updateViewDataSpy = vi.spyOn(projectsStore, 'updateViewData');
      viewDataSync.setupWatchers();

      // Change pdfPanelWidth state
      uiStore.setPdfPanelWidth(600);

      // Wait for Vue reactivity to process the change
      await nextTick();

      // Advance timers past debounce delay (500ms)
      vi.advanceTimersByTime(500);

      expect(updateViewDataSpy).toHaveBeenCalled();
    });

    it('should trigger saveViewData on pdfCurrentPage change after debounce', async () => {
      const updateViewDataSpy = vi.spyOn(projectsStore, 'updateViewData');
      viewDataSync.setupWatchers();

      // Change pdfCurrentPage state
      uiStore.setPdfCurrentPage(3);

      // Wait for Vue reactivity to process the change
      await nextTick();

      // Advance timers past debounce delay (500ms)
      vi.advanceTimersByTime(500);

      expect(updateViewDataSpy).toHaveBeenCalled();
    });

    it('should trigger saveViewData on pdfZoomLevel change after debounce', async () => {
      const updateViewDataSpy = vi.spyOn(projectsStore, 'updateViewData');
      viewDataSync.setupWatchers();

      // Change pdfZoomLevel state
      uiStore.setPdfZoomLevel(1.5);

      // Wait for Vue reactivity to process the change
      await nextTick();

      // Advance timers past debounce delay (500ms)
      vi.advanceTimersByTime(500);

      expect(updateViewDataSpy).toHaveBeenCalled();
    });

    it('should restore view data when active project changes', async () => {
      const mockViewData = {
        topPanelOpen: false,
        sidePanelOpen: true,
        mapView: {
          lat: 40.7128,
          lon: -74.006,
          zoom: 10,
        },
      };
      vi.spyOn(projectsStore, 'getViewData').mockReturnValue(mockViewData);

      viewDataSync.setupWatchers();

      // Change active project
      projectsStore.activeProjectId = 'new-project-id';

      // Wait for Vue reactivity to process the change
      await nextTick();

      // Advance timers for the setTimeout(100) in the watch callback
      vi.advanceTimersByTime(100);

      // Should have restored view data
      expect(mockView.setCenter).toHaveBeenCalledWith([
        mockViewData.mapView.lon,
        mockViewData.mapView.lat,
      ]);
      expect(mockView.setZoom).toHaveBeenCalledWith(10);
    });
  });

  describe('Debounce behavior', () => {
    it('should debounce multiple rapid calls', () => {
      const updateViewDataSpy = vi.spyOn(projectsStore, 'updateViewData');
      viewDataSync.setupWatchers();

      // Get the center change callback
      const centerChangeCall = mockView.on.mock.calls.find(
        (call: any) => call[0] === 'change:center'
      );
      const centerChangeCallback = centerChangeCall[1];

      // Trigger multiple rapid calls
      centerChangeCallback();
      vi.advanceTimersByTime(100);
      centerChangeCallback();
      vi.advanceTimersByTime(100);
      centerChangeCallback();

      // Should not be called yet (debounce not complete)
      expect(updateViewDataSpy).not.toHaveBeenCalled();

      // Complete the debounce
      vi.advanceTimersByTime(500);

      // Should be called only once
      expect(updateViewDataSpy).toHaveBeenCalledTimes(1);
    });
  });
});
