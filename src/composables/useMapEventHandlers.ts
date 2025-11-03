import type { useMap } from '@/composables/useMap';
import { useUIStore } from '@/stores/ui';

/**
 * Composable for map event handlers (right-click, etc.)
 */
export function useMapEventHandlers(mapContainer: ReturnType<typeof useMap>) {
  const uiStore = useUIStore();

  const setup = () => {
    // Setup right-click to open coordinates modal with pre-filled coordinates
    return mapContainer.onMapRightClick((lat, lon) => {
      // Pre-fill the coordinates field in the modal
      const coordinatesModalForm = {
        name: '',
        coordinates: `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
      };

      // Store form data and open modal
      uiStore.setCoordinatesFormData(coordinatesModalForm);
      uiStore.openModal('coordinatesModal');
    });
  };

  return {
    setup,
  };
}
