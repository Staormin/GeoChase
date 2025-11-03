import { watch } from 'vue';
import { useCoordinatesStore } from '@/stores/coordinates';
import { useLayersStore } from '@/stores/layers';
import { useProjectsStore } from '@/stores/projects';

/**
 * Composable for auto-saving project data
 */
export function useAutoSave() {
  const projectsStore = useProjectsStore();
  const layersStore = useLayersStore();
  const coordinatesStore = useCoordinatesStore();

  // Debounce autosave to avoid excessive writes
  let autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;

  function debouncedAutoSave() {
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }

    autoSaveTimeout = setTimeout(() => {
      if (projectsStore.activeProjectId) {
        projectsStore.autoSaveActiveProject({
          circles: layersStore.circles,
          lineSegments: layersStore.lineSegments,
          points: layersStore.points,
          polygons: layersStore.polygons,
          savedCoordinates: coordinatesStore.savedCoordinates,
          notes: layersStore.notes,
        });
      }
    }, 500); // 500ms debounce
  }

  // Auto-save on layers or coordinates change
  watch(
    [
      () => layersStore.circles,
      () => layersStore.lineSegments,
      () => layersStore.points,
      () => layersStore.polygons,
      () => coordinatesStore.savedCoordinates,
      () => layersStore.notes,
    ],
    debouncedAutoSave,
    { deep: true }
  );

  return {
    debouncedAutoSave,
  };
}
