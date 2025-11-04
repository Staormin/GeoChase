import type { MapBrowserEvent } from 'ol';
import type { Ref } from 'vue';
import type { useDrawing } from '@/composables/useDrawing';
import type { useMap } from '@/composables/useMap';
import { Feature } from 'ol';
import { LineString } from 'ol/geom';
import { fromLonLat, toLonLat } from 'ol/proj';
import { getDistance } from 'ol/sphere';
import { Stroke, Style } from 'ol/style';
import { watch } from 'vue';
import { calculateBearing, destinationPoint } from '@/services/geometry';
import { useUIStore } from '@/stores/ui';

interface CursorTooltipData {
  visible: boolean;
  x: number;
  y: number;
  distance: string;
  azimuth: string;
}

/**
 * Composable for free hand drawing mode with mouse tracking and line preview
 */
export function useFreeHandDrawing(
  mapContainer: ReturnType<typeof useMap>,
  drawing: ReturnType<typeof useDrawing>,
  cursorTooltip: Ref<CursorTooltipData>
) {
  const uiStore = useUIStore();
  let freeHandPreviewLayer: any = null;
  let lockedAzimuth: number | null = null;
  let lockedDistance: number | null = null;

  // Helper to parse start coordinates
  const parseStartCoordinates = (
    startCoord: string | null
  ): { lat: number; lon: number } | null => {
    if (!startCoord || startCoord.trim() === '') {
      return null;
    }

    const parts = startCoord.split(',').map((s: string) => Number.parseFloat(s.trim()));
    if (parts.length === 2 && !parts.some((p: number) => Number.isNaN(p))) {
      return { lat: parts[0]!, lon: parts[1]! };
    }

    return null;
  };

  // Helper to calculate bearing and distance with locking
  const calculateBearingAndDistance = (
    startLat: number,
    startLon: number,
    endLat: number,
    endLon: number,
    isAltPressed: boolean,
    isCtrlPressed: boolean,
    azimuth: number | undefined
  ): { distance: number; bearing: number } => {
    // getDistance returns meters, convert to km
    let distance = getDistance([startLon, startLat], [endLon, endLat]) / 1000;
    let bearing = calculateBearing(startLat, startLon, endLat, endLon);

    // Handle alt key - lock azimuth
    if (isAltPressed && azimuth === undefined) {
      if (lockedAzimuth === null) {
        lockedAzimuth = bearing;
      }
      bearing = lockedAzimuth;
    } else if (azimuth === undefined) {
      lockedAzimuth = null;
    }

    // Handle ctrl key - lock distance
    if (isCtrlPressed && azimuth === undefined) {
      if (lockedDistance === null) {
        lockedDistance = distance;
      }
      distance = lockedDistance;
    } else {
      lockedDistance = null;
    }

    return { distance, bearing };
  };

  // Helper to update tooltip
  const updateTooltipContent = (
    distance: number,
    bearing: number,
    azimuth: number | undefined,
    isAltPressed: boolean,
    isCtrlPressed: boolean
  ): void => {
    const inverseBearing = (bearing + 180) % 360;

    cursorTooltip.value.distance = `${distance.toFixed(3)} km${isCtrlPressed && azimuth === undefined ? ' (locked)' : ''}`;

    if (azimuth !== undefined) {
      const inverseAzimuth = (azimuth + 180) % 360;
      cursorTooltip.value.azimuth = `${azimuth.toFixed(2)}° / ${inverseAzimuth.toFixed(2)}° (locked)`;
    } else if (isAltPressed) {
      cursorTooltip.value.azimuth = `${bearing.toFixed(2)}° / ${inverseBearing.toFixed(2)}° (Alt)`;
    } else {
      cursorTooltip.value.azimuth = `${bearing.toFixed(2)}° / ${inverseBearing.toFixed(2)}°`;
    }
  };

  // Helper to calculate endpoint based on constraints
  const calculateEndpoint = (
    startLat: number,
    startLon: number,
    cursorLat: number,
    cursorLon: number,
    distance: number,
    bearing: number,
    azimuth: number | undefined,
    isCtrlPressed: boolean
  ): { lat: number; lon: number } => {
    const effectiveAzimuth = azimuth === undefined ? (lockedAzimuth ?? null) : azimuth;

    if (effectiveAzimuth !== null) {
      const endpoint = destinationPoint(startLat, startLon, distance, effectiveAzimuth);
      return { lat: endpoint.lat, lon: endpoint.lon };
    } else if (isCtrlPressed && lockedDistance !== null && azimuth === undefined) {
      const endpoint = destinationPoint(startLat, startLon, lockedDistance, bearing);
      return { lat: endpoint.lat, lon: endpoint.lon };
    }

    return { lat: cursorLat, lon: cursorLon };
  };

  // Helper to draw preview line
  const drawPreviewLine = (
    startLat: number,
    startLon: number,
    endLat: number,
    endLon: number
  ): void => {
    // Remove previous preview layer
    if (freeHandPreviewLayer) {
      const previewSource = mapContainer.linesSource?.value;
      if (previewSource) {
        previewSource.removeFeature(freeHandPreviewLayer);
      }
    }

    // OpenLayers natively renders straight lines in Web Mercator projection
    // No need for 100-point interpolation - just use start and end points
    const coordinates = [fromLonLat([startLon, startLat]), fromLonLat([endLon, endLat])];

    const lineGeometry = new LineString(coordinates);
    freeHandPreviewLayer = new Feature({
      geometry: lineGeometry,
    });

    freeHandPreviewLayer.setStyle(
      new Style({
        stroke: new Stroke({
          color: '#000000',
          width: 3,
        }),
      })
    );

    const previewSource = mapContainer.linesSource?.value;
    if (previewSource) {
      previewSource.addFeature(freeHandPreviewLayer);
    }
  };

  const handleMouseMove = (event: MapBrowserEvent<any>) => {
    if (!uiStore.freeHandDrawing.isDrawing) {
      cursorTooltip.value.visible = false;
      return;
    }

    const map = mapContainer.map?.value;
    if (!map) {
      return;
    }

    // Get coordinates from OpenLayers event
    const coordinate = event.coordinate;
    const lonLat = toLonLat(coordinate);
    const lng = lonLat[0];
    const lat = lonLat[1];

    if (lng === undefined || lat === undefined) {
      cursorTooltip.value.visible = false;
      return;
    }

    const { startCoord, azimuth } = uiStore.freeHandDrawing;
    const isAltPressed = event.originalEvent?.altKey || false;
    const isCtrlPressed = event.originalEvent?.ctrlKey || false;

    // Update cursor tooltip position
    const pixel = event.pixel;
    cursorTooltip.value.x = (pixel[0] ?? 0) + 20;
    cursorTooltip.value.y = (pixel[1] ?? 0) + 20;

    // Parse start coordinates
    const startCoords = parseStartCoordinates(startCoord);
    if (!startCoords) {
      cursorTooltip.value.visible = false;
      return;
    }

    // Calculate bearing and distance with locks
    const { distance, bearing } = calculateBearingAndDistance(
      startCoords.lat,
      startCoords.lon,
      lat,
      lng,
      isAltPressed,
      isCtrlPressed,
      azimuth
    );

    // Update tooltip content
    updateTooltipContent(distance, bearing, azimuth, isAltPressed, isCtrlPressed);
    cursorTooltip.value.visible = true;

    // Calculate endpoint
    const endpoint = calculateEndpoint(
      startCoords.lat,
      startCoords.lon,
      lat,
      lng,
      distance,
      bearing,
      azimuth,
      isCtrlPressed
    );

    // Draw preview line
    drawPreviewLine(startCoords.lat, startCoords.lon, endpoint.lat, endpoint.lon);
  };

  const handleMapClick = async (event: MapBrowserEvent<any>) => {
    if (!uiStore.freeHandDrawing.isDrawing) {
      return;
    }

    const map = mapContainer.map?.value;
    if (!map) {
      return;
    }

    // Get coordinates from OpenLayers event
    const coordinate = event.coordinate;
    const lonLat = toLonLat(coordinate);
    const lng = lonLat[0];
    const lat = lonLat[1];

    // Type guard for coordinates
    if (lng === undefined || lat === undefined) {
      return;
    }

    const { startCoord, azimuth, name } = uiStore.freeHandDrawing;

    const isAltPressed = event.originalEvent?.altKey || false;
    const isCtrlPressed = event.originalEvent?.ctrlKey || false;

    // Parse start coordinates
    let startLat: number, startLon: number;
    if (startCoord && startCoord.trim() !== '') {
      const parts = startCoord.split(',').map((s: string) => Number.parseFloat(s.trim()));
      if (parts.length === 2 && !parts.some((p: number) => Number.isNaN(p))) {
        startLat = parts[0]!;
        startLon = parts[1]!;
      } else {
        uiStore.addToast('Invalid start coordinates', 'error');
        uiStore.stopFreeHandDrawing();
        return;
      }
    } else {
      // Set start point on first click
      uiStore.freeHandDrawing.startCoord = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      uiStore.addToast('Start point set. Click again to set the endpoint.', 'info');
      return;
    }

    let endLat: number, endLon: number;
    // getDistance returns meters, convert to km
    let distance = getDistance([startLon, startLat], [lng, lat]) / 1000;
    let bearing = calculateBearing(startLat, startLon, lat, lng);

    // Calculate endpoint based on constraints
    if (azimuth === undefined) {
      if (isAltPressed && lockedAzimuth !== null) {
        bearing = lockedAzimuth;
      }
      if (isCtrlPressed && lockedDistance !== null) {
        distance = lockedDistance;
      }

      if (isAltPressed && lockedAzimuth !== null) {
        const endpoint = destinationPoint(startLat, startLon, distance, lockedAzimuth);
        endLat = endpoint.lat;
        endLon = endpoint.lon;
      } else if (isCtrlPressed && lockedDistance !== null) {
        const endpoint = destinationPoint(startLat, startLon, lockedDistance, bearing);
        endLat = endpoint.lat;
        endLon = endpoint.lon;
      } else {
        endLat = lat;
        endLon = lng;
      }
    } else {
      // getDistance returns meters, convert to km
      const dist = getDistance([startLon, startLat], [lng, lat]) / 1000;
      const endpoint = destinationPoint(startLat, startLon, dist, azimuth);
      endLat = endpoint.lat;
      endLon = endpoint.lon;
    }

    // Remove preview layer
    if (freeHandPreviewLayer) {
      const previewSource = mapContainer.linesSource?.value;
      if (previewSource) {
        previewSource.removeFeature(freeHandPreviewLayer);
      }
      freeHandPreviewLayer = null;
    }

    // Draw the actual line
    let lineName = name;
    if (!lineName) {
      // getDistance returns meters, convert to km
      const dist = getDistance([startLon, startLat], [endLon, endLat]) / 1000;
      const finalBearing = calculateBearing(startLat, startLon, endLat, endLon);
      const inverseBearing = (finalBearing + 180) % 360;
      lineName = `Line ${dist.toFixed(1)}km • ${finalBearing.toFixed(1)}°/${inverseBearing.toFixed(1)}°`;
    }

    drawing.drawLineSegment(
      startLat,
      startLon,
      endLat,
      endLon,
      lineName,
      'coordinate',
      undefined,
      azimuth,
      undefined,
      undefined,
      undefined
    );

    uiStore.addToast('Line segment added successfully!', 'success');
    uiStore.stopFreeHandDrawing();

    // Reset locked values
    lockedAzimuth = null;
    lockedDistance = null;
  };

  const handleEscape = () => {
    if (uiStore.freeHandDrawing.isDrawing) {
      uiStore.stopFreeHandDrawing();
      uiStore.addToast('Free hand drawing cancelled', 'info');

      // Reset locked values and clean up preview layer
      lockedAzimuth = null;
      lockedDistance = null;
      if (freeHandPreviewLayer && mapContainer.linesSource?.value) {
        mapContainer.linesSource.value.removeFeature(freeHandPreviewLayer);
        freeHandPreviewLayer = null;
      }
    }
  };

  // Setup event listeners
  const setup = () => {
    if (mapContainer.map?.value) {
      mapContainer.map.value.on('pointermove', handleMouseMove);
      mapContainer.map.value.on('click', handleMapClick);
    }

    // Watch for free hand drawing mode changes to clean up preview
    watch(
      () => uiStore.freeHandDrawing.isDrawing,
      (isDrawing) => {
        if (!isDrawing && freeHandPreviewLayer && mapContainer.linesSource?.value) {
          mapContainer.linesSource.value.removeFeature(freeHandPreviewLayer);
          freeHandPreviewLayer = null;
        }
      }
    );
  };

  // Cleanup
  const cleanup = () => {
    if (mapContainer.map?.value) {
      mapContainer.map.value.un('pointermove', handleMouseMove);
      mapContainer.map.value.un('click', handleMapClick);
      if (freeHandPreviewLayer && mapContainer.linesSource?.value) {
        mapContainer.linesSource.value.removeFeature(freeHandPreviewLayer);
      }
    }
  };

  return {
    setup,
    cleanup,
    handleEscape,
  };
}
