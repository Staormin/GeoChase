import type { Ref } from 'vue';
import type { useDrawing } from '@/composables/useDrawing';
import type { useMap } from '@/composables/useMap';
import type { useNoteTooltips } from '@/composables/useNoteTooltips';
import { useFreeHandDrawing } from '@/composables/useFreeHandDrawing';
import { useKeyboardNavigation } from '@/composables/useKeyboardNavigation';
import { useMapEventHandlers } from '@/composables/useMapEventHandlers';
import { useMapInitialization } from '@/composables/useMapInitialization';

interface CursorTooltipData {
  visible: boolean;
  x: number;
  y: number;
  distance: string;
  azimuth: string;
}

/**
 * Main app setup composable that orchestrates all initialization and event handlers
 */
export function useAppSetup(
  mapContainer: ReturnType<typeof useMap>,
  drawing: ReturnType<typeof useDrawing>,
  noteTooltipsRef: Ref<ReturnType<typeof useNoteTooltips> | null>,
  cursorTooltip: Ref<CursorTooltipData>
) {
  // Initialize sub-composables
  const freeHandDrawing = useFreeHandDrawing(mapContainer, drawing, cursorTooltip);
  const keyboardNavigation = useKeyboardNavigation(mapContainer, freeHandDrawing.handleEscape);
  const mapEventHandlers = useMapEventHandlers(mapContainer);

  return async () => {
    // Initialize map and load project
    await useMapInitialization(mapContainer, drawing, noteTooltipsRef);

    // Setup all event handlers
    const unsubscribeRightClick = mapEventHandlers.setup();
    freeHandDrawing.setup();
    keyboardNavigation.setup();

    // Cleanup on unmount
    return () => {
      unsubscribeRightClick();
      freeHandDrawing.cleanup();
      keyboardNavigation.cleanup();
      mapContainer.destroyMap();
    };
  };
}
