import type { Ref } from 'vue';
import type { useDrawing } from '@/composables/useDrawing';
import type { useMap } from '@/composables/useMap';
import { useNoteTooltips } from '@/composables/useNoteTooltips';
import { useCoordinatesStore } from '@/stores/coordinates';
import { useLayersStore } from '@/stores/layers';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';

/**
 * Composable for map initialization and project loading
 */
export async function useMapInitialization(
  mapContainer: ReturnType<typeof useMap>,
  drawing: ReturnType<typeof useDrawing>,
  noteTooltipsRef: Ref<ReturnType<typeof useNoteTooltips> | null>
) {
  const uiStore = useUIStore();
  const projectsStore = useProjectsStore();
  const layersStore = useLayersStore();
  const coordinatesStore = useCoordinatesStore();

  try {
    // Set initial view data from saved project before initializing map
    const activeProject = projectsStore.activeProject;
    if (activeProject?.viewData?.mapView) {
      mapContainer.setInitialViewData(activeProject.viewData.mapView);
      // Also restore panel states before map initialization
      if (uiStore) {
        uiStore.topBarOpen = activeProject.viewData.topPanelOpen;
        uiStore.sidebarOpen = activeProject.viewData.sidePanelOpen;
      }
    }

    await mapContainer.initMap();

    // Initialize note tooltips after map is ready
    noteTooltipsRef.value = useNoteTooltips(mapContainer);

    // Projects are already loaded in store initialization
    // Check if any projects exist
    if (projectsStore.projectCount === 0) {
      // Prompt for new project if none exist
      uiStore.openModal('newProjectModal');
    } else if (projectsStore.activeProjectId) {
      // Load the active project
      const activeProject = projectsStore.activeProject;
      if (activeProject) {
        try {
          // Load project data into stores (preserves IDs)
          layersStore.loadLayers({
            circles: activeProject.data.circles,
            lineSegments: activeProject.data.lineSegments,
            points: activeProject.data.points,
            polygons: activeProject.data.polygons || [],
            notes: activeProject.data.notes || [],
          });
          coordinatesStore.loadCoordinates(activeProject.data.savedCoordinates || []);

          // Redraw all elements on the map
          // Skip auto-fly if we have saved view data (will be restored later)
          const hasViewData = activeProject.viewData?.mapView !== undefined;
          if (hasViewData) {
            // Store a flag to skip auto-fly in redrawAllElements
            (mapContainer as any).skipAutoFly = true;
          }
          drawing.redrawAllElements();
          if (hasViewData) {
            (mapContainer as any).skipAutoFly = false;
          }
        } catch {
          uiStore.addToast(
            `Failed to load project "${activeProject.name}". Some elements may not display correctly.`,
            'error',
            5000
          );

          // Clear failed project data to avoid corrupted state
          layersStore.clearLayers();
          coordinatesStore.clearCoordinates();
          projectsStore.setActiveProject(null);
        }
      }
    }
  } catch {
    uiStore.addToast(
      'Failed to initialize the application. Please refresh the page.',
      'error',
      10_000
    );
  }
}
