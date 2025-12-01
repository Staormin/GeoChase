import type { useMap } from '@/composables/useMap';
import { useUIStore } from '@/stores/ui';

/**
 * Composable for map event handlers (right-click, etc.)
 */
export function useMapEventHandlers(mapContainer: ReturnType<typeof useMap>) {
  const uiStore = useUIStore();

  const setup = () => {
    // Setup right-click to open point modal with pre-filled coordinates
    return mapContainer.onMapRightClick((lat, lon) => {
      // Pre-fill the coordinates and start creating a point
      uiStore.startCreating('point', { lat, lon });
      uiStore.openModal('pointModal');
    });
  };

  return {
    setup,
  };
}
