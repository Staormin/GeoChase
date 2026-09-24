import type { useMap } from '@/composables/useMap';
/**
 * Composable for keyboard navigation shortcuts (arrow keys, escape)
 */
import type View from 'ol/View';
import { getPointResolution } from 'ol/proj';
import { watch } from 'vue';
import { useNavigation } from '@/composables/useNavigation';
import { createRouteTraversal } from '@/services/routeGeometry';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

export function useKeyboardNavigation(
  mapContainer: ReturnType<typeof useMap>,
  onFreeHandEscape?: () => void,
  onRulerEscape?: () => void
) {
  const uiStore = useUIStore();
  const layersStore = useLayersStore();
  const navigation = useNavigation();
  let routeDistance = 0;
  let traversal: ReturnType<typeof createRouteTraversal> | undefined;
  const stopRouteWatch = watch(
    () => uiStore.navigatingElement,
    (element) => {
      routeDistance = 0;
      traversal = undefined;
      if (element?.type !== 'route') return;
      const route = layersStore.routes.find((route) => route.id === element.id);
      if (!route) return;
      traversal = createRouteTraversal(route.coordinates);
      const point = traversal.at(0);
      mapContainer.flyTo(point.lat, point.lon, Math.max(16, mapContainer.getZoom() ?? 16), {
        duration: 500,
      });
    }
  );

  function navigateRoute(event: KeyboardEvent, view: View, zoomLevel: number): boolean {
    if (!traversal || !['ArrowRight', 'ArrowLeft'].includes(event.key)) return false;
    event.preventDefault();
    const metersPerPixel = getPointResolution(
      view.getProjection(),
      view.getResolution() ?? 1,
      view.getCenter() ?? [0, 0],
      'm'
    );
    const step = Math.max(5, metersPerPixel * 120);
    routeDistance = Math.max(
      0,
      Math.min(traversal.length, routeDistance + (event.key === 'ArrowRight' ? step : -step))
    );
    const point = traversal.at(routeDistance);
    view.cancelAnimations();
    mapContainer.flyTo(point.lat, point.lon, zoomLevel, { duration: 250 });
    return true;
  }

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

    // Active tool (e.g. ruler) escape handling
    if (uiStore.tools.activeTool && event.key === 'Escape' && onRulerEscape) {
      event.preventDefault();
      onRulerEscape();
      return;
    }

    // Navigation mode keyboard handling
    const { navigatingElement } = uiStore;
    if (!navigatingElement) {
      return;
    }

    const map = mapContainer.map?.value;
    if (!map) {
      return;
    }

    const elementType = navigatingElement.type;
    const elementId = navigatingElement.id;
    const view = map.getView();
    const zoomLevel = view.getZoom() || 10;

    if (elementType === 'route' && navigateRoute(event, view, zoomLevel)) return;

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
    stopRouteWatch();
    document.removeEventListener('keydown', handleKeydown);
  };

  return {
    setup,
    cleanup,
    handleKeydown,
  };
}
