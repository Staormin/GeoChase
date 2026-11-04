import type { AISource } from './providers';
import type {
  CircleElement,
  ElementType,
  ImageElement,
  LineSegmentElement,
  NoteElement,
  PointElement,
  PolygonElement,
  ProjectProjection,
  RouteElement,
  VisibilityElementType,
} from '@/types/project';

/** Element types the assistant can rename, move, resize or delete. */
export type AssistantElementType = 'point' | 'lineSegment' | 'circle';
export type AssistantElement = PointElement | LineSegmentElement | CircleElement;

export interface AssistantPlacement {
  lineId: string;
  position: number;
  unit: 'fraction' | 'kilometers';
  fromEnd: boolean;
}
export interface AssistantReference {
  placement?: AssistantPlacement;
  type: AssistantElementType;
  id: string;
  name: string;
}
export interface AssistantEdit extends AssistantReference {
  before: AssistantElement;
  after: AssistantElement | null;
}
/** An element without geometry edits, deleted or renamed; a note's name is its title. */
export interface AssistantChange {
  type: 'polygon' | 'route' | 'image' | 'note';
  id: string;
  name: string;
}
export interface AssistantChoice {
  question: string;
  elements: AssistantReference[];
}
export interface AssistantStyle {
  type: ElementType;
  id: string;
  color: string;
}
export interface AssistantVisibility {
  type: VisibilityElementType;
  id: string;
  visible: boolean;
}
export interface AssistantNoteUpdate {
  id: string;
  content: string;
}
/** A new placement of an existing image overlay, previewed before it applies. */
export interface AssistantImageEdit {
  id: string;
  name: string;
  before: ImageElement;
  after: ImageElement;
}

/**
 * Everything one request prepares. Nothing here touches the live project:
 * the caller applies a completed plan in one step, or discards it.
 */
export interface AssistantPlan {
  // Elements created by the request.
  points: PointElement[];
  lines: LineSegmentElement[];
  circles: CircleElement[];
  polygons: PolygonElement[];
  routes: RouteElement[];
  notes: NoteElement[];
  images: ImageElement[];
  /** Image bytes of created overlays, keyed by asset ID; saved when the plan applies. */
  imageAssets: Record<string, Blob>;
  // Changes to existing elements.
  edits: AssistantEdit[];
  removals: AssistantChange[];
  renames: AssistantChange[];
  imageEdits: AssistantImageEdit[];
  styles: AssistantStyle[];
  visibility: AssistantVisibility[];
  noteUpdates: AssistantNoteUpdate[];
  // Effects run after applying; they do not change project data.
  effects: { focus?: { type: ElementType; id: string }; exportGpx?: boolean };
  // Answer metadata.
  sources: AISource[];
  placements: Record<string, AssistantPlacement>;
  choice?: AssistantChoice;
}

export interface ProjectContext {
  projection?: ProjectProjection;
  selection?: AssistantReference[];
  recent?: AssistantReference[];
  name: string;
  points: PointElement[];
  circles: CircleElement[];
  lines: LineSegmentElement[];
  polygons?: PolygonElement[];
  routes?: RouteElement[];
  notes?: NoteElement[];
  images?: ImageElement[];
}

export function createPlan(): AssistantPlan {
  return {
    points: [],
    lines: [],
    circles: [],
    polygons: [],
    routes: [],
    notes: [],
    images: [],
    imageAssets: {},
    edits: [],
    removals: [],
    renames: [],
    imageEdits: [],
    styles: [],
    visibility: [],
    noteUpdates: [],
    effects: {},
    sources: [],
    placements: {},
  };
}

/** Current state of one element type: originals and creations, with edits applied. */
export function resolveElements<T extends AssistantElement>(
  type: AssistantElementType,
  original: T[],
  added: T[],
  edits: AssistantEdit[]
): T[] {
  return [...original, ...added].flatMap((element) => {
    const edit = edits.find((edit) => edit.type === type && edit.id === element.id);
    return edit ? (edit.after ? [edit.after as T] : []) : [element];
  });
}

/** Elements the plan creates, in their final state (a creation may be edited later in the plan). */
export function createdElements(plan: AssistantPlan) {
  return {
    points: resolveElements('point', [], plan.points, plan.edits),
    lines: resolveElements('lineSegment', [], plan.lines, plan.edits),
    circles: resolveElements('circle', [], plan.circles, plan.edits),
    polygons: plan.polygons,
    routes: plan.routes,
    images: plan.images,
  };
}

/** Number of staged changes that write to the project. */
export function planSize(plan: AssistantPlan): number {
  return (
    plan.points.length +
    plan.lines.length +
    plan.circles.length +
    plan.polygons.length +
    plan.routes.length +
    plan.notes.length +
    plan.images.length +
    plan.imageEdits.length +
    plan.edits.length +
    plan.removals.length +
    plan.renames.length +
    plan.styles.length +
    plan.visibility.length +
    plan.noteUpdates.length
  );
}

/** Changes shown to the user; the source note of a new element is part of that element. */
export function visibleChanges(plan: AssistantPlan) {
  const created = new Set(
    [
      ...plan.points,
      ...plan.lines,
      ...plan.circles,
      ...plan.polygons,
      ...plan.routes,
      ...plan.images,
    ].map((element) => element.id)
  );
  const annotations = plan.notes.filter(
    (note) => !note.linkedElementId || !created.has(note.linkedElementId)
  ).length;
  const changed =
    plan.edits.length +
    plan.imageEdits.length +
    plan.styles.length +
    plan.visibility.length +
    plan.noteUpdates.length +
    annotations;
  return { count: created.size + changed, changed: changed > 0 };
}

/** Elements to link from the answer: creations and kept edits, once each. */
export function changedReferences(plan: AssistantPlan): AssistantReference[] {
  const created = createdElements(plan);
  return [
    ...created.points.map((p) => ({ type: 'point' as const, id: p.id, name: p.name })),
    ...created.lines.map((l) => ({ type: 'lineSegment' as const, id: l.id, name: l.name })),
    ...created.circles.map((c) => ({ type: 'circle' as const, id: c.id, name: c.name })),
    ...plan.edits
      .filter((edit) => edit.after)
      .map((edit) => ({ type: edit.type, id: edit.id, name: edit.after!.name })),
  ].filter(
    (ref, index, all) => all.findIndex((p) => p.id === ref.id && p.type === ref.type) === index
  );
}

/** Deletions and geometric edits need a confirmation; renames apply directly. */
export function needsPreview(plan: AssistantPlan): boolean {
  return (
    plan.imageEdits.length > 0 ||
    plan.removals.length > 0 ||
    plan.edits.some(
      (edit) =>
        !edit.after ||
        JSON.stringify({ ...edit.before, name: edit.after.name }) !== JSON.stringify(edit.after)
    )
  );
}
