import type { useAssistantPreview } from './useAssistantPreview';
import type { AssistantPlan, AssistantReference } from '@/services/assistant/plan';
import type { CircleElement, ElementType, LineSegmentElement, PointElement } from '@/types/project';
import { createdElements, planSize } from '@/services/assistant/plan';
import { AIError } from '@/services/assistant/providers';
import { writeImageAsset } from '@/services/imageAssets';
import { useLayersStore } from '@/stores/layers';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';
import { useDrawingContext, useMapContext, useNoteTooltipsContext } from '../mapContext';
import { useProjectFiles } from '../useProjectFiles';

function isLinkable(type: ElementType): type is AssistantReference['type'] {
  return ['point', 'lineSegment', 'circle'].includes(type);
}
type LayerSnapshot = ReturnType<ReturnType<typeof useLayersStore>['exportLayers']>;

/** Writes a completed plan to the project in one step, or restores the snapshot. */
export function useAssistantApply(preview: ReturnType<typeof useAssistantPreview>) {
  const layers = useLayersStore();
  const projects = useProjectsStore();
  const ui = useUIStore();
  const map = useMapContext();
  const drawing = useDrawingContext();
  const tooltips = useNoteTooltipsContext();
  const files = useProjectFiles();

  function elementsOf(type: ElementType): { id: string }[] {
    const lists: Record<ElementType, { id: string }[]> = {
      point: layers.points,
      lineSegment: layers.lineSegments,
      circle: layers.circles,
      polygon: layers.polygons,
      route: layers.routes,
      image: layers.images,
    };
    return lists[type];
  }
  function currentElement(ref: Pick<AssistantReference, 'type' | 'id'>) {
    const list =
      ref.type === 'point'
        ? layers.points
        : ref.type === 'circle'
          ? layers.circles
          : layers.lineSegments;
    return list.find((item) => item.id === ref.id);
  }

  /** Zooms on any element type, including polygons and routes. */
  function focus(type: ElementType, id: string) {
    if (isLinkable(type)) {
      const element = currentElement({ type, id });
      if (element) preview.focus({ type, id, name: element.name }, element);
      return;
    }
    const coordinates =
      type === 'route'
        ? (layers.routes.find((r) => r.id === id)?.coordinates ?? []).map(([lon, lat]) => ({
            lat,
            lon,
          }))
        : (layers.polygons.find((p) => p.id === id)?.pointIds ?? []).flatMap((pointId) => {
            const point = layers.points.find((p) => p.id === pointId);
            return point ? [point.coordinates] : [];
          });
    if (coordinates.length === 0) return;
    const lats = coordinates.map((c) => c.lat);
    const lons = coordinates.map((c) => c.lon);
    map.flyToBoundsWithPanels([
      [Math.min(...lats), Math.min(...lons)],
      [Math.max(...lats), Math.max(...lons)],
    ]);
  }

  function writeChanges(plan: AssistantPlan) {
    const created = createdElements(plan);
    const createdIds = new Set(
      [...plan.points, ...plan.lines, ...plan.circles].map((element) => element.id)
    );
    const existingEdits = plan.edits.filter((edit) => !createdIds.has(edit.id));
    // Apply existing point edits before lines, whose endpoint IDs are inferred by the store.
    for (const edit of existingEdits) if (!edit.after) drawing.deleteElement(edit.type, edit.id);
    for (const edit of existingEdits.filter((edit) => edit.type === 'point' && edit.after)) {
      const before = edit.before as PointElement;
      const point = edit.after as PointElement;
      if (
        before.coordinates.lat !== point.coordinates.lat ||
        before.coordinates.lon !== point.coordinates.lon ||
        before.construction?.lineId !== point.construction?.lineId
      ) {
        for (const line of layers.lineSegments)
          line.pointsOnLine = line.pointsOnLine?.filter((id) => id !== point.id);
      }
      layers.updatePoint(edit.id, point);
    }
    for (const point of created.points) layers.addPoint(point);
    for (const edit of existingEdits.filter((edit) => edit.type !== 'point' && edit.after)) {
      if (edit.type === 'circle') layers.updateCircle(edit.id, edit.after as CircleElement);
      else layers.updateLineSegment(edit.id, edit.after as LineSegmentElement);
    }
    for (const circle of created.circles) layers.addCircle(circle);
    for (const line of created.lines) layers.addLineSegment(line);
    for (const polygon of created.polygons) layers.addPolygon(polygon);
    for (const route of created.routes) layers.addRoute(route);
    for (const image of created.images) layers.addImage(image);
    for (const edit of plan.imageEdits) {
      const { center, width, height, rotation, pivot, pivotPointId, paper } = edit.after;
      layers.updateImage(edit.id, { center, width, height, rotation, pivot, pivotPointId, paper });
    }
    // Points placed on a line join that line's references.
    const placedPoints = new Set([
      ...plan.points.map((p) => p.id),
      ...plan.edits.filter((e) => e.type === 'point').map((e) => e.id),
    ]);
    for (const point of layers.points.filter((p) => placedPoints.has(p.id))) {
      if (!point.construction) continue;
      const line = layers.lineSegments.find((line) => line.id === point.construction!.lineId);
      if (line) {
        line.pointsOnLine = [...new Set([...(line.pointsOnLine || []), point.id])];
        layers.updatePoint(point.id, { lineId: line.id });
      }
    }
    for (const note of plan.notes) {
      const target = note.linkedElementType && note.linkedElementId;
      if (!target || elementsOf(note.linkedElementType!).some((e) => e.id === note.linkedElementId))
        layers.addNote(note);
    }
    for (const update of plan.noteUpdates)
      layers.updateNote(update.id, { content: update.content });
    for (const style of plan.styles) drawing.updateElementColor(style.type, style.id, style.color);
    for (const item of plan.visibility) ui.setElementVisibility(item.type, item.id, item.visible);
    projects.autoSaveActiveProject(layers.exportLayers());
  }

  /** Applies all changes, then the post-apply effects (zoom, export). */
  async function apply(plan: AssistantPlan, snapshot: LayerSnapshot) {
    if (planSize(plan) > 0) {
      try {
        // Image bytes first: an overlay must never reference a missing asset.
        for (const [assetId, blob] of Object.entries(plan.imageAssets))
          await writeImageAsset(assetId, blob);
        writeChanges(plan);
      } catch {
        layers.$patch(snapshot);
        drawing.redrawAllElements({ fitBounds: false });
        throw new AIError('storage');
      }
      tooltips.value?.clearAllTooltips();
      // Frame what the request placed or reshaped, as when placing elements manually.
      const created = createdElements(plan);
      const framed = new Set([
        ...Object.values(created).flatMap((list) => list.map((element) => element.id)),
        ...plan.edits.filter((edit) => edit.after).map((edit) => edit.id),
        ...plan.imageEdits.map((edit) => edit.id),
      ]);
      drawing.redrawAllElements({
        animatePointIds: plan.points.map((point) => point.id),
        fitBounds: !plan.effects.focus && framed.size > 0,
        fitOnly: framed,
      });
      for (const item of plan.visibility)
        void drawing.updateElementVisibility(item.type, item.id, item.visible);
      tooltips.value?.updateNoteTooltips();
    }
    if (plan.effects.focus) focus(plan.effects.focus.type, plan.effects.focus.id);
    if (plan.effects.exportGpx) files.exportGPX();
  }

  return { apply, focus, currentElement };
}
