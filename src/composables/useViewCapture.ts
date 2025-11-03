import type { useMap } from '@/composables/useMap';
import { watch } from 'vue';
import { useUIStore } from '@/stores/ui';

/**
 * Composable for handling view capture clicks during animation setup
 */
export function useViewCapture(mapContainer: ReturnType<typeof useMap>) {
  const uiStore = useUIStore();

  const setup = () => {
    // Watch for view capture mode changes and update map size
    const unsubscribeWatch = watch(
      () => uiStore.viewCaptureState.isCapturing,
      async (isCapturing) => {
        if (isCapturing && mapContainer.map?.value) {
          // Wait for Vue to update the DOM (hide panels)
          await new Promise((resolve) => setTimeout(resolve, 100));
          // Update map size to account for hidden panels
          mapContainer.map.value.updateSize();
        }
      }
    );

    // Setup map click handler for view capture
    const unsubscribeClick = mapContainer.onMapClick(async () => {
      // Only handle clicks when in view capture mode
      if (!uiStore.viewCaptureState.isCapturing) {
        return;
      }

      // Capture the current map center (not the click position)
      // This ensures we capture what's actually visible in the viewport
      const center = mapContainer.getCenter();
      if (!center) {
        uiStore.addToast('Failed to capture view center', 'error');
        return;
      }

      // Get current zoom level
      const zoom = mapContainer.getZoom();

      // Capture screenshot of the map
      let screenshot: string | undefined;
      try {
        screenshot = await mapContainer.captureScreenshot();
      } catch (error) {
        console.error('Failed to capture screenshot:', error);
        // Continue without screenshot
      }

      // Capture the view with the map center coordinates
      uiStore.captureView({ lat: center.lat, lon: center.lon, zoom, screenshot });

      // Re-open the animation modal
      uiStore.openModal('animationModal');

      // Show success toast
      const viewType = uiStore.viewCaptureState.captureType === 'start' ? 'Start' : 'End';
      uiStore.addToast(`${viewType} view captured successfully!`, 'success');
    });

    // Return cleanup function that unsubscribes from both
    return () => {
      unsubscribeWatch();
      unsubscribeClick();
    };
  };

  return {
    setup,
  };
}
