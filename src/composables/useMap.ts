/**
 * Composable for OpenLayers map management
 */

import type BaseLayer from 'ol/layer/Base';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import { fromLonLat, toLonLat } from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import View from 'ol/View';
import { nextTick, ref } from 'vue';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, getMapTilesUrl } from '@/services/geoportail';

export type MapContainer = ReturnType<typeof useMap>;

export function useMap(containerId: string, uiStore?: any) {
  const map = ref<Map | null>(null);
  const isMapInitialized = ref(false);
  const mapLayers = ref<BaseLayer[]>([]);

  // Vector layers for organized layer management
  const circlesLayer = ref<VectorLayer<any> | null>(null);
  const linesLayer = ref<VectorLayer<any> | null>(null);
  const pointsLayer = ref<VectorLayer<any> | null>(null);
  const polygonsLayer = ref<VectorLayer<any> | null>(null);

  // Vector sources for adding/removing features
  const circlesSource = ref<VectorSource<any> | null>(null);
  const linesSource = ref<VectorSource<any> | null>(null);
  const pointsSource = ref<VectorSource<any> | null>(null);
  const polygonsSource = ref<VectorSource<any> | null>(null);

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
      circlesSource.value = new VectorSource() as any;
      linesSource.value = new VectorSource() as any;
      pointsSource.value = new VectorSource() as any;
      polygonsSource.value = new VectorSource() as any;

      // Create vector layers with renderBuffer for better hit detection
      // renderBuffer extends the rendering area to include features just outside the viewport
      circlesLayer.value = new VectorLayer({
        source: circlesSource.value as any,
        className: 'circles-layer',
        renderBuffer: 200, // Render features 200px outside viewport for smooth panning
        updateWhileAnimating: true, // Update features during animations for smooth appearance
        updateWhileInteracting: true, // Update features during interactions (pan/zoom)
      }) as any;

      linesLayer.value = new VectorLayer({
        source: linesSource.value as any,
        className: 'lines-layer',
        renderBuffer: 200,
        updateWhileAnimating: true,
        updateWhileInteracting: true,
      }) as any;

      pointsLayer.value = new VectorLayer({
        source: pointsSource.value as any,
        className: 'points-layer',
        renderBuffer: 200, // Important for large icons and labels
        updateWhileAnimating: true,
        updateWhileInteracting: true,
      }) as any;

      polygonsLayer.value = new VectorLayer({
        source: polygonsSource.value as any,
        className: 'polygons-layer',
        renderBuffer: 200,
        updateWhileAnimating: true,
        updateWhileInteracting: true,
      }) as any;

      // Determine initial map center and zoom
      const initialCenter = initialViewData
        ? fromLonLat([initialViewData.lon, initialViewData.lat])
        : fromLonLat([DEFAULT_MAP_CENTER.lon, DEFAULT_MAP_CENTER.lat]);
      const initialZoom = initialViewData ? initialViewData.zoom : DEFAULT_MAP_ZOOM;

      // Create map centered on saved location (if available) or default location
      map.value = new Map({
        target: containerId,
        layers: [
          new TileLayer({
            preload: 3, // Preload tiles 3 zoom levels ahead for smoother animations
            source: new XYZ({
              url: getMapTilesUrl(),
              crossOrigin: 'anonymous',
              maxZoom: 18,
              transition: 0, // Disable tile fade-in to prevent mixing tiles from different zoom levels
              cacheSize: 512, // Increased cache size to keep more tiles in memory (default is 128)
              interpolate: true, // Enable smooth image interpolation during scaling
            }),
          }),
          circlesLayer.value as any,
          linesLayer.value as any,
          pointsLayer.value as any,
          polygonsLayer.value as any,
        ] as any,
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
          if (zoom >= 12) {
            (label as HTMLElement).style.opacity = '1';
          } else {
            (label as HTMLElement).style.opacity = '0';
          }
        }
      };

      // Listen to view changes for zoom-based label visibility
      map.value.getView().on('change:resolution', updatePointLabelVisibility);
      // Set initial visibility
      updatePointLabelVisibility();

      // Update map size
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (map.value) {
            map.value.updateSize();
          }
        });
      });
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  };

  const destroyMap = () => {
    if (map.value) {
      // Clear all overlays (point labels, note tooltips, etc.)
      const overlays = map.value.getOverlays().getArray().slice(); // Clone array to avoid mutation during iteration
      for (const overlay of overlays) {
        map.value.removeOverlay(overlay);
      }

      // Clear vector sources
      circlesSource.value?.clear();
      linesSource.value?.clear();
      pointsSource.value?.clear();
      polygonsSource.value?.clear();

      circlesSource.value = null;
      linesSource.value = null;
      pointsSource.value = null;
      polygonsSource.value = null;

      circlesLayer.value = null;
      linesLayer.value = null;
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
      mapLayers.value.push(layer);
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
    pointsSource.value?.clear();
    polygonsSource.value?.clear();

    // Clear tracked layers
    for (const layer of mapLayers.value) {
      if (map.value) {
        map.value.removeLayer(layer as any);
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

      // Set center and zoom directly (no panel offsets during animation)
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

      // For smooth animations during view capture mode, don't apply panel offsets
      // since panels are hidden during animation
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
    const paddingRight = 50;
    const paddingBottom = 50;
    let paddingLeft = 50;

    // Account for open panels (default: true)
    const shouldAccountForPanels = options?.accountForPanels !== false;

    if (shouldAccountForPanels && uiStore) {
      // Top bar (64px high)
      if (uiStore.topBarOpen) {
        paddingTop = 64 + 50; // Top bar height + extra padding
      }

      // Left sidebar (640px wide)
      if (uiStore.sidebarOpen) {
        paddingLeft = 640 + 50; // Sidebar width + extra padding
      }
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
    console.log(
      'refitMap called - sidebar:',
      previousSidebarState,
      '->',
      newSidebarState,
      'topBar:',
      previousTopBarState,
      '->',
      newTopBarState
    );

    if (!map.value) {
      console.log('refitMap early return - no map');
      return;
    }

    const view = map.value.getView();
    const mapSize = map.value.getSize();
    if (!mapSize) {
      console.log('refitMap early return - no mapSize');
      return;
    }

    if (mapSize.length !== 2 || mapSize[0] === undefined || mapSize[1] === undefined) {
      console.log('refitMap early return - invalid mapSize');
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
      console.log('refitMap early return - no currentCenter');
      return;
    }

    const resolution = view.getResolution();
    if (!resolution) {
      console.log('refitMap early return - no resolution');
      return;
    }

    console.log('Map size:', mapWidth, 'x', mapHeight, 'Resolution:', resolution);

    // Calculate the shift needed for sidebar (horizontal)
    const sidebarWidth = 640;
    let offsetPixelsX = 0;

    if (previousSidebarState !== undefined && newSidebarState !== undefined) {
      if (previousSidebarState && !newSidebarState) {
        // Sidebar was open, now closed - shift RIGHT to recenter
        const previousVisibleCenter = sidebarWidth + (mapWidth - sidebarWidth) / 2;
        const newVisibleCenter = mapWidth / 2;
        offsetPixelsX = previousVisibleCenter - newVisibleCenter;
        console.log(
          'Sidebar closing - Previous center:',
          previousVisibleCenter,
          'New center:',
          newVisibleCenter,
          'Offset:',
          offsetPixelsX
        );
      } else if (!previousSidebarState && newSidebarState) {
        // Sidebar was closed, now open - shift LEFT to keep content visible
        const previousVisibleCenter = mapWidth / 2;
        const newVisibleCenter = sidebarWidth + (mapWidth - sidebarWidth) / 2;
        offsetPixelsX = previousVisibleCenter - newVisibleCenter;
        console.log(
          'Sidebar opening - Previous center:',
          previousVisibleCenter,
          'New center:',
          newVisibleCenter,
          'Offset:',
          offsetPixelsX
        );
      }
    }

    // Calculate the shift needed for top bar (vertical)
    const topBarHeight = 64;
    let offsetPixelsY = 0;

    if (previousTopBarState !== undefined && newTopBarState !== undefined) {
      if (previousTopBarState && !newTopBarState) {
        // Top bar was open, now closed - shift UP to recenter
        const previousVisibleCenter = topBarHeight + (mapHeight - topBarHeight) / 2;
        const newVisibleCenter = mapHeight / 2;
        offsetPixelsY = newVisibleCenter - previousVisibleCenter;
        console.log(
          'Top bar closing - Previous center:',
          previousVisibleCenter,
          'New center:',
          newVisibleCenter,
          'Offset:',
          offsetPixelsY
        );
      } else if (!previousTopBarState && newTopBarState) {
        // Top bar was closed, now open - shift DOWN to keep content visible
        const previousVisibleCenter = mapHeight / 2;
        const newVisibleCenter = topBarHeight + (mapHeight - topBarHeight) / 2;
        offsetPixelsY = newVisibleCenter - previousVisibleCenter;
        console.log(
          'Top bar opening - Previous center:',
          previousVisibleCenter,
          'New center:',
          newVisibleCenter,
          'Offset:',
          offsetPixelsY
        );
      }
    }

    // Convert pixel offsets to map coordinate offsets
    const offsetX = offsetPixelsX * resolution;
    const offsetY = offsetPixelsY * resolution;

    console.log('Pixel offset X:', offsetPixelsX, 'Map offset X:', offsetX);
    console.log('Pixel offset Y:', offsetPixelsY, 'Map offset Y:', offsetY);

    // Calculate new center (shift in both X and Y directions)
    const newCenter = [currentCenter[0] + offsetX, currentCenter[1] + offsetY];

    console.log('Current center:', currentCenter, 'New center:', newCenter);

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

    const handler = (event: any) => {
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

  /**
   * Capture a screenshot of the current map view
   * Returns a base64 encoded image data URL
   */
  const captureScreenshot = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!map.value) {
        reject(new Error('Map not initialized'));
        return;
      }

      // Use OpenLayers' once method to wait for the next render complete
      map.value.once('rendercomplete', () => {
        try {
          // Get the map canvas
          const mapCanvas = document.createElement('canvas');
          const size = map.value!.getSize();
          if (!size || size[0] === undefined || size[1] === undefined) {
            reject(new Error('Could not get map size'));
            return;
          }

          mapCanvas.width = size[0];
          mapCanvas.height = size[1];
          const mapContext = mapCanvas.getContext('2d');
          if (!mapContext) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          // Get all canvas elements from the map
          const canvases = document.querySelectorAll(`#${containerId} canvas`);
          for (const canvas of canvases) {
            const htmlCanvas = canvas as HTMLCanvasElement;
            if (htmlCanvas.width > 0) {
              const opacity = (canvas.parentNode as HTMLElement)?.style.opacity || '1';
              mapContext.globalAlpha = Number.parseFloat(opacity);
              const transform = htmlCanvas.style.transform;

              // Get canvas position
              const matrix = transform?.match(/matrix.*\((.+)\)/);
              if (matrix && matrix[1]) {
                const values = matrix[1].split(', ');
                const x = Number.parseFloat(values[4] || '0');
                const y = Number.parseFloat(values[5] || '0');
                mapContext.drawImage(htmlCanvas, x, y);
              } else {
                mapContext.drawImage(htmlCanvas, 0, 0);
              }
            }
          }

          // Convert to data URL
          const dataURL = mapCanvas.toDataURL('image/png');
          resolve(dataURL);
        } catch (error) {
          reject(error);
        }
      });

      // Trigger a render
      map.value.render();
    });
  };

  return {
    map,
    isMapInitialized,
    mapLayers,
    circlesLayer,
    linesLayer,
    pointsLayer,
    polygonsLayer,
    circlesSource,
    linesSource,
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
    captureScreenshot,
  };
}
