import type { useDrawing } from './useDrawing';
import type { MapContainer } from './useMap';
import type { useNoteTooltips } from './useNoteTooltips';
import type { RayPosition, SnapLine } from '@/services/intersectionEditing';
import type { LineSegmentElement } from '@/types/project';
import type { MapBrowserEvent, Overlay } from 'ol';
import type { Ref, WatchStopHandle } from 'vue';
import { Feature } from 'ol';
import { LineString, Point, Polygon } from 'ol/geom';
import Interaction from 'ol/interaction/Interaction';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { createIntersectionRay } from '@/services/intersectionEditing';
import { changeIntersectionExtension } from '@/services/projectProjection';
import { useLayersStore } from '@/stores/layers';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';
import { useMapCursor } from './useMapCursor';
import { useProjectGeometry } from './useProjectGeometry';

const HIT_TOLERANCE = 12; // CSS pixels, independent of zoom and device pixel ratio.

export function useIntersectionLineEditing(
  mapContainer: MapContainer,
  drawing: ReturnType<typeof useDrawing>,
  noteTooltips: Ref<ReturnType<typeof useNoteTooltips> | null>
) {
  const ui = useUIStore();
  const layers = useLayersStore();
  const projects = useProjectsStore();
  const geometry = useProjectGeometry();
  const { t } = useI18n();
  const available = computed(() => ui.canInteractWithLines);
  const setCursor = useMapCursor(mapContainer, 20);

  const handle = new Feature(new Point([0, 0]));
  const handles = new VectorSource<Feature<Point>>();
  const handleLayer = new VectorLayer({ source: handles, zIndex: 2000 });
  let hoveredId: string | null = null;
  let lastHandledClick = 0;
  let stopWatch: WatchStopHandle | undefined;
  let stopCancelWatch: WatchStopHandle | undefined;
  let editing: {
    line: LineSegmentElement;
    feature: Feature;
    originalGeometry: LineString;
    ray: ReturnType<typeof createIntersectionRay>;
    position: RayPosition;
    targets: SnapLine[];
    points: Array<{
      geometry: Point;
      original: number[];
      labels: Array<{ overlay: Overlay; position: number[] | undefined }>;
    }>;
  } | null = null;

  function showHandle(coordinate: number[], snapped = false) {
    handle.getGeometry()!.setCoordinates(coordinate);
    handle.setStyle(
      new Style({
        image: new CircleStyle({
          radius: 7,
          fill: new Fill({ color: snapped ? '#2e7d32' : '#1976d2' }),
          stroke: new Stroke({ color: '#fff', width: 2 }),
        }),
      })
    );
    if (!handles.hasFeature(handle)) handles.addFeature(handle);
  }

  function clearHover() {
    hoveredId = null;
    if (!editing) {
      handles.clear();
      setCursor(null);
    }
  }

  function endpointAt(pixel: number[]): LineSegmentElement | undefined {
    const map = mapContainer.map.value;
    if (!map || !available.value) return;
    let closest: LineSegmentElement | undefined;
    let distance = HIT_TOLERANCE;
    for (const line of layers.lineSegments) {
      if (
        line.mode !== 'intersection' ||
        !line.endpoint ||
        !line.intersectionPoint ||
        !ui.isElementVisible('lineSegment', line.id)
      )
        continue;
      const shape = mapContainer.linesSource.value?.getFeatureById(line.id)?.getGeometry();
      if (!(shape instanceof LineString)) continue;
      const endpoint = map.getPixelFromCoordinate(shape.getLastCoordinate());
      if (!endpoint) continue;
      const delta = Math.hypot(endpoint[0]! - pixel[0]!, endpoint[1]! - pixel[1]!);
      if (delta <= distance) {
        closest = line;
        distance = delta;
      }
    }
    return closest;
  }

  function snapTargets(excludedId: string): SnapLine[] {
    const targets: SnapLine[] = [];
    const groups = [
      {
        type: 'lineSegment',
        elements: layers.lineSegments.filter((line) => line.id !== excludedId),
        source: mapContainer.linesSource.value,
      },
      { type: 'circle', elements: layers.circles, source: mapContainer.circlesSource.value },
      { type: 'polygon', elements: layers.polygons, source: mapContainer.polygonsSource.value },
    ];
    for (const { type, elements, source } of groups) {
      for (const element of elements) {
        if (!ui.isElementVisible(type, element.id)) continue;
        const shape = source?.getFeatureById(element.id)?.getGeometry();
        if (shape instanceof LineString) {
          targets.push({
            id: element.id,
            name: element.name,
            coordinates: shape.getCoordinates(),
            endpoints:
              'mode' in element && element.mode !== 'parallel'
                ? [shape.getFirstCoordinate(), shape.getLastCoordinate()]
                : undefined,
          });
        } else if (shape instanceof Polygon) {
          for (const coordinates of shape.getCoordinates())
            targets.push({ id: element.id, name: element.name, coordinates });
        }
      }
    }
    return targets;
  }

  function begin(line: LineSegmentElement) {
    const map = mapContainer.map.value;
    const feature = mapContainer.linesSource.value?.getFeatureById(line.id);
    const shape = feature?.getGeometry();
    if (
      !map ||
      !feature ||
      !(shape instanceof LineString) ||
      !line.intersectionPoint ||
      !line.endpoint
    )
      return;
    const ray = createIntersectionRay(
      line.center,
      line.intersectionPoint,
      projects.activeProjection
    );
    const position = ray.closest(shape.getLastCoordinate());
    const points = layers.points
      .filter(
        (point) =>
          (!point.construction &&
            point.id === line.endPointId &&
            (Math.abs(point.coordinates.lat - line.intersectionPoint!.lat) > 0.000001 ||
              Math.abs(point.coordinates.lon - line.intersectionPoint!.lon) > 0.000001) &&
            (Math.abs(point.coordinates.lat - line.center.lat) > 0.000001 ||
              Math.abs(point.coordinates.lon - line.center.lon) > 0.000001)) ||
          (point.construction?.lineId === line.id && point.construction.distanceKm === undefined)
      )
      .flatMap((point) => {
        const shape = mapContainer.pointsSource.value?.getFeatureById(point.id)?.getGeometry();
        if (!(shape instanceof Point)) return [];
        return [
          {
            geometry: shape,
            original: shape.getCoordinates(),
            labels: map
              .getOverlays()
              .getArray()
              .filter((overlay) => overlay.get('id') === `label-${point.id}`)
              .map((overlay) => ({ overlay, position: overlay.getPosition()?.slice() })),
          },
        ];
      });
    editing = {
      line,
      feature,
      originalGeometry: shape.clone(),
      ray,
      position,
      targets: snapTargets(line.id),
      points,
    };
    ui.intersectionLineEdit = {
      lineId: line.id,
      name: line.name,
      distanceKm: line.intersectionExtension ?? ray.extension(position),
      snappedTo: null,
    };
    setCursor('crosshair');
    showHandle(shape.getLastCoordinate());
  }

  function preview(coordinate: number[]) {
    if (!editing) return;
    const { ray, line } = editing;
    const unsnapped = ray.closest(coordinate);
    const resolution = mapContainer.map.value?.getView().getResolution() ?? 1;
    const snapped = ray.snap(
      unsnapped,
      editing.targets,
      HIT_TOLERANCE * resolution,
      // A previous snap can fall on a geodesic's rendered chord, just off its true curve.
      // Allow half a screen pixel of drift while keeping the endpoint on the exact azimuth.
      geometry.isGeodesic() ? Math.max(0.01, resolution / 2) : 0.01
    );
    const position = snapped?.position ?? unsnapped;
    editing.position = position;
    const endpoint = ray.pointAt(position.parameter);
    const coordinates = geometry.lineCoordinates(line.center, endpoint);
    (editing.feature.getGeometry() as LineString).setCoordinates(coordinates);
    for (const point of editing.points) {
      point.geometry.setCoordinates(position.coordinate);
      for (const { overlay } of point.labels) overlay.setPosition(position.coordinate);
    }
    ui.intersectionLineEdit = {
      lineId: line.id,
      name: line.name,
      distanceKm: ray.extension(position),
      snappedTo: snapped?.line.name ?? null,
    };
    showHandle(position.coordinate, !!snapped);
  }

  function finish(restore = true) {
    const current = editing;
    editing = null;
    if (
      restore &&
      current &&
      mapContainer.linesSource.value?.getFeatureById(current.line.id) === current.feature
    ) {
      current.feature.setGeometry(current.originalGeometry);
      for (const point of current.points) {
        point.geometry.setCoordinates(point.original);
        for (const { overlay, position } of point.labels) overlay.setPosition(position);
      }
    }
    ui.intersectionLineEdit = null;
    clearHover();
  }

  function commit() {
    if (!editing) return;
    try {
      const data = changeIntersectionExtension(
        layers.exportLayers(),
        editing.line.id,
        editing.ray.extension(editing.position),
        projects.activeProjection
      );
      projects.autoSaveActiveProject(data);
      finish(false);
      layers.loadLayers(data);
      noteTooltips.value?.clearAllTooltips();
      drawing.redrawAllElements({ fitBounds: false });
      noteTooltips.value?.updateNoteTooltips();
      ui.addToast(t('intersectionEdit.saved'), 'success');
    } catch {
      ui.addToast(t('intersectionEdit.error'), 'error');
    }
  }

  function pointerMove(event: MapBrowserEvent) {
    if (editing) {
      preview(event.coordinate);
      return;
    }
    if (event.dragging) {
      clearHover();
      return;
    }
    const line = endpointAt(event.pixel);
    if (line) {
      hoveredId = line.id;
      setCursor('pointer');
      const feature = mapContainer.linesSource.value!.getFeatureById(line.id)!;
      const shape = feature.getGeometry() as LineString;
      showHandle(shape.getLastCoordinate());
    } else clearHover();
  }

  function pointerDown(event: MapBrowserEvent) {
    if (
      'button' in event.originalEvent &&
      event.originalEvent.button === 0 &&
      (editing || endpointAt(event.pixel))
    )
      return false;
  }

  function click(event: MapBrowserEvent) {
    if (!('button' in event.originalEvent) || event.originalEvent.button !== 0 || !available.value)
      return;
    if (editing) {
      preview(event.coordinate);
      commit();
    } else {
      const line = endpointAt(event.pixel);
      if (!line) return;
      try {
        begin(line);
      } catch {
        ui.addToast(t('intersectionEdit.error'), 'error');
        return;
      }
    }
    lastHandledClick = Date.now();
    event.preventDefault();
    return false;
  }

  function doubleClick(event: MapBrowserEvent) {
    if (editing || Date.now() - lastHandledClick < 500) {
      event.preventDefault();
      return false;
    }
  }

  function keydown(event: KeyboardEvent) {
    if (editing && event.key === 'Escape') {
      event.preventDefault();
      finish();
    }
  }

  const pointerInteraction = new Interaction({
    handleEvent: (event) => event.type !== 'pointerdown' || pointerDown(event) !== false,
  });

  function setup() {
    const map = mapContainer.map.value;
    if (!map) return;
    map.addLayer(handleLayer);
    map.on('pointermove', pointerMove);
    map.addInteraction(pointerInteraction);
    map.on('click', click);
    map.on('dblclick', doubleClick);
    map.getViewport().addEventListener('pointerleave', clearHover);
    document.addEventListener('keydown', keydown);
    stopWatch = watch(
      [
        () => projects.activeProjectId,
        () => projects.activeProjection,
        () => available.value,
        () => layers.lineSegments,
        () => layers.points,
        () => layers.circles,
        () => layers.polygons,
        () => ui.elementVisibility,
      ],
      () => {
        if (editing) finish();
        else if (hoveredId) clearHover();
      },
      { deep: true }
    );
    stopCancelWatch = watch(
      () => ui.intersectionLineEdit?.lineId,
      (id) => {
        if (!id && editing) finish();
      },
      { flush: 'sync' }
    );
  }

  function cleanup() {
    stopWatch?.();
    stopCancelWatch?.();
    finish();
    const map = mapContainer.map.value;
    map?.un('pointermove', pointerMove);
    map?.removeInteraction(pointerInteraction);
    map?.un('click', click);
    map?.un('dblclick', doubleClick);
    map?.getViewport().removeEventListener('pointerleave', clearHover);
    map?.removeLayer(handleLayer);
    document.removeEventListener('keydown', keydown);
  }

  return { setup, cleanup };
}
