import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useMapInitialization } from '@/composables/useMapInitialization';
import { useCoordinatesStore } from '@/stores/coordinates';
import { useLayersStore } from '@/stores/layers';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';

// Mock useNoteTooltips
vi.mock('@/composables/useNoteTooltips', () => ({
  useNoteTooltips: vi.fn(() => ({
    updateTooltips: vi.fn(),
    cleanup: vi.fn(),
  })),
}));

// Mock isLanguageSet to return true (language is always set in tests)
vi.mock('@/plugins/i18n', () => ({
  isLanguageSet: vi.fn(() => true),
}));

describe('useMapInitialization', () => {
  let pinia: any;
  let projectsStore: any;
  let uiStore: any;
  let layersStore: any;
  let coordinatesStore: any;
  let mockMapContainer: any;
  let mockDrawing: any;
  let noteTooltipsRef: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    projectsStore = useProjectsStore();
    uiStore = useUIStore();
    layersStore = useLayersStore();
    coordinatesStore = useCoordinatesStore();

    // Mock map container
    mockMapContainer = {
      setInitialViewData: vi.fn(),
      initMap: vi.fn(() => Promise.resolve()),
    };

    // Mock drawing
    mockDrawing = {
      redrawAllElements: vi.fn(),
    };

    // Create ref for note tooltips
    noteTooltipsRef = ref(null);

    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Initial Map Setup', () => {
    it('should initialize map without projects', async () => {
      const openModalSpy = vi.spyOn(uiStore, 'openModal');

      await useMapInitialization(mockMapContainer, mockDrawing, noteTooltipsRef);

      expect(mockMapContainer.initMap).toHaveBeenCalled();
      expect(openModalSpy).toHaveBeenCalledWith('newProjectModal');
      expect(noteTooltipsRef.value).toBeTruthy();
    });

    it('should restore view data from active project', async () => {
      const mockViewData = {
        mapView: {
          lat: 48.8566,
          lon: 2.3522,
          zoom: 12,
        },
        topPanelOpen: true,
        sidePanelOpen: false,
      };

      // Create a test project with view data
      projectsStore.createAndSwitchProject('Test Project', {
        circles: [],
        lineSegments: [],
        points: [],
        polygons: [],
        savedCoordinates: [],
        notes: [],
      });
      projectsStore.updateViewData(mockViewData);

      await useMapInitialization(mockMapContainer, mockDrawing, noteTooltipsRef);

      expect(mockMapContainer.setInitialViewData).toHaveBeenCalledWith(mockViewData.mapView);
      expect(uiStore.topBarOpen).toBe(true);
      expect(uiStore.sidebarOpen).toBe(false);
    });

    it('should initialize map without view data', async () => {
      projectsStore.createAndSwitchProject('Test Project', {
        circles: [],
        lineSegments: [],
        points: [],
        polygons: [],
        savedCoordinates: [],
        notes: [],
      });

      await useMapInitialization(mockMapContainer, mockDrawing, noteTooltipsRef);

      expect(mockMapContainer.setInitialViewData).not.toHaveBeenCalled();
      expect(mockMapContainer.initMap).toHaveBeenCalled();
    });
  });

  describe('Project Loading', () => {
    it('should load active project with all data', async () => {
      const loadLayersSpy = vi.spyOn(layersStore, 'loadLayers');
      const loadCoordinatesSpy = vi.spyOn(coordinatesStore, 'loadCoordinates');

      // Create project with data
      const projectData = {
        circles: [
          {
            id: 'c1',
            name: 'Circle 1',
            center: { lat: 48, lon: 2 },
            radius: 10,
            color: '#ff0000',
          },
        ],
        lineSegments: [
          {
            id: 'l1',
            name: 'Line 1',
            center: { lat: 48, lon: 2 },
            endpoint: { lat: 49, lon: 3 },
            mode: 'coordinate',
            color: '#00ff00',
          },
        ],
        points: [{ id: 'p1', name: 'Point 1', coordinates: { lat: 48, lon: 2 } }],
        polygons: [
          {
            id: 'poly1',
            name: 'Polygon 1',
            points: [
              { lat: 48, lon: 2 },
              { lat: 49, lon: 2 },
              { lat: 49, lon: 3 },
            ],
          },
        ],
        notes: [
          {
            id: 'n1',
            title: 'Note 1',
            content: 'This is a test note',
            linkedElementType: 'circle',
            linkedElementId: 'c1',
          },
        ],
        savedCoordinates: [{ id: 'coord1', name: 'Coord 1', lat: 48, lon: 2 }],
      };

      // Manually set up the project in the store
      projectsStore.projects.push({
        id: 'test-id',
        name: 'Test Project',
        data: projectData,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      projectsStore.activeProjectId = 'test-id';

      await useMapInitialization(mockMapContainer, mockDrawing, noteTooltipsRef);

      expect(loadLayersSpy).toHaveBeenCalledWith({
        circles: projectData.circles,
        lineSegments: projectData.lineSegments,
        points: projectData.points,
        polygons: projectData.polygons,
        notes: projectData.notes,
      });
      expect(loadCoordinatesSpy).toHaveBeenCalledWith(projectData.savedCoordinates);
      expect(mockDrawing.redrawAllElements).toHaveBeenCalled();
      // Project loaded successfully (console logging removed)
    });

    it('should skip auto-fly when project has view data', async () => {
      // Manually set up project with view data
      projectsStore.projects.push({
        id: 'test-id',
        name: 'Test Project',
        data: {
          circles: [],
          lineSegments: [],
          points: [],
          polygons: [],
          notes: [],
          savedCoordinates: [],
        },
        viewData: {
          mapView: { lat: 48, lon: 2, zoom: 12 },
          topPanelOpen: true,
          sidePanelOpen: false,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      projectsStore.activeProjectId = 'test-id';

      await useMapInitialization(mockMapContainer, mockDrawing, noteTooltipsRef);

      expect(mockMapContainer.skipAutoFly).toBe(false); // Should be reset after redraw
      expect(mockDrawing.redrawAllElements).toHaveBeenCalled();
    });

    it('should handle project without polygons and notes', async () => {
      const loadLayersSpy = vi.spyOn(layersStore, 'loadLayers');

      const projectData = {
        circles: [],
        lineSegments: [],
        points: [],
        savedCoordinates: [],
      };

      // Manually set up project without polygons and notes
      projectsStore.projects.push({
        id: 'test-id',
        name: 'Test Project',
        data: projectData,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      projectsStore.activeProjectId = 'test-id';

      await useMapInitialization(mockMapContainer, mockDrawing, noteTooltipsRef);

      expect(loadLayersSpy).toHaveBeenCalledWith({
        circles: [],
        lineSegments: [],
        points: [],
        polygons: [],
        notes: [],
      });
    });

    it('should handle project loading error', async () => {
      const addToastSpy = vi.spyOn(uiStore, 'addToast');
      const clearLayersSpy = vi.spyOn(layersStore, 'clearLayers');
      const clearCoordinatesSpy = vi.spyOn(coordinatesStore, 'clearCoordinates');
      const setActiveProjectSpy = vi.spyOn(projectsStore, 'setActiveProject');

      // Manually set up project
      projectsStore.projects.push({
        id: 'test-id',
        name: 'Test Project',
        data: {
          circles: [],
          lineSegments: [],
          points: [],
          polygons: [],
          notes: [],
          savedCoordinates: [],
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      projectsStore.activeProjectId = 'test-id';

      // Make loadLayers throw an error
      vi.spyOn(layersStore, 'loadLayers').mockImplementation(() => {
        throw new Error('Load failed');
      });

      await useMapInitialization(mockMapContainer, mockDrawing, noteTooltipsRef);

      // Error handling (console logging removed)
      expect(addToastSpy).toHaveBeenCalledWith(
        'Failed to load project "Test Project". Some elements may not display correctly.',
        'error',
        5000
      );
      expect(clearLayersSpy).toHaveBeenCalled();
      expect(clearCoordinatesSpy).toHaveBeenCalled();
      expect(setActiveProjectSpy).toHaveBeenCalledWith(null);
    });

    it('should handle empty active project', async () => {
      // Set active project ID but no actual project
      projectsStore.activeProjectId = 'non-existent';

      await useMapInitialization(mockMapContainer, mockDrawing, noteTooltipsRef);

      // Should not throw, just initialize map
      expect(mockMapContainer.initMap).toHaveBeenCalled();
      expect(mockDrawing.redrawAllElements).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle fatal initialization error', async () => {
      const addToastSpy = vi.spyOn(uiStore, 'addToast');

      mockMapContainer.initMap = vi.fn(() => Promise.reject(new Error('Map init failed')));

      await useMapInitialization(mockMapContainer, mockDrawing, noteTooltipsRef);

      // Fatal error handling (console logging removed)
      expect(addToastSpy).toHaveBeenCalledWith(
        'Failed to initialize the application. Please refresh the page.',
        'error',
        10_000
      );
    });

    it('should handle error in setInitialViewData', async () => {
      const addToastSpy = vi.spyOn(uiStore, 'addToast');

      // Manually set up project with view data
      projectsStore.projects.push({
        id: 'test-id',
        name: 'Test Project',
        data: {
          circles: [],
          lineSegments: [],
          points: [],
          polygons: [],
          notes: [],
          savedCoordinates: [],
        },
        viewData: {
          mapView: { lat: 48, lon: 2, zoom: 12 },
          topPanelOpen: true,
          sidePanelOpen: false,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      projectsStore.activeProjectId = 'test-id';

      mockMapContainer.setInitialViewData = vi.fn(() => {
        throw new Error('View data error');
      });

      await useMapInitialization(mockMapContainer, mockDrawing, noteTooltipsRef);

      // Fatal error handling (console logging removed)
      expect(addToastSpy).toHaveBeenCalledWith(
        'Failed to initialize the application. Please refresh the page.',
        'error',
        10_000
      );
    });
  });

  describe('Note Tooltips', () => {
    it('should initialize note tooltips after map is ready', async () => {
      await useMapInitialization(mockMapContainer, mockDrawing, noteTooltipsRef);

      expect(noteTooltipsRef.value).toBeTruthy();
      expect(noteTooltipsRef.value).toHaveProperty('updateTooltips');
      expect(noteTooltipsRef.value).toHaveProperty('cleanup');
    });
  });
});
