/**
 * Composable for auto-saving project data
 */

import { getCurrentScope, onScopeDispose, watch } from 'vue';
import { useLayersStore } from '@/stores/layers';
import { useProjectsStore } from '@/stores/projects';
import { debounce } from '@/utils/debounce';

export function useAutoSave() {
  const projectsStore = useProjectsStore();
  const layersStore = useLayersStore();

  const debouncedAutoSave = debounce(() => {
    if (projectsStore.activeProjectId) {
      projectsStore.autoSaveActiveProject(layersStore.exportLayers());
    }
  }, 500);

  const flushAutoSave = () => debouncedAutoSave.flush();
  window.addEventListener('pagehide', flushAutoSave);

  if (getCurrentScope()) {
    onScopeDispose(() => {
      window.removeEventListener('pagehide', flushAutoSave);
      debouncedAutoSave.flush();
    });
  }

  // Auto-save on layers change
  watch(
    [
      () => layersStore.images,
      () => layersStore.routes,
      () => layersStore.circles,
      () => layersStore.lineSegments,
      () => layersStore.points,
      () => layersStore.polygons,
      () => layersStore.notes,
      () => layersStore.elementGroups,
    ],
    debouncedAutoSave,
    { deep: true }
  );

  return {
    debouncedAutoSave,
  };
}
