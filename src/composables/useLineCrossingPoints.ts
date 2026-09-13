import type { MapContainer } from './useMap';
import type { CrossingLine } from '@/services/lineCrossings';
import type { MapBrowserEvent } from 'ol';
import type { WatchStopHandle } from 'vue';
import { Feature } from 'ol';
import { LineString, Point } from 'ol/geom';
import Interaction from 'ol/interaction/Interaction';
import VectorLayer from 'ol/layer/Vector';
import { toLonLat } from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import pointCursor from '@/assets/cursors/point-add.svg?url';
import { findNearestLineCrossing } from '@/services/lineCrossings';
import { useLayersStore } from '@/stores/layers';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';
import { useMapCursor } from './useMapCursor';

const HIT_TOLERANCE = 12; // CSS pixels, including the excluded endpoint hit areas.

export function useLineCrossingPoints(mapContainer: MapContainer) {
  const ui = useUIStore();
  const layers = useLayersStore();
  const projects = useProjectsStore();
  const { t } = useI18n();
  const available = computed(() => ui.canInteractWithLines && !ui.intersectionLineEdit);
  const setCursor = useMapCursor(mapContainer, 10);
  const coordinates = new WeakMap<LineString, { revision: number; values: number[][] }>();
  const marker = new Feature(new Point([0, 0]));
  marker.setStyle(
    new Style({
      image: new CircleStyle({
        radius: 5,
        fill: new Fill({ color: '#1976d2' }),
        stroke: new Stroke({ color: '#fff', width: 2 }),
      }),
    })
  );
  const source = new VectorSource<Feature<Point>>();
  const markerLayer = new VectorLayer({ source, zIndex: 1990 });
  let stopWatch: WatchStopHandle | undefined;
  let lastHandledClick = 0;

  function clearHover() {
    if (source.hasFeature(marker)) source.clear();
    setCursor(null);
  }

  function crossingAt(coordinate: number[]) {
    const map = mapContainer.map.value;
    const linesSource = mapContainer.linesSource.value;
    if (!map || !linesSource || !available.value) return null;
    const tolerance = HIT_TOLERANCE * (map.getView().getResolution() ?? 1);
    const [x, y] = coordinate;
    const nearby = new Set(
      linesSource
        .getFeaturesInExtent(
          [x! - tolerance, y! - tolerance, x! + tolerance, y! + tolerance],
          map.getView().getProjection()
        )
        .map((feature) => feature.getId())
    );
    const lines: CrossingLine[] = [];
    for (const line of layers.lineSegments) {
      if (!nearby.has(line.id) || !ui.isElementVisible('lineSegment', line.id)) continue;
      const shape = linesSource.getFeatureById(line.id)?.getGeometry();
      if (!(shape instanceof LineString)) continue;
      let cached = coordinates.get(shape);
      if (cached?.revision !== shape.getRevision()) {
        cached = { revision: shape.getRevision(), values: shape.getCoordinates() };
        coordinates.set(shape, cached);
      }
      lines.push({
        id: line.id,
        name: line.name,
        coordinates: cached.values,
        endpoints:
          line.mode === 'parallel' ? [] : [shape.getFirstCoordinate(), shape.getLastCoordinate()],
      });
    }
    return findNearestLineCrossing(lines, coordinate, tolerance, tolerance);
  }

  function pointerMove(event: MapBrowserEvent) {
    const crossing = !event.dragging && crossingAt(event.coordinate);
    if (!crossing) {
      clearHover();
      return;
    }
    marker.getGeometry()!.setCoordinates(crossing.coordinate);
    if (!source.hasFeature(marker)) source.addFeature(marker);
    setCursor(`url("${pointCursor}") 12 30, crosshair`);
  }

  function click(event: MapBrowserEvent) {
    if (!('button' in event.originalEvent) || event.originalEvent.button !== 0) return;
    const crossing = crossingAt(event.coordinate);
    if (!crossing) return;
    const [lon, lat] = toLonLat(crossing.coordinate);
    const [first, second] = crossing.lines;
    clearHover();
    ui.stopEditing();
    ui.startCreating('point', {
      lat: lat!,
      lon: lon!,
      name: t('point.intersectionName', { line1: first.name, line2: second.name }),
    });
    ui.openModal('pointModal');
    lastHandledClick = Date.now();
    event.preventDefault();
    return false;
  }

  function doubleClick(event: MapBrowserEvent) {
    if (Date.now() - lastHandledClick < 500) {
      event.preventDefault();
      return false;
    }
  }

  const pointerInteraction = new Interaction({
    handleEvent: (event) =>
      !(
        event.type === 'pointerdown' &&
        'button' in event.originalEvent &&
        event.originalEvent.button === 0 &&
        crossingAt(event.coordinate)
      ),
  });

  function setup() {
    const map = mapContainer.map.value;
    if (!map) return;
    map.addLayer(markerLayer);
    map.addInteraction(pointerInteraction);
    map.on('pointermove', pointerMove);
    map.on('click', click);
    map.on('dblclick', doubleClick);
    map.on('movestart', clearHover);
    map.getViewport().addEventListener('pointerleave', clearHover);
    mapContainer.linesSource.value?.on('change', clearHover);
    stopWatch = watch(
      [
        () => available.value,
        () => projects.activeProjectId,
        () => projects.activeProjection,
        () => layers.lineSegments,
        () => ui.elementVisibility,
      ],
      clearHover,
      { deep: true }
    );
  }

  function cleanup() {
    stopWatch?.();
    clearHover();
    const map = mapContainer.map.value;
    map?.removeInteraction(pointerInteraction);
    map?.un('pointermove', pointerMove);
    map?.un('click', click);
    map?.un('dblclick', doubleClick);
    map?.un('movestart', clearHover);
    map?.getViewport().removeEventListener('pointerleave', clearHover);
    mapContainer.linesSource.value?.un('change', clearHover);
    map?.removeLayer(markerLayer);
  }

  return { setup, cleanup };
}
