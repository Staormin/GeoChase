import type { useDrawing } from '@/composables/useDrawing';
import type { useMap } from '@/composables/useMap';
import { type Ref, watch } from 'vue';
import { calculateDistance } from '@/services/geometry';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

/**
 * Composable for animation sequence logic
 */
export function useAnimation(
  mapContainer: ReturnType<typeof useMap>,
  drawing: ReturnType<typeof useDrawing>,
  sidebarOpen: Ref<boolean>
) {
  const uiStore = useUIStore();
  const layersStore = useLayersStore();

  function navigateToElement(element: any, onComplete?: () => void) {
    if (!mapContainer.map?.value) {
      onComplete?.();
      return;
    }

    let lat: number;
    let lon: number;
    let zoom = 15;

    switch (element.type) {
      case 'circle': {
        lat = element.center.lat;
        lon = element.center.lon;
        // Zoom out a bit to show the whole circle
        const radiusInDegrees = element.radius / 111; // Rough conversion
        zoom = Math.max(6, Math.min(18, 13 - Math.log2(radiusInDegrees)));

        break;
      }
      case 'lineSegment': {
        if (element.mode === 'parallel' && element.longitude !== undefined) {
          lat = 0;
          lon = element.longitude;
          zoom = 6;
        } else {
          lat = element.center.lat;
          lon = element.center.lon;
          if (element.endpoint) {
            const distance = calculateDistance(
              element.center.lat,
              element.center.lon,
              element.endpoint.lat,
              element.endpoint.lon
            );
            zoom = Math.max(6, Math.min(18, 15 - Math.log2(distance / 1.5)));
          }
        }

        break;
      }
      case 'point': {
        lat = element.coordinates.lat;
        lon = element.coordinates.lon;
        zoom = 16;

        break;
      }
      case 'polygon': {
        const sumLat = element.points.reduce((sum: number, p: any) => sum + p.lat, 0);
        const sumLon = element.points.reduce((sum: number, p: any) => sum + p.lon, 0);
        lat = sumLat / element.points.length;
        lon = sumLon / element.points.length;

        const lats = element.points.map((p: any) => p.lat);
        const lons = element.points.map((p: any) => p.lon);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);
        const diagonal = calculateDistance(minLat, minLon, maxLat, maxLon);
        zoom = Math.max(6, Math.min(18, 15 - Math.log2(diagonal / 1.5)));

        break;
      }
      default: {
        onComplete?.();
        return;
      }
    }

    // Smooth fly to element - use moveend event to know when animation completes
    const onMoveEnd = () => {
      mapContainer.map?.value?.off('moveend', onMoveEnd);
      // Small delay to ensure rendering is complete
      setTimeout(() => {
        onComplete?.();
      }, 100);
    };

    if (onComplete) {
      mapContainer.map.value.once('moveend', onMoveEnd);
    }

    mapContainer.map.value.flyTo([lat, lon], zoom, {
      duration: 1.5, // 1.5 second smooth transition
      easeLinearity: 0.25,
    });
  }

  function animateElements() {
    // Get all elements sorted by creation time
    const allElements = [
      ...layersStore.circles.map((c) => ({ ...c, type: 'circle' as const })),
      ...layersStore.lineSegments.map((l) => ({ ...l, type: 'lineSegment' as const })),
      ...layersStore.points.map((p) => ({ ...p, type: 'point' as const })),
      ...layersStore.polygons.map((p) => ({ ...p, type: 'polygon' as const })),
    ].toSorted((a, b) => {
      const timeA = a.createdAt || 0;
      const timeB = b.createdAt || 0;

      // Primary sort by creation time
      if (timeA !== timeB) {
        return timeA - timeB;
      }

      // Secondary sort by ID for stable ordering when times are equal
      return a.id.localeCompare(b.id);
    });

    if (allElements.length === 0) {
      uiStore.stopAnimation();
      uiStore.addToast('No elements to animate', 'info');
      return;
    }

    // Elements are already hidden in startAnimationSequence()
    let currentIndex = 0;

    const showNextElement = () => {
      if (!uiStore.animationState.isPlaying) {
        // Animation was stopped - show all elements again
        for (const element of allElements) {
          uiStore.setElementVisibility(element.type, element.id, true);
          if (drawing) {
            drawing.updateElementVisibility(element.type, element.id, true);
          }
        }
        return;
      }

      if (currentIndex < allElements.length) {
        const element = allElements[currentIndex];
        if (element) {
          uiStore.setAnimationIndex(currentIndex);

          // First: Navigate to element with smooth transition
          navigateToElement(element, () => {
            // Then: Show element after camera has arrived (callback after flyTo completes)
            if (!uiStore.animationState.isPlaying) {
              // Animation was stopped during flight - show all elements
              for (const el of allElements) {
                uiStore.setElementVisibility(el.type, el.id, true);
                if (drawing) {
                  drawing.updateElementVisibility(el.type, el.id, true);
                }
              }
              return;
            }

            uiStore.setElementVisibility(element.type, element.id, true);
            if (drawing) {
              drawing.updateElementVisibility(element.type, element.id, true);
            }

            currentIndex++;

            // Wait a moment to appreciate the element before moving to next
            setTimeout(showNextElement, 2000);
          });
        }
      } else {
        // Animation complete
        uiStore.stopAnimation();
        uiStore.addToast('Animation complete!', 'success');
      }
    };

    showNextElement();
  }

  function startAnimationSequence() {
    // Hide all elements immediately when countdown starts
    const allElements = [
      ...layersStore.circles.map((c) => ({ ...c, type: 'circle' as const })),
      ...layersStore.lineSegments.map((l) => ({ ...l, type: 'lineSegment' as const })),
      ...layersStore.points.map((p) => ({ ...p, type: 'point' as const })),
      ...layersStore.polygons.map((p) => ({ ...p, type: 'polygon' as const })),
    ];

    for (const element of allElements) {
      uiStore.setElementVisibility(element.type, element.id, false);
      if (drawing) {
        drawing.updateElementVisibility(element.type, element.id, false);
      }
    }

    // Start countdown: 3, 2, 1
    let countdownValue = 3;
    uiStore.setAnimationCountdown(countdownValue);

    const countdownInterval = setInterval(() => {
      countdownValue--;
      if (countdownValue > 0) {
        uiStore.setAnimationCountdown(countdownValue);
      } else {
        clearInterval(countdownInterval);
        uiStore.setAnimationCountdown(0);
        // Start showing elements after countdown
        animateElements();
      }
    }, 1000);
  }

  // Animation logic
  watch(
    () => uiStore.animationState.isPlaying,
    (isPlaying) => {
      if (isPlaying) {
        // Hide sidebars during animation for clean view
        sidebarOpen.value = false;
        uiStore.setSidebarOpen(false);
        uiStore.setLeftSidebarOpen(false);
        startAnimationSequence();
      }
    }
  );

  return {
    startAnimationSequence,
    animateElements,
    navigateToElement,
  };
}
