/**
 * Composable for syncing view data (panels state and map view) with project storage
 */

import type { ViewData } from '@/services/storage';
import { fromLonLat } from 'ol/proj';
import { watch } from 'vue';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';
import type { MapContainer } from './useMap';

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

    // Restore UI state FIRST (topBar and sidebar)
    uiStore.topBarOpen = viewData.topPanelOpen;
    uiStore.sidebarOpen = viewData.sidePanelOpen;

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
    // Watch top bar state
    watch(
      () => uiStore.topBarOpen,
      () => {
        saveViewData();
      }
    );

    // Watch sidebar state
    watch(
      () => uiStore.sidebarOpen,
      () => {
        saveViewData();
      }
    );

    // Watch map view changes (center and zoom)
    // We use a view change event listener for this
    if (mapContainer.map.value) {
      const view = mapContainer.map.value.getView();

      view.on('change:center', () => {
        saveViewData();
      });

      view.on('change:resolution', () => {
        saveViewData();
      });
    }

    // Watch active project changes to restore view data
    watch(
      () => projectsStore.activeProjectId,
      () => {
        // Use setTimeout to ensure map is ready
        setTimeout(() => {
          restoreViewData();
        }, 100);
      }
    );
  };

  return {
    saveViewData,
    restoreViewData,
    setupWatchers,
  };
}
