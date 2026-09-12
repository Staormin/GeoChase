/**
 * Composable for syncing view data (panels state and map view) with project storage
 */

import type { MapContainer } from './useMap';
import type { ViewData } from '@/types/project';
import { fromLonLat } from 'ol/proj';
import { watch } from 'vue';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';
import { debounce } from '@/utils/debounce';

// Debounce helper to reduce localStorage writes during pan/zoom

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
      pdfScrollPosition: uiStore.pdfScrollPosition,
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
    if (viewData.pdfScrollPosition) {
      uiStore.setPdfScrollPosition(viewData.pdfScrollPosition);
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
    const debouncedSaveViewData = debounce(saveViewData, 500);
    const stopUIWatch = watch(
      () => [
        uiStore.topBarOpen,
        uiStore.sidebarOpen,
        uiStore.pdfPanelOpen,
        uiStore.pdfPanelWidth,
        uiStore.pdfCurrentPage,
        uiStore.pdfZoomLevel,
        uiStore.pdfScrollPosition,
      ],
      debouncedSaveViewData,
      { deep: true }
    );
    const view = mapContainer.map.value?.getView();
    view?.on('change:center', debouncedSaveViewData);
    view?.on('change:resolution', debouncedSaveViewData);

    let restoreTimer: ReturnType<typeof setTimeout> | undefined;
    const stopProjectWatch = watch(
      () => projectsStore.activeProjectId,
      () => {
        clearTimeout(restoreTimer);
        restoreTimer = setTimeout(restoreViewData, 100);
      },
      { immediate: true }
    );

    return () => {
      stopUIWatch();
      stopProjectWatch();
      clearTimeout(restoreTimer);
      debouncedSaveViewData.cancel();
      view?.un('change:center', debouncedSaveViewData);
      view?.un('change:resolution', debouncedSaveViewData);
    };
  };

  return {
    saveViewData,
    restoreViewData,
    setupWatchers,
  };
}
