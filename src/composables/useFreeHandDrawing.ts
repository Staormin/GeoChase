import type { useDrawing } from '@/composables/useDrawing';
/**
 * Composable for free hand drawing mode with mouse tracking and line preview
 */
import type { useMap } from '@/composables/useMap';
import type { PointElement } from '@/types/project';
import type { CursorTooltipData } from '@/types/ui';
import type { MapBrowserEvent } from 'ol';
import type { Ref, WatchStopHandle } from 'vue';
import { Feature } from 'ol';
import { LineString } from 'ol/geom';
import Interaction from 'ol/interaction/Interaction';
import { toLonLat } from 'ol/proj';
import { Stroke, Style } from 'ol/style';
import { watch } from 'vue';
import { useDistanceDisplay } from '@/composables/useDistanceDisplay';
import { useMapCursor } from '@/composables/useMapCursor';
import { useProjectGeometry } from '@/composables/useProjectGeometry';
import { i18n } from '@/plugins/i18n';
import { createIntersectionRay } from '@/services/intersectionEditing';
import { useLayersStore } from '@/stores/layers';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';

export function useFreeHandDrawing(
  mapContainer: ReturnType<typeof useMap>,
  drawing: ReturnType<typeof useDrawing>,
  cursorTooltip: Ref<CursorTooltipData>
) {
  const { formatDistance } = useDistanceDisplay();
  const { getDistance, calculateBearing, destinationPoint, lineCoordinates } = useProjectGeometry();
  const uiStore = useUIStore();
  let previewFeature: Feature<LineString> | null = null;
  let lockedAzimuth: number | null = null;
  let lockedDistance: number | null = null;
  const layers = useLayersStore();
  const projects = useProjectsStore();
  let intersectionLock: {
    point: PointElement;
    ray: ReturnType<typeof createIntersectionRay>;
  } | null = null;
  let lastPointer: MapBrowserEvent | null = null;
  const setCursor = useMapCursor(mapContainer, 20);
  let pendingDrag: { point: PointElement; pixel: number[]; pointerId: number } | null = null;
  let dragging = false;
  let pointInteraction: Interaction | undefined;

  function sameCoordinates(a: PointElement['coordinates'], b: PointElement['coordinates']) {
    return Math.abs(a.lat - b.lat) < 1e-9 && Math.abs(a.lon - b.lon) < 1e-9;
  }

  function pointAt(
    pixel: number[],
    excluded?: PointElement['coordinates']
  ): PointElement | undefined {
    return mapContainer.map.value?.forEachFeatureAtPixel(
      pixel,
      (feature) => {
        const id = feature.getId();
        if (
          typeof id === 'string' &&
          mapContainer.pointsSource.value?.getFeatureById(id) === feature &&
          uiStore.isElementVisible('point', id)
        ) {
          const point = layers.points.find((point) => point.id === id);
          if (point && (!excluded || !sameCoordinates(point.coordinates, excluded))) return point;
        }
      },
      { hitTolerance: 10 }
    );
  }

  function snapPoint(event: MapBrowserEvent) {
    const start = parseStartCoordinates(uiStore.freeHandDrawing.startCoord);
    // A preset azimuth remains an explicit direction constraint after choosing the start.
    if (start && uiStore.freeHandDrawing.azimuth !== undefined) return;
    return pointAt(event.pixel, start ?? undefined);
  }

  function updateIntersectionLock(snapped: PointElement | undefined, alt: boolean) {
    if (!alt) {
      if (intersectionLock) lockedAzimuth = null;
      intersectionLock = null;
    } else if (!intersectionLock && snapped) {
      const start = parseStartCoordinates(uiStore.freeHandDrawing.startCoord);
      if (!start) return;
      try {
        intersectionLock = {
          point: snapped,
          ray: createIntersectionRay(start, snapped.coordinates, projects.activeProjection),
        };
        lockedAzimuth = null;
        lockedDistance = null;
      } catch {
        // Coincident points cannot define an intersection direction.
      }
    }
    uiStore.freeHandDrawing.intersectionPointName = intersectionLock?.point.name;
  }

  function pointerState(event: MapBrowserEvent, altOverride?: boolean) {
    const coordinate = event.coordinate;
    const lonLat = toLonLat(coordinate);
    const candidate = snapPoint(event);
    const alt = altOverride ?? (event.originalEvent?.altKey || false);
    updateIntersectionLock(candidate, alt);
    const snapped = intersectionLock ? undefined : candidate;
    const endpoint = intersectionLock?.ray.pointAt(
      intersectionLock.ray.closest(coordinate).parameter
    );
    const lng = endpoint?.lon ?? snapped?.coordinates.lon ?? lonLat[0];
    const lat = endpoint?.lat ?? snapped?.coordinates.lat ?? lonLat[1];
    uiStore.freeHandDrawing.snappedPointName = snapped?.name;
    setCursor(snapped ? 'pointer' : 'crosshair');
    return {
      lat,
      lng,
      snapped,
      isAltPressed: !intersectionLock && !snapped && alt,
      isCtrlPressed: !intersectionLock && !snapped && (event.originalEvent?.ctrlKey || false),
    };
  }

  function resetGesture() {
    pendingDrag = null;
    dragging = false;
    intersectionLock = null;
    lastPointer = null;
    setCursor(null);
    lockedAzimuth = null;
    lockedDistance = null;
    cursorTooltip.value.visible = false;
  }

  function cancelGesture() {
    if (uiStore.freeHandDrawing.isDrawing) uiStore.stopFreeHandDrawing();
    resetGesture();
  }

  function cancelPointer(event: PointerEvent) {
    if (pendingDrag?.pointerId === event.pointerId) cancelGesture();
  }

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
    isCtrlPressed: boolean,
    inverseBearing: number
  ): void => {
    cursorTooltip.value.distance = `${formatDistance(distance)}${isCtrlPressed && azimuth === undefined ? ' (locked)' : ''}`;

    if (azimuth !== undefined) {
      const inverseAzimuth = inverseBearing;
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
    if (previewFeature) {
      const previewSource = mapContainer.linesSource?.value;
      if (previewSource) {
        previewSource.removeFeature(previewFeature);
      }
    }

    const coordinates = lineCoordinates(
      { lat: startLat, lon: startLon },
      { lat: endLat, lon: endLon }
    );

    const lineGeometry = new LineString(coordinates);
    previewFeature = new Feature({
      geometry: lineGeometry,
    });

    previewFeature.setStyle(
      new Style({
        stroke: new Stroke({
          color: '#000000',
          width: 3,
        }),
      })
    );

    const previewSource = mapContainer.linesSource?.value;
    if (previewSource) {
      previewSource.addFeature(previewFeature);
    }
  };

  const handleMouseMove = (event: MapBrowserEvent, altOverride?: boolean) => {
    if (!uiStore.freeHandDrawing.isDrawing) {
      // Don't clobber the tooltip when another feature (e.g. a tool like the
      // ruler) is currently driving it.
      if (!uiStore.tools.activeTool) {
        cursorTooltip.value.visible = false;
      }
      return;
    }

    const map = mapContainer.map?.value;
    if (!map) {
      return;
    }

    lastPointer = event;
    const { lat, lng, isAltPressed, isCtrlPressed } = pointerState(event, altOverride);

    if (lng === undefined || lat === undefined) {
      cursorTooltip.value.visible = false;
      return;
    }

    const { startCoord, azimuth } = uiStore.freeHandDrawing;

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

    let endpoint;
    try {
      // Calculate endpoint
      endpoint = calculateEndpoint(
        startCoords.lat,
        startCoords.lon,
        lat,
        lng,
        distance,
        bearing,
        azimuth,
        isCtrlPressed
      );
    } catch {
      cursorTooltip.value.visible = false;
      if (previewFeature) mapContainer.linesSource?.value?.removeFeature(previewFeature);
      previewFeature = null;
      return;
    }
    const inverseBearing = calculateBearing(
      endpoint.lat,
      endpoint.lon,
      startCoords.lat,
      startCoords.lon
    );
    updateTooltipContent(distance, bearing, azimuth, isAltPressed, isCtrlPressed, inverseBearing);
    cursorTooltip.value.visible = true;

    // Draw preview line
    drawPreviewLine(startCoords.lat, startCoords.lon, endpoint.lat, endpoint.lon);
  };

  const handleMapClick = async (event: MapBrowserEvent) => {
    if (!uiStore.freeHandDrawing.isDrawing) {
      return;
    }

    // Consume drawing clicks before completion re-enables other map interactions.
    event.stopPropagation();

    const map = mapContainer.map?.value;
    if (!map) {
      return;
    }

    const { lat, lng, snapped, isAltPressed, isCtrlPressed } = pointerState(event);

    // Type guard for coordinates
    if (lng === undefined || lat === undefined) {
      return;
    }

    const { startCoord, azimuth, name } = uiStore.freeHandDrawing;

    const start = parseStartCoordinates(startCoord);
    if (!start) {
      if (startCoord?.trim()) {
        uiStore.addToast('Invalid start coordinates', 'error');
        uiStore.stopFreeHandDrawing();
      } else {
        uiStore.freeHandDrawing.startCoord = `${lat}, ${lng}`;
        uiStore.freeHandDrawing.snappedPointName = undefined;
        uiStore.addToast('Start point set. Click again to set the endpoint.', 'info');
      }
      return;
    }
    const { lat: startLat, lon: startLon } = start;

    let endLat: number, endLon: number;
    // getDistance returns meters, convert to km
    let distance = getDistance([startLon, startLat], [lng, lat]) / 1000;
    let bearing = calculateBearing(startLat, startLon, lat, lng);

    try {
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
    } catch {
      uiStore.addToast(i18n.global.t('line.errors.unreachableDestination'), 'error');
      return;
    }

    // Remove preview layer
    if (previewFeature) {
      const previewSource = mapContainer.linesSource?.value;
      if (previewSource) {
        previewSource.removeFeature(previewFeature);
      }
      previewFeature = null;
    }

    // Draw the actual line
    let lineName = name;
    const origin = layers.points.find((point) =>
      sameCoordinates(point.coordinates, { lat: startLat, lon: startLon })
    );
    if (!lineName && snapped && origin) lineName = `${origin.name} → ${snapped.name}`;
    if (!lineName) {
      // getDistance returns meters, convert to km
      const dist = getDistance([startLon, startLat], [endLon, endLat]) / 1000;
      const finalBearing = calculateBearing(startLat, startLon, endLat, endLon);
      const inverseBearing = calculateBearing(endLat, endLon, startLat, startLon);
      lineName = `Line ${formatDistance(dist, 1)} • ${finalBearing.toFixed(1)}°/${inverseBearing.toFixed(1)}°`;
    }

    const through = intersectionLock?.point.coordinates;
    const totalDistance = through
      ? getDistance([startLon, startLat], [endLon, endLat]) / 1000
      : undefined;
    drawing.drawLineSegment(
      startLat,
      startLon,
      endLat,
      endLon,
      lineName,
      through ? 'intersection' : 'coordinate',
      totalDistance,
      through ? undefined : azimuth,
      through?.lat,
      through?.lon,
      totalDistance
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
      if (previewFeature && mapContainer.linesSource?.value) {
        mapContainer.linesSource.value.removeFeature(previewFeature);
        previewFeature = null;
      }
    }
  };

  function handleAlt(event: KeyboardEvent) {
    if (event.key !== 'Alt' || event.repeat || !uiStore.freeHandDrawing.isDrawing || !lastPointer)
      return;
    event.preventDefault();
    handleMouseMove(lastPointer, event.type === 'keydown');
  }

  // Setup event listeners
  let stopToolWatch: WatchStopHandle | undefined;

  const setup = () => {
    const map = mapContainer.map.value;
    if (map) {
      pointInteraction = new Interaction({
        handleEvent(event) {
          const original = event.originalEvent;
          if (event.type === 'pointerdown') {
            if (pendingDrag) {
              cancelGesture();
              return false;
            }
            if (
              !uiStore.canInteractWithLines ||
              uiStore.intersectionLineEdit ||
              !('button' in original) ||
              original.button !== 0 ||
              !('pointerId' in original) ||
              original.isPrimary === false
            )
              return true;
            const point = pointAt(event.pixel);
            if (!point) return true;
            pendingDrag = { point, pixel: [...event.pixel], pointerId: original.pointerId };
            // Reserve this gesture before DragPan sees its initial pointerdown.
            return false;
          }
          if (
            !pendingDrag ||
            !('pointerId' in original) ||
            original.pointerId !== pendingDrag.pointerId
          )
            return true;
          if (event.type === 'pointerdrag') {
            if (!dragging) {
              if (
                Math.hypot(
                  event.pixel[0]! - pendingDrag.pixel[0]!,
                  event.pixel[1]! - pendingDrag.pixel[1]!
                ) < 5
              )
                return false;
              if (!uiStore.canInteractWithLines) {
                resetGesture();
                return false;
              }
              const { lat, lon } = pendingDrag.point.coordinates;
              uiStore.startFreeHandDrawing(`${lat}, ${lon}`, undefined, '', true);
              uiStore.freeHandDrawing.draggingFromPoint = true;
              dragging = true;
            }
            handleMouseMove(event);
            return false;
          }
          if (event.type === 'pointerup') {
            const wasDragging = dragging;
            pendingDrag = null;
            dragging = false;
            if (!wasDragging) return true;
            uiStore.freeHandDrawing.draggingFromPoint = false;
            const target = document.elementFromPoint(original.clientX, original.clientY);
            if (!target || !map.getViewport()?.contains(target)) cancelGesture();
            else if (intersectionLock || snapPoint(event)) void handleMapClick(event);
            else handleMouseMove(event);
            return false;
          }
          return true;
        },
      });
      map.addInteraction(pointInteraction);
      map.getViewport()?.addEventListener('pointercancel', cancelPointer);
      window.addEventListener('blur', cancelGesture);
      document.addEventListener('keydown', handleAlt);
      document.addEventListener('keyup', handleAlt);
      map.on('pointermove', handleMouseMove);
      map.on('click', handleMapClick);
    }

    // Watch for free hand drawing mode changes to clean up preview
    stopToolWatch?.();
    stopToolWatch = watch(
      () => uiStore.freeHandDrawing.isDrawing,
      (isDrawing) => {
        if (!isDrawing) {
          if (previewFeature) mapContainer.linesSource.value?.removeFeature(previewFeature);
          previewFeature = null;
          resetGesture();
        }
      },
      { flush: 'sync' }
    );
  };

  // Cleanup
  const cleanup = () => {
    cancelGesture();
    window.removeEventListener('blur', cancelGesture);
    document.removeEventListener('keydown', handleAlt);
    document.removeEventListener('keyup', handleAlt);
    const map = mapContainer.map.value;
    map?.getViewport()?.removeEventListener('pointercancel', cancelPointer);
    if (pointInteraction) map?.removeInteraction(pointInteraction);
    stopToolWatch?.();
    stopToolWatch = undefined;
    if (mapContainer.map?.value) {
      mapContainer.map.value.un('pointermove', handleMouseMove);
      mapContainer.map.value.un('click', handleMapClick);
      if (previewFeature && mapContainer.linesSource?.value) {
        mapContainer.linesSource.value.removeFeature(previewFeature);
      }
    }
  };

  return {
    setup,
    cleanup,
    handleEscape,
  };
}
