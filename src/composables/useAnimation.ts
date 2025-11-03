import type { useDrawing } from '@/composables/useDrawing';
import type { useMap } from '@/composables/useMap';
import { getDistance } from 'ol/sphere';
import { type Ref, watch } from 'vue';
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

  // Helper to get all elements sorted by creation time
  function getAllElementsSorted() {
    return [
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
  }

  // Calculate bounds that include all elements
  function calculateAllElementsBounds() {
    const allElements = getAllElementsSorted();
    let minLat = 90,
      maxLat = -90,
      minLon = 180,
      maxLon = -180;

    for (const element of allElements) {
      switch (element.type) {
        case 'circle': {
          const lat = element.center.lat;
          const lon = element.center.lon;
          const radiusInDegrees = element.radius / 111; // Approximate: 111km per degree
          minLat = Math.min(minLat, lat - radiusInDegrees);
          maxLat = Math.max(maxLat, lat + radiusInDegrees);
          minLon = Math.min(minLon, lon - radiusInDegrees);
          maxLon = Math.max(maxLon, lon + radiusInDegrees);
          break;
        }
        case 'lineSegment': {
          minLat = Math.min(minLat, element.center.lat, element.endpoint?.lat || 90);
          maxLat = Math.max(maxLat, element.center.lat, element.endpoint?.lat || -90);
          minLon = Math.min(minLon, element.center.lon, element.endpoint?.lon || 180);
          maxLon = Math.max(maxLon, element.center.lon, element.endpoint?.lon || -180);
          break;
        }
        case 'point': {
          minLat = Math.min(minLat, element.coordinates.lat);
          maxLat = Math.max(maxLat, element.coordinates.lat);
          minLon = Math.min(minLon, element.coordinates.lon);
          maxLon = Math.max(maxLon, element.coordinates.lon);
          break;
        }
        case 'polygon': {
          for (const point of element.points) {
            minLat = Math.min(minLat, point.lat);
            maxLat = Math.max(maxLat, point.lat);
            minLon = Math.min(minLon, point.lon);
            maxLon = Math.max(maxLon, point.lon);
          }
          break;
        }
      }
    }

    if (minLat <= maxLat && minLon <= maxLon) {
      return {
        bounds: [
          [minLat, minLon],
          [maxLat, maxLon],
        ] as [[number, number], [number, number]],
        center: [(minLat + maxLat) / 2, (minLon + maxLon) / 2] as [number, number],
      };
    }

    return null;
  }

  // Get coordinates for an element's center
  function getElementCoordinates(element: any): [number, number] | null {
    switch (element.type) {
      case 'circle': {
        return [element.center.lat, element.center.lon];
      }
      case 'lineSegment': {
        return [element.center.lat, element.center.lon];
      }
      case 'point': {
        return [element.coordinates.lat, element.coordinates.lon];
      }
      case 'polygon': {
        const sumLat = element.points.reduce((sum: number, p: any) => sum + p.lat, 0);
        const sumLon = element.points.reduce((sum: number, p: any) => sum + p.lon, 0);
        return [sumLat / element.points.length, sumLon / element.points.length];
      }
      default: {
        return null;
      }
    }
  }

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
            // getDistance returns meters, convert to km
            const distance =
              getDistance(
                [element.center.lon, element.center.lat],
                [element.endpoint.lon, element.endpoint.lat]
              ) / 1000;
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
        // getDistance returns meters, convert to km
        const diagonal = getDistance([minLon, minLat], [maxLon, maxLat]) / 1000;
        zoom = Math.max(6, Math.min(18, 15 - Math.log2(diagonal / 1.5)));

        break;
      }
      default: {
        onComplete?.();
        return;
      }
    }

    // Speed affects flyTo duration: speed 1 = 3.7s, speed 10 = 1s
    const config = uiStore.animationConfig;
    const flyDuration = (4 - config.transitionSpeed * 0.3) * 1000; // Convert to milliseconds

    // Use OpenLayers view.animate() with callback
    if (mapContainer.flyTo) {
      mapContainer.flyTo(lat, lon, zoom, { duration: flyDuration });

      // Call onComplete after animation duration
      if (onComplete) {
        setTimeout(() => {
          onComplete();
        }, flyDuration + 100);
      }
    } else {
      onComplete?.();
    }
  }

  // Smooth zoom out animation - smoothly fly from starting point to end view
  function animateSmoothZoomOut() {
    if (!mapContainer.map?.value) {
      uiStore.stopAnimation();
      return;
    }

    const config = uiStore.animationConfig;

    // Validate that we have both views
    if (!config.startView || !config.endView) {
      uiStore.stopAnimation();
      uiStore.addToast('Start and end views must be set', 'error');
      return;
    }

    // Speed affects duration: speed 1 = 11s, speed 10 = 2s
    const totalDuration = (12 - config.zoomSpeed) * 1000; // Convert to milliseconds

    // Start view is already set in startAnimationSequence
    // Just smoothly fly to the captured end view
    if (mapContainer.flyTo) {
      mapContainer.flyTo(
        config.endView.lat,
        config.endView.lon,
        config.endView.zoom,
        {
          duration: totalDuration, // flyTo expects milliseconds
        }
      );
    }

    // Stop animation after duration completes
    setTimeout(
      () => {
        if (uiStore.animationState.isPlaying) {
          uiStore.stopAnimation();
          uiStore.addToast('Animation complete!', 'success');
          // Keep sidebars closed after animation
          sidebarOpen.value = false;
          uiStore.setSidebarOpen(false);
          uiStore.setLeftSidebarOpen(false);
        }
      },
      totalDuration + 500
    );
  }

  // Store original visibility state before animation
  const originalVisibilityState = new Map<string, boolean>();

  // Start to finish animation - navigate to each element one by one
  function animateStartToFinish() {
    // Get all elements sorted by creation time
    const allElements = getAllElementsSorted();

    // Filter to only include elements that were originally visible
    const visibleElements = allElements.filter((element) =>
      originalVisibilityState.get(`${element.type}_${element.id}`)
    );

    if (visibleElements.length === 0) {
      uiStore.stopAnimation();
      uiStore.addToast('No visible elements to animate', 'info');
      return;
    }

    // Hide all visible elements (we'll show them one by one)
    for (const element of visibleElements) {
      uiStore.setElementVisibility(element.type, element.id, false);
      if (drawing) {
        drawing.updateElementVisibility(element.type, element.id, false);
      }
    }

    let currentIndex = 0;

    // Speed affects wait time: speed 1 = 3s, speed 10 = 0.5s
    const config = uiStore.animationConfig;
    const waitTimeMs = 3500 - config.transitionSpeed * 300; // 3200ms to 500ms

    const showNextElement = () => {
      if (!uiStore.animationState.isPlaying) {
        // Animation was stopped - restore original visibility
        restoreOriginalVisibility();
        return;
      }

      if (currentIndex < visibleElements.length) {
        const element = visibleElements[currentIndex];
        if (element) {
          uiStore.setAnimationIndex(currentIndex);

          // First: Navigate to element with smooth transition
          navigateToElement(element, () => {
            // Then: Show element after camera has arrived (callback after flyTo completes)
            if (!uiStore.animationState.isPlaying) {
              // Animation was stopped during flight - restore original visibility
              restoreOriginalVisibility();
              return;
            }

            uiStore.setElementVisibility(element.type, element.id, true);
            if (drawing) {
              // Animate line segments as they appear
              const animate = element.type === 'lineSegment';
              drawing.updateElementVisibility(element.type, element.id, true, animate).then(() => {
                currentIndex++;

                // Wait a moment to appreciate the element before moving to next
                setTimeout(showNextElement, waitTimeMs);
              });
            } else {
              currentIndex++;
              setTimeout(showNextElement, waitTimeMs);
            }
          });
        }
      } else {
        // Animation complete - elements are already shown, no need to restore
        uiStore.stopAnimation();
        uiStore.addToast('Animation complete!', 'success');
        // Keep sidebars closed after animation
        sidebarOpen.value = false;
        uiStore.setSidebarOpen(false);
        uiStore.setLeftSidebarOpen(false);
      }
    };

    showNextElement();
  }

  // Helper to restore original visibility state
  function restoreOriginalVisibility() {
    const allElements = getAllElementsSorted();
    for (const element of allElements) {
      const originalVisibility = originalVisibilityState.get(`${element.type}_${element.id}`);
      if (originalVisibility !== undefined) {
        uiStore.setElementVisibility(element.type, element.id, originalVisibility);
        if (drawing) {
          drawing.updateElementVisibility(element.type, element.id, originalVisibility);
        }
      }
    }
  }

  function startAnimationSequence() {
    const config = uiStore.animationConfig;
    const allElements = getAllElementsSorted();

    // Save original visibility state before animation
    originalVisibilityState.clear();
    for (const element of allElements) {
      const isVisible = uiStore.isElementVisible(element.type, element.id);
      originalVisibilityState.set(`${element.type}_${element.id}`, isVisible);
    }

    // Start countdown: 3, 2, 1 for both animation types
    let countdownValue = 3;
    uiStore.setAnimationCountdown(countdownValue);

    if (config.type === 'smoothZoomOut') {
      // For smooth zoom out, set the start view IMMEDIATELY before countdown
      if (config.startView && mapContainer.setCenter) {
        mapContainer.setCenter(
          config.startView.lat,
          config.startView.lon,
          config.startView.zoom
        );
      }

      // For smoothZoomOut, keep elements at their current visibility state
      // Only update rendering without changing visibility state
      for (const element of allElements) {
        const isVisible = uiStore.isElementVisible(element.type, element.id);
        if (drawing && isVisible) {
          // Only render visible elements, pass animate=false to prevent map movements
          drawing.updateElementVisibility(element.type, element.id, true, false);
        }
      }

      // Countdown then start zoom animation
      const countdownInterval = setInterval(() => {
        countdownValue--;
        if (countdownValue > 0) {
          uiStore.setAnimationCountdown(countdownValue);
        } else {
          clearInterval(countdownInterval);
          uiStore.setAnimationCountdown(0);
          // Start smooth zoom out after countdown
          animateSmoothZoomOut();
        }
      }, 1000);
    } else {
      // For start to finish, hide all elements first
      for (const element of allElements) {
        uiStore.setElementVisibility(element.type, element.id, false);
        if (drawing) {
          drawing.updateElementVisibility(element.type, element.id, false);
        }
      }

      // Countdown then start showing elements one by one
      const countdownInterval = setInterval(() => {
        countdownValue--;
        if (countdownValue > 0) {
          uiStore.setAnimationCountdown(countdownValue);
        } else {
          clearInterval(countdownInterval);
          uiStore.setAnimationCountdown(0);
          // Start showing elements after countdown
          animateStartToFinish();
        }
      }, 1000);
    }
  }

  // Helper to hide/show labels and notes
  function setLabelsAndNotesVisibility(visible: boolean) {
    const config = uiStore.animationConfig;
    if (!config.hideLabelsAndNotes) return; // Only hide if option is enabled

    // Hide/show point labels (OpenLayers overlays)
    const pointLabels = document.querySelectorAll('.point-label');
    for (const label of pointLabels) {
      const element = label as HTMLElement;
      element.style.display = visible ? '' : 'none';
    }

    // Hide/show note tooltips
    const noteTooltips = document.querySelectorAll('.note-tooltip');
    for (const tooltip of noteTooltips) {
      const element = tooltip as HTMLElement;
      element.style.display = visible ? '' : 'none';
    }
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
        // Hide labels and notes if option is enabled
        setLabelsAndNotesVisibility(false);
        startAnimationSequence();
      } else {
        // Restore labels and notes when animation stops
        setLabelsAndNotesVisibility(true);
        // Keep sidebars closed after animation
        sidebarOpen.value = false;
        uiStore.setSidebarOpen(false);
        uiStore.setLeftSidebarOpen(false);
      }
    }
  );

  return {
    startAnimationSequence,
    animateStartToFinish,
    animateSmoothZoomOut,
    navigateToElement,
  };
}
