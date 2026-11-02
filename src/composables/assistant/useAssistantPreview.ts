import type {
  AssistantElement,
  AssistantElementType,
  AssistantPlan,
  AssistantReference,
} from '@/services/assistant/plan';
import type {
  CircleElement,
  ImageElement,
  LineSegmentElement,
  PointElement,
} from '@/types/project';
import { Feature } from 'ol';
import { LineString, Point, Polygon } from 'ol/geom';
import VectorLayer from 'ol/layer/Vector';
import { fromLonLat, toLonLat } from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';
import { onScopeDispose } from 'vue';
import { imageCorners, imagePivotCoordinate } from '@/services/imageElements';
import { useMapContext } from '../mapContext';
import { useProjectGeometry } from '../useProjectGeometry';

/** Temporary preview layer: no writes to layers, storage, exports or history. */
export function useAssistantPreview() {
  const map = useMapContext();
  const geometry = useProjectGeometry();
  const source = new VectorSource();
  const layer = new VectorLayer({ source, zIndex: 2001 });
  let attached = false;
  function shape(type: AssistantElementType, element: AssistantElement) {
    if (type === 'point') {
      const p = (element as PointElement).coordinates;
      return new Point(fromLonLat([p.lon, p.lat]));
    }
    if (type === 'circle') {
      const c = element as CircleElement;
      return new Polygon([
        geometry
          .generateCircle(c.center.lat, c.center.lon, c.radius)
          .map((p) => fromLonLat([p.lon, p.lat])),
      ]);
    }
    const l = element as LineSegmentElement;
    const end = geometry.getSegmentEndpoint(l);
    return new LineString(
      l.mode === 'parallel'
        ? [
            fromLonLat([-180, l.longitude ?? l.center.lat]),
            fromLonLat([180, l.longitude ?? l.center.lat]),
          ]
        : end
          ? geometry.lineCoordinates(l.center, end)
          : []
    );
  }
  function show(plan: AssistantPlan) {
    clear();
    if (!map.map.value) return;
    map.map.value.addLayer(layer);
    attached = true;
    const add = (type: AssistantElementType, element: AssistantElement, removed = false) => {
      const feature = new Feature(shape(type, element));
      const color = removed ? '#b42318' : '#7c3aed';
      feature.setStyle(
        new Style({
          stroke: new Stroke({ color, width: 4, lineDash: [8, 5] }),
          fill: new Fill({ color: `${color}18` }),
          image: new CircleStyle({
            radius: 9,
            stroke: new Stroke({ color, width: 3 }),
            fill: new Fill({ color: '#ffffff' }),
          }),
        })
      );
      source.addFeature(feature);
    };
    for (const p of plan.points) add('point', p);
    for (const l of plan.lines) add('lineSegment', l);
    for (const c of plan.circles) add('circle', c);
    for (const edit of plan.edits) {
      add(edit.type, edit.before, true);
      if (edit.after) add(edit.type, edit.after);
    }
    // Overlays: their outline before and after, the pinned anchor as a dot.
    const outline = (image: ImageElement, removed = false) => {
      const color = removed ? '#b42318' : '#7c3aed';
      const corners = imageCorners(image);
      const feature = new Feature(new Polygon([[...corners, corners[0]!]]));
      feature.setStyle(
        new Style({
          stroke: new Stroke({ color, width: 3, lineDash: [10, 6] }),
          fill: new Fill({ color: `${color}10` }),
        })
      );
      source.addFeature(feature);
      if (!removed && image.pivot) {
        const pin = new Feature(new Point(imagePivotCoordinate(image)));
        pin.setStyle(
          new Style({
            image: new CircleStyle({
              radius: 7,
              stroke: new Stroke({ color, width: 3 }),
              fill: new Fill({ color: '#ffffff' }),
            }),
          })
        );
        source.addFeature(pin);
      }
    };
    for (const edit of plan.imageEdits) {
      outline(edit.before, true);
      outline(edit.after);
    }
    for (const image of plan.images) outline(image);
    const extent = source.getExtent();
    if (extent?.every((value) => Number.isFinite(value))) {
      const a = toLonLat(extent.slice(0, 2));
      const b = toLonLat(extent.slice(2, 4));
      map.flyToBoundsWithPanels([
        [a[1]!, a[0]!],
        [b[1]!, b[0]!],
      ]);
    }
  }
  function clear() {
    source.clear();
    if (attached) map.map.value?.removeLayer(layer);
    attached = false;
  }
  function focus(ref: AssistantReference, element: AssistantElement) {
    const extent = shape(ref.type, element).getExtent();
    const a = toLonLat(extent.slice(0, 2));
    const b = toLonLat(extent.slice(2, 4));
    if (ref.type === 'point') map.flyTo(a[1]!, a[0]!, 13);
    else
      map.flyToBoundsWithPanels([
        [a[1]!, a[0]!],
        [b[1]!, b[0]!],
      ]);
  }
  onScopeDispose(clear);
  return { show, clear, focus };
}
