import type { useMap } from '@/composables/useMap';
import Interaction from 'ol/interaction/Interaction';
import { ref, watch } from 'vue';
import { useUIStore } from '@/stores/ui';
import { useMapCursor } from './useMapCursor';

export interface MapElementSelection {
  elementType: 'route' | 'circle' | 'lineSegment' | 'point' | 'polygon';
  elementId: string;
  position: [number, number];
}

export function useMapEventHandlers(mapContainer: ReturnType<typeof useMap>) {
  const uiStore = useUIStore();
  const contextMenu = ref<MapElementSelection | null>(null);
  const setCursor = useMapCursor(mapContainer, 0);

  const setup = () => {
    const map = mapContainer.map.value;
    if (!map) return () => {};
    const available = () => uiStore.canInteractWithLines && !uiStore.intersectionLineEdit;
    const sources = [
      ['route', mapContainer.routesSource],
      ['circle', mapContainer.circlesSource],
      ['lineSegment', mapContainer.linesSource],
      ['point', mapContainer.pointsSource],
      ['polygon', mapContainer.polygonsSource],
    ] as const;
    function elementAt(pixel: number[]) {
      if (!available()) return;
      return map!.forEachFeatureAtPixel(
        pixel,
        (feature) => {
          const id = feature.getId();
          if (typeof id !== 'string') return;
          for (const [elementType, source] of sources) {
            if (
              source.value?.getFeatureById(id) === feature &&
              uiStore.isElementVisible(elementType, id)
            ) {
              return { elementType, elementId: id };
            }
          }
        },
        { hitTolerance: 6 }
      );
    }
    const clearHover = () => setCursor(null);
    const interaction = new Interaction({
      handleEvent(event) {
        if (event.type === 'pointermove') {
          setCursor(!event.dragging && elementAt(event.pixel) ? 'pointer' : null);
        }
        if (
          event.type === 'click' &&
          'button' in event.originalEvent &&
          event.originalEvent.button === 0
        ) {
          const element = elementAt(event.pixel);
          if (element) {
            const rect = map!.getViewport().getBoundingClientRect();
            contextMenu.value = {
              ...element,
              position: [rect.left + event.pixel[0]!, rect.top + event.pixel[1]!],
            };
            clearHover();
            return false;
          }
        }
        return true;
      },
    });
    map.addInteraction(interaction);
    map.getViewport().addEventListener('pointerleave', clearHover);
    map.on('movestart', clearHover);
    const stopWatch = watch(() => [available(), uiStore.elementVisibility], clearHover, {
      deep: true,
    });
    const unsubscribeRightClick = mapContainer.onMapRightClick((lat, lon) => {
      uiStore.startCreating('point', { lat, lon });
      uiStore.openModal('pointModal');
    });
    return () => {
      unsubscribeRightClick();
      stopWatch();
      clearHover();
      map.removeInteraction(interaction);
      map.getViewport().removeEventListener('pointerleave', clearHover);
      map.un('movestart', clearHover);
    };
  };

  return { setup, contextMenu };
}
