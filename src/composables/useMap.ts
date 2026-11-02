/**
 * Composable for OpenLayers map management
 */

import type { useUIStore } from '@/stores/ui';
import type { MapBrowserEvent } from 'ol';
import type BaseLayer from 'ol/layer/Base';
import type { Ref, WatchStopHandle } from 'vue';
import { shiftKeyOnly } from 'ol/events/condition';
import { defaults as defaultInteractions } from 'ol/interaction/defaults';
import MouseWheelZoom from 'ol/interaction/MouseWheelZoom';
import ImageLayer from 'ol/layer/Image';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import { fromLonLat, toLonLat } from 'ol/proj';
import ImageStatic from 'ol/source/ImageStatic';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import View from 'ol/View';
import { nextTick, ref, shallowRef, watch } from 'vue';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, getMapTilesUrl } from '@/services/geoportail';
import { imageMapExtent } from '@/services/imageMap';
import { useImageMapStore } from '@/stores/imageMap';
import { useProjectsStore } from '@/stores/projects';

export type MapContainer = ReturnType<typeof useMap>;

interface MapPanelSizes {
  sidebarWidth: Readonly<Ref<number>>;
  topBarHeight: Readonly<Ref<number>>;
  rightPanelWidth?: Readonly<Ref<number>>;
}

export function useMap(
  containerId: string,
  uiStore?: ReturnType<typeof useUIStore>,
  panelSizes?: MapPanelSizes
) {
  const imageMaps = useImageMapStore();
  const projects = useProjectsStore();
  const map = shallowRef<Map | null>(null);
  const isMapInitialized = ref(false);
  const mapLayers = shallowRef<BaseLayer[]>([]);

  // Vector layers for organized layer management
  const circlesLayer = shallowRef<VectorLayer<VectorSource> | null>(null);
  const linesLayer = shallowRef<VectorLayer<VectorSource> | null>(null);
  const routesLayer = shallowRef<VectorLayer<VectorSource> | null>(null);
  const pointsLayer = shallowRef<VectorLayer<VectorSource> | null>(null);
  const polygonsLayer = shallowRef<VectorLayer<VectorSource> | null>(null);

  // Vector sources for adding/removing features
  const circlesSource = shallowRef<VectorSource | null>(null);
  const linesSource = shallowRef<VectorSource | null>(null);
  const routesSource = shallowRef<VectorSource | null>(null);
  const pointsSource = shallowRef<VectorSource | null>(null);
  const polygonsSource = shallowRef<VectorSource | null>(null);

  // Tile source for map provider switching
  const tileSource = shallowRef<XYZ | null>(null);

  let stopProviderWatch: WatchStopHandle | undefined;
  let stopBackgroundWatch: WatchStopHandle | undefined;

  // Store initial view data for map initialization
  let initialViewData: { lat: number; lon: number; zoom: number } | null = null;

  const initMap = async () => {
    const element = document.querySelector(`#${containerId}`);
    if (!element || isMapInitialized.value) {
      return;
    }

    try {
      // Wait for next Vue tick to ensure DOM is ready
      await nextTick();

      // Create vector sources
      circlesSource.value = new VectorSource();
      linesSource.value = new VectorSource();
      routesSource.value = new VectorSource();
      pointsSource.value = new VectorSource();
      polygonsSource.value = new VectorSource();

      // Create vector layers with renderBuffer for better hit detection
      // renderBuffer extends the rendering area to include features just outside the viewport
      circlesLayer.value = new VectorLayer({
        source: circlesSource.value,
        className: 'circles-layer',
        renderBuffer: 200, // Render features 200px outside viewport for smooth panning
        updateWhileAnimating: true, // Update features during animations for smooth appearance
        updateWhileInteracting: true, // Update features during interactions (pan/zoom)
      });

      linesLayer.value = new VectorLayer({
        source: linesSource.value,
        className: 'lines-layer',
        renderBuffer: 200,
        updateWhileAnimating: true,
        updateWhileInteracting: true,
      });

      routesLayer.value = new VectorLayer({
        source: routesSource.value,
        className: 'routes-layer',
        renderBuffer: 200,
        updateWhileAnimating: true,
        updateWhileInteracting: true,
      });

      pointsLayer.value = new VectorLayer({
        source: pointsSource.value,
        className: 'points-layer',
        renderBuffer: 200, // Important for large icons and labels
        updateWhileAnimating: true,
        updateWhileInteracting: true,
      });

      polygonsLayer.value = new VectorLayer({
        source: polygonsSource.value,
        className: 'polygons-layer',
        renderBuffer: 200,
        updateWhileAnimating: true,
        updateWhileInteracting: true,
      });

      // Determine initial map center and zoom
      const initialCenter = initialViewData
        ? fromLonLat([initialViewData.lon, initialViewData.lat])
        : fromLonLat([DEFAULT_MAP_CENTER.lon, DEFAULT_MAP_CENTER.lat]);
      const initialZoom = initialViewData ? initialViewData.zoom : DEFAULT_MAP_ZOOM;

      // Create tile source for map tiles
      const initialProvider = uiStore?.mapProvider || 'geoportail';
      tileSource.value = new XYZ({
        url: getMapTilesUrl(initialProvider === 'image' ? 'geoportail' : initialProvider),
        crossOrigin: 'anonymous',
        maxZoom: 18,
        transition: 250,
        interpolate: true, // Enable smooth image interpolation during scaling
      });

      // Match cartes.gouv.fr: native tile fallback/fading with lower levels
      // preloaded, rather than filtering tiles or freezing a canvas snapshot.
      const baseLayer = new TileLayer({
        className: 'base-map-layer',
        preload: initialProvider === 'geoportail' ? Infinity : 3,
        cacheSize: 1024,
        source: tileSource.value,
      });

      const imageLayer = new ImageLayer({ className: 'image-map-layer', visible: false });

      // Create map centered on saved location (if available) or default location
      map.value = new Map({
        target: containerId,
        // IGN keeps the default smooth wheel zoom and adds integer zoom steps
        // when Shift is held. Both use OpenLayers' default 250 ms animation.
        interactions: defaultInteractions().extend([
          new MouseWheelZoom({ constrainResolution: true, condition: shiftKeyOnly }),
        ]),
        layers: [
          baseLayer,
          imageLayer,
          circlesLayer.value,
          linesLayer.value,
          routesLayer.value,
          pointsLayer.value,
          polygonsLayer.value,
        ],
        view: new View({
          center: initialCenter,
          zoom: initialZoom,
          constrainResolution: false, // Allow fractional zoom for smooth animations
        }),
        controls: [], // No default controls
      });

      isMapInitialized.value = true;

      // Handle zoom-based visibility for point labels (matches MIN_ZOOM_FOR_NOTES = 12)
      const updatePointLabelVisibility = () => {
        if (!map.value) {
          return;
        }
        const zoom = map.value.getView().getZoom() || 0;
        const labels = document.querySelectorAll('.point-label');
        for (const label of labels) {
          (label as HTMLElement).style.opacity = zoom >= 12 ? '1' : '0';
        }
      };

      // Listen to view changes for zoom-based label visibility
      map.value.getView().on('change:resolution', updatePointLabelVisibility);
      // Set initial visibility
      updatePointLabelVisibility();

      // Watch for map provider changes and update tile source
      if (uiStore) {
        stopProviderWatch = watch(
          () => [uiStore.mapProvider, imageMaps.image, projects.activeProjection] as const,
          ([newProvider, image], previous) => {
            const useImage = newProvider === 'image' && image !== null;
            baseLayer.setVisible(uiStore.mapBackgroundVisible && newProvider !== 'image');
            imageLayer.setVisible(uiStore.mapBackgroundVisible && useImage);
            const view = map.value!.getView();
            view.setMaxZoom(useImage ? 40 : 28);
            if (useImage) {
              const extent = imageMapExtent(image, projects.activeProjection);
              imageLayer.setSource(
                new ImageStatic({ url: image.url, imageExtent: extent, projection: 'EPSG:3857' })
              );
              // Keep the saved viewport on initial project loading.
              if (previous?.[0] !== 'image' || previous?.[1] !== image) {
                view.fit(extent, {
                  padding: [
                    160,
                    60,
                    60,
                    uiStore.sidebarOpen ? (panelSizes?.sidebarWidth.value ?? 360) + 30 : 60,
                  ],
                  maxZoom: 38,
                });
              }
              return;
            }
            imageLayer.setSource(null);
            baseLayer.setPreload(newProvider === 'geoportail' ? Infinity : 3);
            tileSource.value!.setUrl(
              getMapTilesUrl(newProvider === 'image' ? 'geoportail' : newProvider)
            );
            tileSource.value!.clear();
            baseLayer.clearRenderer();
          },
          { immediate: true }
        );
      }

      if (uiStore) {
        stopBackgroundWatch = watch(
          () => uiStore.mapBackgroundVisible,
          (visible) => {
            baseLayer.setVisible(visible && uiStore.mapProvider !== 'image');
            imageLayer.setVisible(
              visible && uiStore.mapProvider === 'image' && imageMaps.image !== null
            );
          },
          { immediate: true }
        );
      }

      // Update map size
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (map.value) {
            map.value.updateSize();
          }
        });
      });
    } catch {
      // Error initializing map - silently fail
    }
  };

  const destroyMap = () => {
    stopProviderWatch?.();
    stopProviderWatch = undefined;
    stopBackgroundWatch?.();
    stopBackgroundWatch = undefined;
    if (map.value) {
      // Clear all overlays (point labels, note tooltips, etc.)
      const overlays = map.value.getOverlays().getArray().slice(); // Clone array to avoid mutation during iteration
      for (const overlay of overlays) {
        map.value.removeOverlay(overlay);
      }

      // Clear vector sources
      circlesSource.value?.clear();
      linesSource.value?.clear();
      routesSource.value?.clear();
      pointsSource.value?.clear();
      polygonsSource.value?.clear();

      circlesSource.value = null;
      linesSource.value = null;
      routesSource.value = null;
      pointsSource.value = null;
      polygonsSource.value = null;

      circlesLayer.value = null;
      linesLayer.value = null;
      routesLayer.value = null;
      pointsLayer.value = null;
      polygonsLayer.value = null;

      map.value.setTarget(undefined);
      map.value = null;
      isMapInitialized.value = false;
      mapLayers.value = [];
    }
  };

  const addLayer = (layer: BaseLayer): BaseLayer => {
    if (map.value && layer) {
      map.value.addLayer(layer);
      mapLayers.value = [...mapLayers.value, layer];
    }
    return layer;
  };

  const removeLayer = (layer: BaseLayer): void => {
    if (map.value && layer) {
      map.value.removeLayer(layer);
      mapLayers.value = mapLayers.value.filter((l) => l !== layer);
    }
  };

  const clearLayers = (): void => {
    // Clear all vector sources
    circlesSource.value?.clear();
    linesSource.value?.clear();
    routesSource.value?.clear();
    pointsSource.value?.clear();
    polygonsSource.value?.clear();

    // Clear tracked layers
    for (const layer of mapLayers.value) {
      if (map.value) {
        map.value.removeLayer(layer);
      }
    }
    mapLayers.value = [];
  };

  const setCenter = (lat: number, lon: number, zoom?: number): void => {
    if (map.value) {
      const view = map.value.getView();

      // Ensure map size is updated
      map.value.updateSize();

      const targetCoordinate = fromLonLat([lon, lat]);

      // Set center and zoom directly
      view.setCenter(targetCoordinate);
      if (zoom !== undefined) {
        view.setZoom(zoom);
      }
    }
  };

  const getCenter = (): { lat: number; lon: number } | null => {
    if (!map.value) {
      return null;
    }
    const center = map.value.getView().getCenter();
    if (!center) {
      return null;
    }
    const lonLat = toLonLat(center);
    if (!lonLat || lonLat.length !== 2 || lonLat[0] === undefined || lonLat[1] === undefined) {
      return null;
    }
    return { lat: lonLat[1], lon: lonLat[0] };
  };

  const getZoom = (): number => {
    return map.value ? map.value.getView().getZoom() || DEFAULT_MAP_ZOOM : DEFAULT_MAP_ZOOM;
  };

  const latLngToContainerPoint = (lat: number, lon: number): { x: number; y: number } | null => {
    if (!map.value) {
      return null;
    }
    const pixel = map.value.getPixelFromCoordinate(fromLonLat([lon, lat]));
    if (!pixel || pixel[0] === undefined || pixel[1] === undefined) {
      return null;
    }
    return { x: pixel[0], y: pixel[1] };
  };

  const containerPointToLatLng = (x: number, y: number): { lat: number; lon: number } | null => {
    if (!map.value) {
      return null;
    }
    const coordinate = map.value.getCoordinateFromPixel([x, y]);
    if (!coordinate) {
      return null;
    }
    const lonLat = toLonLat(coordinate);
    const lon = lonLat[0];
    const lat = lonLat[1];
    if (lon === undefined || lat === undefined) {
      return null;
    }
    return { lat, lon };
  };

  const fitBounds = (
    bounds: [[number, number], [number, number]],
    options?: { duration?: number; padding?: [number, number] }
  ): void => {
    if (map.value) {
      const [[minLat, minLon], [maxLat, maxLon]] = bounds;
      const extent = [...fromLonLat([minLon, minLat]), ...fromLonLat([maxLon, maxLat])];

      map.value.getView().fit(extent, {
        padding: options?.padding || [50, 50, 50, 50],
        duration: options?.duration,
      });
    }
  };

  const flyTo = (
    lat: number,
    lon: number,
    zoom?: number,
    options?: { duration?: number; easing?: (t: number) => number }
  ): void => {
    if (map.value) {
      const view = map.value.getView();
      const currentZoom = view.getZoom();
      const targetZoom = zoom ?? (currentZoom === undefined ? DEFAULT_MAP_ZOOM : currentZoom);
      const duration = options?.duration || 1500;

      // Ensure map size is updated before animation
      map.value.updateSize();

      const targetCoordinate = fromLonLat([lon, lat]);

      // Use OpenLayers animate for smooth transition
      view.animate({
        center: targetCoordinate,
        zoom: targetZoom,
        duration,
        easing: options?.easing, // Apply custom easing function if provided
      });
    }
  };

  const flyToBounds = (
    bounds: [[number, number], [number, number]],
    options?: { duration?: number; padding?: [number, number]; easeLinearity?: number }
  ): void => {
    if (map.value) {
      const [[minLat, minLon], [maxLat, maxLon]] = bounds;
      const extent = [...fromLonLat([minLon, minLat]), ...fromLonLat([maxLon, maxLat])];

      map.value.getView().fit(extent, {
        padding: options?.padding
          ? [options.padding[0], options.padding[1], options.padding[0], options.padding[1]]
          : [50, 50, 50, 50],
        duration: options?.duration ? options.duration * 1000 : 1500,
      });
    }
  };

  /**
   * Fly to bounds accounting for open panels (sidebar, top bar, etc.)
   * Adjusts padding to ensure elements are visible and not hidden behind panels
   */
  const flyToBoundsWithPanels = (
    bounds: [[number, number], [number, number]],
    options?: { duration?: number; accountForPanels?: boolean }
  ): void => {
    if (!map.value) {
      return;
    }

    const [[minLat, minLon], [maxLat, maxLon]] = bounds;
    const extent = [...fromLonLat([minLon, minLat]), ...fromLonLat([maxLon, maxLat])];

    // Default padding
    let paddingTop = 50;
    let paddingRight = 50;
    let paddingBottom = 50;
    let paddingLeft = 50;

    // Account for open panels (default: true)
    const shouldAccountForPanels = options?.accountForPanels !== false;

    if (shouldAccountForPanels && uiStore) {
      if (uiStore.topBarOpen || uiStore.toolInstructionsVisible) {
        paddingTop += panelSizes?.topBarHeight.value ?? 64;
      }

      if (uiStore.sidebarOpen) {
        paddingLeft += panelSizes?.sidebarWidth.value ?? 640;
      }
      paddingRight += panelSizes?.rightPanelWidth?.value ?? 0;
    }

    // Reduce margins when panels leave only a narrow strip of map visible.
    const size = map.value.getSize();
    if (size?.[0] && size[1]) {
      const leftInset = Math.min(paddingLeft - 50, Math.max(0, size[0] - 1));
      const topInset = Math.min(paddingTop - 50, Math.max(0, size[1] - 1));
      const rightInset = Math.min(paddingRight - 50, Math.max(0, size[0] - leftInset - 1));
      const horizontalMargin = Math.min(50, (size[0] - leftInset - rightInset) / 4);
      paddingRight = rightInset + horizontalMargin;
      paddingBottom = Math.min(50, (size[1] - topInset) / 4);
      paddingLeft = leftInset + horizontalMargin;
      paddingTop = topInset + paddingBottom;
    }

    map.value.getView().fit(extent, {
      padding: [paddingTop, paddingRight, paddingBottom, paddingLeft],
      duration: options?.duration ? options.duration * 1000 : 1500,
    });
  };

  /**
   * Refit the map to adjust center position accounting for panel changes
   * When panels open/close, this shifts the map so the visible area shows the same content
   */
  const refitMap = (
    previousSidebarState?: boolean,
    newSidebarState?: boolean,
    previousTopBarState?: boolean,
    newTopBarState?: boolean
  ): void => {
    if (!map.value) {
      return;
    }

    const view = map.value.getView();
    const mapSize = map.value.getSize();
    if (!mapSize) {
      return;
    }

    if (mapSize.length !== 2 || mapSize[0] === undefined || mapSize[1] === undefined) {
      return;
    }

    const mapWidth = mapSize[0];
    const mapHeight = mapSize[1];
    const currentCenter = view.getCenter();
    if (
      !currentCenter ||
      currentCenter.length !== 2 ||
      currentCenter[0] === undefined ||
      currentCenter[1] === undefined
    ) {
      return;
    }

    const resolution = view.getResolution();
    if (!resolution) {
      return;
    }

    // Calculate the shift needed for sidebar (horizontal)
    const sidebarWidth = panelSizes?.sidebarWidth.value ?? 640;
    let offsetPixelsX = 0;

    if (previousSidebarState !== undefined && newSidebarState !== undefined) {
      if (previousSidebarState && !newSidebarState) {
        // Sidebar was open, now closed - shift RIGHT to recenter
        const previousVisibleCenter = sidebarWidth + (mapWidth - sidebarWidth) / 2;
        const newVisibleCenter = mapWidth / 2;
        offsetPixelsX = previousVisibleCenter - newVisibleCenter;
      } else if (!previousSidebarState && newSidebarState) {
        // Sidebar was closed, now open - shift LEFT to keep content visible
        const previousVisibleCenter = mapWidth / 2;
        const newVisibleCenter = sidebarWidth + (mapWidth - sidebarWidth) / 2;
        offsetPixelsX = previousVisibleCenter - newVisibleCenter;
      }
    }

    // Calculate the shift needed for top bar (vertical)
    const topBarHeight = panelSizes?.topBarHeight.value ?? 64;
    let offsetPixelsY = 0;

    if (previousTopBarState !== undefined && newTopBarState !== undefined) {
      if (previousTopBarState && !newTopBarState) {
        // Top bar was open, now closed - shift UP to recenter
        const previousVisibleCenter = topBarHeight + (mapHeight - topBarHeight) / 2;
        const newVisibleCenter = mapHeight / 2;
        offsetPixelsY = newVisibleCenter - previousVisibleCenter;
      } else if (!previousTopBarState && newTopBarState) {
        // Top bar was closed, now open - shift DOWN to keep content visible
        const previousVisibleCenter = mapHeight / 2;
        const newVisibleCenter = topBarHeight + (mapHeight - topBarHeight) / 2;
        offsetPixelsY = newVisibleCenter - previousVisibleCenter;
      }
    }

    // Convert pixel offsets to map coordinate offsets
    const offsetX = offsetPixelsX * resolution;
    const offsetY = offsetPixelsY * resolution;

    // Calculate new center (shift in both X and Y directions)
    const newCenter = [currentCenter[0] + offsetX, currentCenter[1] + offsetY];

    // Animate to the new center (instant for snappy response)
    view.animate({
      center: newCenter,
      duration: 0,
    });
  };

  const onMapClick = (callback: (lat: number, lon: number) => void): (() => void) => {
    if (!map.value) {
      return () => {};
    }

    const handler = (event: MapBrowserEvent) => {
      const coordinate = map.value?.getCoordinateFromPixel(event.pixel);
      if (coordinate) {
        const lonLat = toLonLat(coordinate);
        const lon = lonLat[0];
        const lat = lonLat[1];
        if (lon !== undefined && lat !== undefined) {
          callback(lat, lon);
        }
      }
    };

    map.value.on('click', handler);

    return () => {
      if (map.value) {
        map.value.un('click', handler);
      }
    };
  };

  const onMapRightClick = (callback: (lat: number, lon: number) => void): (() => void) => {
    const element = document.querySelector(`#${containerId}`);
    if (!element || !map.value) {
      return () => {};
    }

    const handler = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      mouseEvent.preventDefault();
      if (!map.value) {
        return;
      }

      // Use map.getEventPixel to correctly convert DOM event to OpenLayers pixel coordinates
      const pixel = map.value.getEventPixel(mouseEvent);
      const coordinate = map.value.getCoordinateFromPixel(pixel);
      if (coordinate) {
        const lonLat = toLonLat(coordinate);
        const lon = lonLat[0];
        const lat = lonLat[1];
        if (lon !== undefined && lat !== undefined) {
          callback(lat, lon);
        }
      }
    };

    element.addEventListener('contextmenu', handler as EventListener);

    return () => {
      element.removeEventListener('contextmenu', handler as EventListener);
    };
  };

  /**
   * Set initial view data to be used when the map is initialized
   * This must be called BEFORE initMap()
   */
  const setInitialViewData = (viewData: { lat: number; lon: number; zoom: number } | null) => {
    initialViewData = viewData;
  };

  return {
    map,
    isMapInitialized,
    mapLayers,
    circlesLayer,
    linesLayer,
    routesLayer,
    pointsLayer,
    polygonsLayer,
    circlesSource,
    linesSource,
    routesSource,
    pointsSource,
    polygonsSource,
    initMap,
    destroyMap,
    addLayer,
    removeLayer,
    clearLayers,
    setCenter,
    getCenter,
    getZoom,
    latLngToContainerPoint,
    containerPointToLatLng,
    fitBounds,
    flyTo,
    flyToBounds,
    flyToBoundsWithPanels,
    refitMap,
    onMapClick,
    onMapRightClick,
    setInitialViewData,
  };
}
