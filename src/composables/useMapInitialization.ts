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
          drawing.redrawAllElements();

          console.log(`Project "${activeProject.name}" loaded successfully`);
        } catch (error) {
          console.error('Error loading project:', error);
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
  } catch (error) {
    console.error('Fatal error during app initialization:', error);
    uiStore.addToast(
      'Failed to initialize the application. Please refresh the page.',
      'error',
      10_000
    );
  }
}
