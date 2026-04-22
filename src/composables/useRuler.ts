import type { useMap } from '@/composables/useMap';
import type { MapBrowserEvent } from 'ol';
import type { Ref } from 'vue';
import { Feature, Overlay } from 'ol';
import { LineString } from 'ol/geom';
import VectorLayer from 'ol/layer/Vector';
import { fromLonLat, toLonLat } from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import { getDistance } from 'ol/sphere';
import { Stroke, Style } from 'ol/style';
import { watch } from 'vue';
import { calculateBearing } from '@/services/geometry';
import { useUIStore } from '@/stores/ui';

interface CursorTooltipData {
  visible: boolean;
  x: number;
  y: number;
  distance: string;
  azimuth: string;
}

type RulerPhase = 'idle' | 'placed-first';

interface Measurement {
  feature: Feature<LineString>;
  overlay: Overlay;
}

// Two-stroke style so the ruler stays legible on any basemap: a dark halo
// underneath and a bright orange line on top.
const RULER_STYLES = [
  new Style({
    stroke: new Stroke({
      color: 'rgba(0, 0, 0, 0.85)',
      width: 8,
    }),
  }),
  new Style({
    stroke: new Stroke({
      color: '#ff9800',
      width: 4,
    }),
  }),
];

function buildMeasurementElement(distanceKm: number, bearing: number, inverse: number) {
  const el = document.createElement('div');
  el.className = 'ruler-measurement';
  el.style.cssText = `
    background: rgb(var(--v-theme-surface));
    border: 2px solid #ff9800;
    border-radius: 6px;
    padding: 6px 10px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
    font-size: 12px;
    font-family: monospace;
    color: rgb(var(--v-theme-on-surface));
    white-space: nowrap;
    pointer-events: none;
    line-height: 1.4;
  `;
  el.innerHTML = `
    <div><strong>${distanceKm.toFixed(3)} km</strong></div>
    <div>${bearing.toFixed(2)}° / ${inverse.toFixed(2)}°</div>
  `;
  return el;
}

export function useRuler(
  mapContainer: ReturnType<typeof useMap>,
  cursorTooltip: Ref<CursorTooltipData>
) {
  const uiStore = useUIStore();

  let phase: RulerPhase = 'idle';
  let firstPoint: { lat: number; lon: number } | null = null;
  let rulerLayer: VectorLayer<VectorSource> | null = null;
  let rulerSource: VectorSource | null = null;
  // Live feature representing the leg currently being drawn (start → cursor).
  let previewFeature: Feature<LineString> | null = null;
  // All finalized measurements accumulated for the session.
  const measurements: Measurement[] = [];

  const ensureLayer = () => {
    const map = mapContainer.map?.value;
    if (!map || rulerLayer) return;
    rulerSource = new VectorSource();
    rulerLayer = new VectorLayer({
      source: rulerSource,
      className: 'ruler-layer',
      zIndex: 1000,
      updateWhileAnimating: true,
      updateWhileInteracting: true,
    });
    map.addLayer(rulerLayer);
  };

  const setPreviewCoordinates = (
    startLat: number,
    startLon: number,
    endLat: number,
    endLon: number
  ) => {
    if (!rulerSource) return;
    const coords = [fromLonLat([startLon, startLat]), fromLonLat([endLon, endLat])];
    if (previewFeature) {
      previewFeature.getGeometry()?.setCoordinates(coords);
    } else {
      previewFeature = new Feature({ geometry: new LineString(coords) });
      previewFeature.setStyle(RULER_STYLES);
      rulerSource.addFeature(previewFeature);
    }
  };

  const updateCursorTooltip = (
    screenX: number,
    screenY: number,
    endLat: number,
    endLon: number
  ) => {
    if (!firstPoint) return;
    const distanceKm = getDistance([firstPoint.lon, firstPoint.lat], [endLon, endLat]) / 1000;
    const bearing = calculateBearing(firstPoint.lat, firstPoint.lon, endLat, endLon);
    const inverse = (bearing + 180) % 360;
    cursorTooltip.value.x = screenX + 20;
    cursorTooltip.value.y = screenY + 20;
    cursorTooltip.value.distance = `${distanceKm.toFixed(3)} km`;
    cursorTooltip.value.azimuth = `${bearing.toFixed(2)}° / ${inverse.toFixed(2)}°`;
    cursorTooltip.value.visible = true;
  };

  const hideCursorTooltip = () => {
    cursorTooltip.value.visible = false;
    cursorTooltip.value.distance = '';
    cursorTooltip.value.azimuth = '';
  };

  const finalizeMeasurement = (endLat: number, endLon: number) => {
    const map = mapContainer.map?.value;
    if (!map || !rulerSource || !firstPoint) return;

    const coords = [fromLonLat([firstPoint.lon, firstPoint.lat]), fromLonLat([endLon, endLat])];
    // Reuse the preview feature as the finalized one; the next measurement
    // gets a fresh preview feature of its own.
    let feature = previewFeature;
    if (feature) {
      feature.getGeometry()?.setCoordinates(coords);
    } else {
      feature = new Feature({ geometry: new LineString(coords) });
      feature.setStyle(RULER_STYLES);
      rulerSource.addFeature(feature);
    }
    previewFeature = null;

    const distanceKm = getDistance([firstPoint.lon, firstPoint.lat], [endLon, endLat]) / 1000;
    const bearing = calculateBearing(firstPoint.lat, firstPoint.lon, endLat, endLon);
    const inverse = (bearing + 180) % 360;

    const element = buildMeasurementElement(distanceKm, bearing, inverse);
    // Anchor the overlay to the endpoint in map coordinates so OL keeps it
    // glued to the line as the user pans and zooms.
    const overlay = new Overlay({
      element,
      position: fromLonLat([endLon, endLat]),
      positioning: 'bottom-left',
      offset: [12, -12],
      stopEvent: false,
    });
    map.addOverlay(overlay);

    measurements.push({ feature, overlay });
  };

  const handlePointerMove = (event: MapBrowserEvent<any>) => {
    if (uiStore.tools.activeTool !== 'ruler') return;
    if (phase !== 'placed-first' || !firstPoint) return;

    const lonLat = toLonLat(event.coordinate);
    const lon = lonLat[0];
    const lat = lonLat[1];
    if (lon === undefined || lat === undefined) return;

    setPreviewCoordinates(firstPoint.lat, firstPoint.lon, lat, lon);
    updateCursorTooltip(event.pixel[0] ?? 0, event.pixel[1] ?? 0, lat, lon);
  };

  const handleClick = (event: MapBrowserEvent<any>) => {
    if (uiStore.tools.activeTool !== 'ruler') return;
    const lonLat = toLonLat(event.coordinate);
    const lon = lonLat[0];
    const lat = lonLat[1];
    if (lon === undefined || lat === undefined) return;

    if (phase === 'idle') {
      ensureLayer();
      firstPoint = { lat, lon };
      phase = 'placed-first';
      return;
    }

    // phase === 'placed-first'
    finalizeMeasurement(lat, lon);
    firstPoint = null;
    phase = 'idle';
    hideCursorTooltip();
  };

  const resetState = () => {
    const map = mapContainer.map?.value;
    for (const { overlay } of measurements) {
      if (map) map.removeOverlay(overlay);
      // OL detaches the element from the overlay container, but defensively
      // pull it from the DOM too so no stray measurement window survives.
      const el = overlay.getElement();
      if (el?.parentNode) el.remove();
    }
    measurements.length = 0;
    if (rulerLayer && map) {
      map.removeLayer(rulerLayer);
    }
    rulerSource?.clear();
    rulerLayer = null;
    rulerSource = null;
    previewFeature = null;
    firstPoint = null;
    phase = 'idle';
    hideCursorTooltip();
  };

  const handleEscape = () => {
    if (uiStore.tools.activeTool === 'ruler') {
      uiStore.stopTool();
    }
  };

  const setup = () => {
    const map = mapContainer.map?.value;
    if (map) {
      map.on('pointermove', handlePointerMove);
      map.on('click', handleClick);
    }

    // Clean up whenever the ruler tool is deactivated (via stopTool, toolbar,
    // Escape, or switching to another tool).
    watch(
      () => uiStore.tools.activeTool,
      (tool) => {
        if (tool !== 'ruler') {
          resetState();
        }
      }
    );
  };

  const cleanup = () => {
    const map = mapContainer.map?.value;
    if (map) {
      map.un('pointermove', handlePointerMove);
      map.un('click', handleClick);
    }
    resetState();
  };

  return {
    setup,
    cleanup,
    handleEscape,
  };
}
