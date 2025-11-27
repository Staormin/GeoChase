/**
 * Composable for syncing view data (panels state and map view) with project storage
 */

import type { MapContainer } from './useMap';
import type { ViewData } from '@/services/storage';
import { fromLonLat } from 'ol/proj';
import { watch } from 'vue';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';

// Debounce helper to reduce localStorage writes during pan/zoom
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return ((...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}

export function useViewDataSync(mapContainer: MapContainer) {
  const projectsStore = useProjectsStore();
  const uiStore = useUIStore();

  /**
   * Get current view data from UI state and map
   */
  const getCurrentViewData = (): ViewData | null => {
    if (!mapContainer.map.value) {
      return null;
    }

    const center = mapContainer.getCenter();
    const zoom = mapContainer.getZoom();

    if (!center) {
      return null;
    }

    return {
      topPanelOpen: uiStore.topBarOpen,
      sidePanelOpen: uiStore.sidebarOpen,
      pdfPanelOpen: uiStore.pdfPanelOpen,
      pdfPanelWidth: uiStore.pdfPanelWidth,
      pdfCurrentPage: uiStore.pdfCurrentPage,
      pdfZoomLevel: uiStore.pdfZoomLevel,
      mapView: {
        lat: center.lat,
        lon: center.lon,
        zoom,
      },
    };
  };

  /**
   * Save current view data to the active project
   */
  const saveViewData = () => {
    const viewData = getCurrentViewData();
    if (viewData) {
      projectsStore.updateViewData(viewData);
    }
  };

  /**
   * Restore view data from the active project
   * Used when switching projects (initial load is handled during map initialization)
   */
  const restoreViewData = () => {
    const viewData = projectsStore.getViewData();
    if (!viewData || !viewData.mapView || !mapContainer.map.value) {
      return;
    }

    const view = mapContainer.map.value.getView();

    // Restore UI state FIRST (topBar, sidebar, pdfPanel states)
    uiStore.topBarOpen = viewData.topPanelOpen;
    uiStore.sidebarOpen = viewData.sidePanelOpen;
    if (viewData.pdfPanelOpen !== undefined) {
      uiStore.setPdfPanelOpen(viewData.pdfPanelOpen);
    }
    if (viewData.pdfPanelWidth) {
      uiStore.setPdfPanelWidth(viewData.pdfPanelWidth);
    }
    if (viewData.pdfCurrentPage) {
      uiStore.setPdfCurrentPage(viewData.pdfCurrentPage);
    }
    if (viewData.pdfZoomLevel) {
      uiStore.setPdfZoomLevel(viewData.pdfZoomLevel);
    }

    // Force map size update to account for panel states
    mapContainer.map.value.updateSize();

    // Restore map view by setting the raw center (without offset calculation)
    // The saved center already has the offset from when it was saved
    const targetCoordinate = fromLonLat([viewData.mapView.lon, viewData.mapView.lat]);
    view.setCenter(targetCoordinate);
    view.setZoom(viewData.mapView.zoom);
  };

  /**
   * Setup watchers to auto-save view data when state changes
   */
  const setupWatchers = () => {
    // Debounce saveViewData to avoid excessive localStorage writes
    // 500ms is appropriate for user actions (longer than UI updates)
    const debouncedSaveViewData = debounce(saveViewData, 500);

    // Watch top bar state
    watch(
      () => uiStore.topBarOpen,
      () => {
        debouncedSaveViewData();
      }
    );

    // Watch sidebar state
    watch(
      () => uiStore.sidebarOpen,
      () => {
        debouncedSaveViewData();
      }
    );

    // Watch PDF panel open state
    watch(
      () => uiStore.pdfPanelOpen,
      () => {
        debouncedSaveViewData();
      }
    );

    // Watch PDF panel width
    watch(
      () => uiStore.pdfPanelWidth,
      () => {
        debouncedSaveViewData();
      }
    );

    // Watch PDF current page
    watch(
      () => uiStore.pdfCurrentPage,
      () => {
        debouncedSaveViewData();
      }
    );

    // Watch PDF zoom level
    watch(
      () => uiStore.pdfZoomLevel,
      () => {
        debouncedSaveViewData();
      }
    );

    // Watch map view changes (center and zoom)
    // Heavily debounced to reduce CPU and localStorage writes during interaction
    if (mapContainer.map.value) {
      const view = mapContainer.map.value.getView();

      view.on('change:center', () => {
        debouncedSaveViewData();
      });

      view.on('change:resolution', () => {
        debouncedSaveViewData();
      });
    }

    // Watch active project changes to restore view data
    // Use immediate: true to also restore on initial load
    watch(
      () => projectsStore.activeProjectId,
      () => {
        // Use setTimeout to ensure map is ready
        setTimeout(() => {
          restoreViewData();
        }, 100);
      },
      { immediate: true }
    );
  };

  return {
    saveViewData,
    restoreViewData,
    setupWatchers,
  };
}
