import type { useMap } from '@/composables/useMap';
import { useNavigation } from '@/composables/useNavigation';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

/**
 * Composable for keyboard navigation shortcuts (arrow keys, escape)
 */
export function useKeyboardNavigation(
  mapContainer: ReturnType<typeof useMap>,
  onFreeHandEscape?: () => void
) {
  const uiStore = useUIStore();
  const layersStore = useLayersStore();
  const navigation = useNavigation();

  const handleKeydown = (event: KeyboardEvent) => {
    // View capture escape handling
    if (uiStore.viewCaptureState.isCapturing && event.key === 'Escape') {
      event.preventDefault();
      uiStore.stopViewCapture();
      uiStore.openModal('animationModal'); // Re-open the modal
      return;
    }

    // Free hand drawing escape handling
    if (uiStore.freeHandDrawing.isDrawing && event.key === 'Escape' && onFreeHandEscape) {
      event.preventDefault();
      onFreeHandEscape();
      return;
    }

    // Navigation mode keyboard handling
    if (!uiStore.navigatingElement) return;

    const { navigatingElement } = uiStore;
    if (!navigatingElement) return;

    const map = mapContainer.map?.value;
    if (!map) return;

    const elementType = navigatingElement.type;
    const elementId = navigatingElement.id;
    const view = map.getView();
    const zoomLevel = view.getZoom() || 10;

    switch (event.key) {
      case 'ArrowRight': {
        event.preventDefault();

        if (elementType === 'circle') {
          const circle = layersStore.circles.find((c) => c.id === elementId);
          if (circle) {
            navigation.navigateCircleForward(circle, zoomLevel);
            const coords = navigation.getCircleNavigationCoords(circle);
            if (mapContainer.flyTo) {
              mapContainer.flyTo(coords.lat, coords.lon, zoomLevel, { duration: 500 });
            }
          }
        } else if (elementType === 'lineSegment') {
          const segment = layersStore.lineSegments.find((s) => s.id === elementId);
          if (segment) {
            navigation.navigateSegmentForward(segment, zoomLevel);
            const coords = navigation.getSegmentNavigationCoords(segment);
            if (mapContainer.flyTo) {
              mapContainer.flyTo(coords.lat, coords.lon, zoomLevel, { duration: 500 });
            }
          }
        }

        break;
      }
      case 'ArrowLeft': {
        event.preventDefault();

        if (elementType === 'circle') {
          const circle = layersStore.circles.find((c) => c.id === elementId);
          if (circle) {
            navigation.navigateCircleBackward(circle, zoomLevel);
            const coords = navigation.getCircleNavigationCoords(circle);
            if (mapContainer.flyTo) {
              mapContainer.flyTo(coords.lat, coords.lon, zoomLevel, { duration: 500 });
            }
          }
        } else if (elementType === 'lineSegment') {
          const segment = layersStore.lineSegments.find((s) => s.id === elementId);
          if (segment) {
            navigation.navigateSegmentBackward(segment, zoomLevel);
            const coords = navigation.getSegmentNavigationCoords(segment);
            if (mapContainer.flyTo) {
              mapContainer.flyTo(coords.lat, coords.lon, zoomLevel, { duration: 500 });
            }
          }
        }

        break;
      }
      case 'Escape': {
        event.preventDefault();
        uiStore.stopNavigating();

        break;
      }
      // No default
    }
  };

  const setup = () => {
    document.addEventListener('keydown', handleKeydown);
  };

  const cleanup = () => {
    document.removeEventListener('keydown', handleKeydown);
  };

  return {
    setup,
    cleanup,
    handleKeydown,
  };
}
