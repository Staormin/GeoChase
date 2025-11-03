import type { Ref } from 'vue';
import type { useDrawing } from '@/composables/useDrawing';
import type { useMap } from '@/composables/useMap';
import { watch } from 'vue';
import {
  calculateBearing,
  calculateDistance,
  destinationPoint,
  generateLinePointsLinear,
} from '@/services/geometry';
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

  const handleMouseMove = (event: any) => {
    if (!uiStore.freeHandDrawing.isDrawing) {
      cursorTooltip.value.visible = false;
      return;
    }

    const map = mapContainer.map?.value;
    if (!map) return;

    const { lat, lng } = event.latlng;
    const { startCoord, azimuth } = uiStore.freeHandDrawing;

    // Check for alt (lock azimuth) and ctrl (lock distance) keys
    const isAltPressed = event.originalEvent?.altKey || false;
    const isCtrlPressed = event.originalEvent?.ctrlKey || false;

    // Update cursor tooltip position (offset from cursor)
    const containerPoint = event.containerPoint;
    cursorTooltip.value.x = containerPoint.x + 20;
    cursorTooltip.value.y = containerPoint.y + 20;

    // Parse start coordinates if provided
    let startLat: number, startLon: number;
    if (startCoord && startCoord.trim() !== '') {
      const parts = startCoord.split(',').map((s: string) => Number.parseFloat(s.trim()));
      if (parts.length === 2 && !parts.some((p: number) => Number.isNaN(p))) {
        startLat = parts[0]!;
        startLon = parts[1]!;
      } else {
        cursorTooltip.value.visible = false;
        return;
      }
    } else {
      cursorTooltip.value.visible = false;
      return;
    }

    // Calculate distance and bearing
    let distance = calculateDistance(startLat, startLon, lat, lng);
    let bearing = calculateBearing(startLat, startLon, lat, lng);

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

    const inverseBearing = (bearing + 180) % 360;
    const effectiveAzimuth = azimuth === undefined ? (isAltPressed ? bearing : null) : azimuth;

    // Update tooltip content
    cursorTooltip.value.distance = `${distance.toFixed(3)} km${isCtrlPressed && azimuth === undefined ? ' (locked)' : ''}`;
    if (azimuth !== undefined) {
      const inverseAzimuth = (azimuth + 180) % 360;
      cursorTooltip.value.azimuth = `${azimuth.toFixed(2)}° / ${inverseAzimuth.toFixed(2)}° (locked)`;
    } else if (isAltPressed) {
      cursorTooltip.value.azimuth = `${bearing.toFixed(2)}° / ${inverseBearing.toFixed(2)}° (Alt)`;
    } else {
      cursorTooltip.value.azimuth = `${bearing.toFixed(2)}° / ${inverseBearing.toFixed(2)}°`;
    }
    cursorTooltip.value.visible = true;

    let endLat: number, endLon: number;

    // Calculate endpoint based on azimuth constraints
    if (effectiveAzimuth !== null && startCoord && startCoord.trim() !== '') {
      const endpoint = destinationPoint(startLat, startLon, distance, effectiveAzimuth);
      endLat = endpoint.lat;
      endLon = endpoint.lon;
    } else {
      if (isCtrlPressed && lockedDistance !== null && azimuth === undefined) {
        const endpoint = destinationPoint(startLat, startLon, lockedDistance, bearing);
        endLat = endpoint.lat;
        endLon = endpoint.lon;
      } else {
        endLat = lat;
        endLon = lng;
      }
    }

    // Remove previous preview layer
    if (freeHandPreviewLayer) {
      map.removeLayer(freeHandPreviewLayer);
    }

    // Draw preview line
    const L = (window as any).L;
    const linePoints = generateLinePointsLinear(startLat, startLon, endLat, endLon, 100);
    freeHandPreviewLayer = L.polyline(
      linePoints.map((p: any) => [p.lat, p.lon]),
      {
        color: '#000000',
        weight: 3,
        opacity: 0.8,
      }
    ).addTo(map);
  };

  const handleMapClick = async (event: any) => {
    if (!uiStore.freeHandDrawing.isDrawing) return;

    const map = mapContainer.map?.value;
    if (!map) return;

    const { lat, lng } = event.latlng;
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
    let distance = calculateDistance(startLat, startLon, lat, lng);
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
      const dist = calculateDistance(startLat, startLon, lat, lng);
      const endpoint = destinationPoint(startLat, startLon, dist, azimuth);
      endLat = endpoint.lat;
      endLon = endpoint.lon;
    }

    // Remove preview layer
    if (freeHandPreviewLayer) {
      map.removeLayer(freeHandPreviewLayer);
      freeHandPreviewLayer = null;
    }

    // Draw the actual line
    let lineName = name;
    if (!lineName) {
      const dist = calculateDistance(startLat, startLon, endLat, endLon);
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
      if (freeHandPreviewLayer && mapContainer.map?.value) {
        mapContainer.map.value.removeLayer(freeHandPreviewLayer);
        freeHandPreviewLayer = null;
      }
    }
  };

  // Setup event listeners
  const setup = () => {
    if (mapContainer.map?.value) {
      mapContainer.map.value.on('mousemove', handleMouseMove);
      mapContainer.map.value.on('click', handleMapClick);
    }

    // Watch for free hand drawing mode changes to clean up preview
    watch(
      () => uiStore.freeHandDrawing.isDrawing,
      (isDrawing) => {
        if (!isDrawing && freeHandPreviewLayer && mapContainer.map?.value) {
          mapContainer.map.value.removeLayer(freeHandPreviewLayer);
          freeHandPreviewLayer = null;
        }
      }
    );
  };

  // Cleanup
  const cleanup = () => {
    if (mapContainer.map?.value) {
      mapContainer.map.value.off('mousemove', handleMouseMove);
      mapContainer.map.value.off('click', handleMapClick);
      if (freeHandPreviewLayer) {
        mapContainer.map.value.removeLayer(freeHandPreviewLayer);
      }
    }
  };

  return {
    setup,
    cleanup,
    handleEscape,
  };
}
