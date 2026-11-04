import type { LatLon } from '../geometry';
import type {
  AssistantElement,
  AssistantElementType,
  AssistantReference,
  ProjectContext,
} from './plan';
import type { AIAttachment, AISettings, AISource } from './providers';
import type {
  CircleElement,
  ElementType,
  ImageElement,
  LineSegmentElement,
  NoteElement,
  PointElement,
  PolygonElement,
  RouteElement,
} from '@/types/project';
import { readImageAsset } from '../imageAssets';
import { createProjectGeometry } from '../projectGeometry';
import { LIMITS } from './limits';
import { createPlan, resolveElements } from './plan';
import { AIError } from './providers';

export const DEFAULT_COLOR = '#2563eb';
const SAME_PLACE = 0.000001;

export type Geometry = ReturnType<typeof createProjectGeometry>;
export type Location = LatLon & { label: string };
export type Staged = { id: string; status: 'prepared' | 'already_exists' };

function samePlace(a: LatLon, b: LatLon | undefined) {
  return !!b && Math.abs(a.lat - b.lat) < SAME_PLACE && Math.abs(a.lon - b.lon) < SAME_PLACE;
}
const sameName = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

/** Places and sources found by lookups. A request owns one; the Claude bridge keeps one per session. */
export interface ToolMemory {
  locations: Map<string, Location>;
  references: Map<string, AISource>;
  lastLocation: number;
  /** Forgets the oldest places when full instead of ending the request. */
  rolling: boolean;
}
export function createToolMemory(rolling = false): ToolMemory {
  return { locations: new Map(), references: new Map(), lastLocation: 0, rolling };
}

/**
 * Shared state of one request: lookups see the project as the plan would leave
 * it, and every staging goes through here so lookups stay current.
 */
export function createToolContext(
  project: ProjectContext,
  settings: AISettings,
  signal: AbortSignal,
  /** Files the request can use: attachments and the project PDF. */
  documents: AIAttachment[] = [],
  memory: ToolMemory = createToolMemory()
) {
  const plan = createPlan();
  const geometry = createProjectGeometry(() => project.projection ?? 'mercator');
  const { locations, references } = memory;
  const used = { geocodes: 0, research: 0, network: 0 };
  let cache: ReturnType<typeof resolve> | undefined;

  function resolve() {
    return {
      points: resolveElements('point', project.points, plan.points, plan.edits),
      lines: resolveElements('lineSegment', project.lines, plan.lines, plan.edits),
      circles: resolveElements('circle', project.circles, plan.circles, plan.edits),
      polygons: [...(project.polygons ?? []), ...plan.polygons],
      routes: [...(project.routes ?? []), ...plan.routes],
      notes: [...(project.notes ?? []), ...plan.notes],
      images: [
        ...(project.images ?? []).map(
          (image) => plan.imageEdits.find((edit) => edit.id === image.id)?.after ?? image
        ),
        ...plan.images,
      ],
    };
  }
  /** Project state including staged changes, rebuilt only after a change. */
  function current() {
    cache ??= resolve();
    return cache;
  }
  const changed = () => {
    cache = undefined;
  };

  function find<T extends { id: string }>(list: T[], id: unknown, label: string): T {
    const found = list.find((item) => item.id === text(id));
    if (!found) throw new Error(`Unknown ${label} ID. Read the project first.`);
    return found;
  }
  const lists = () => {
    const state = current();
    return {
      point: state.points,
      lineSegment: state.lines,
      circle: state.circles,
      polygon: state.polygons,
      route: state.routes,
    } as Record<string, { id: string; name: string }[]>;
  };
  function element(type: unknown, id: unknown): AssistantElement {
    if (!['point', 'lineSegment', 'circle'].includes(String(type)))
      throw new Error('Unknown element type');
    return find(lists()[String(type)]!, id, String(type)) as AssistantElement;
  }
  function anyElement(type: unknown, id: unknown) {
    const list = lists()[String(type)];
    if (!list) throw new Error('Unknown element type');
    return { type: type as ElementType, element: find(list, id, String(type)) };
  }

  function stage<T extends { id: string }>(list: T[], created: T, existing: T | undefined): Staged {
    if (existing) return { id: existing.id, status: 'already_exists' };
    list.push(created);
    changed();
    return { id: created.id, status: 'prepared' };
  }

  /** Replayed calls return the element already prepared instead of a duplicate. */
  function stagePoint(point: Omit<PointElement, 'id' | 'color' | 'createdAt'>) {
    if (!Number.isFinite(point.coordinates.lat) || !Number.isFinite(point.coordinates.lon))
      throw new Error('No valid position');
    const existing = current().points.find(
      (p) => sameName(p.name, point.name) && samePlace(p.coordinates, point.coordinates)
    );
    if (!existing && plan.points.length >= LIMITS.points) throw new AIError('limit');
    const created: PointElement = {
      id: crypto.randomUUID(),
      color: DEFAULT_COLOR,
      createdAt: Date.now(),
      ...point,
    };
    return { ...stage(plan.points, created, existing), coordinates: point.coordinates };
  }
  function stageLine(line: Omit<LineSegmentElement, 'id' | 'color'>) {
    const end = geometry.getSegmentEndpoint(line as LineSegmentElement);
    const existing = current().lines.find(
      (l) =>
        sameName(l.name, line.name) &&
        l.mode === line.mode &&
        samePlace(l.center, line.center) &&
        samePlace(end ?? l.center, geometry.getSegmentEndpoint(l) ?? l.center)
    );
    const created: LineSegmentElement = { id: crypto.randomUUID(), color: DEFAULT_COLOR, ...line };
    return { ...stage(plan.lines, created, existing), endpoint: end };
  }
  function stageCircle(circle: Omit<CircleElement, 'id' | 'color'>) {
    const existing = current().circles.find(
      (c) =>
        sameName(c.name, circle.name) &&
        c.radius === circle.radius &&
        samePlace(c.center, circle.center)
    );
    const created: CircleElement = { id: crypto.randomUUID(), color: DEFAULT_COLOR, ...circle };
    return stage(plan.circles, created, existing);
  }
  function stagePolygon(polygon: Omit<PolygonElement, 'id' | 'color' | 'createdAt'>) {
    const existing = current().polygons.find(
      (p) => sameName(p.name, polygon.name) && p.pointIds.join(',') === polygon.pointIds.join(',')
    );
    const created: PolygonElement = {
      id: crypto.randomUUID(),
      color: DEFAULT_COLOR,
      createdAt: Date.now(),
      ...polygon,
    };
    return stage(plan.polygons, created, existing);
  }
  function stageRoute(route: Omit<RouteElement, 'id' | 'color' | 'createdAt'>) {
    const existing = current().routes.find(
      (r) =>
        sameName(r.name, route.name) &&
        r.profile === route.profile &&
        samePlace(r.start, route.start) &&
        samePlace(r.end, route.end)
    );
    const created: RouteElement = {
      id: crypto.randomUUID(),
      color: DEFAULT_COLOR,
      createdAt: Date.now(),
      ...route,
    };
    return stage(plan.routes, created, existing);
  }
  function stageNote(note: NoteElement) {
    plan.notes.push(note);
    changed();
  }

  function reference(type: unknown, id: unknown): AssistantReference {
    const found = element(type, id);
    return { type: type as AssistantElementType, id: found.id, name: found.name };
  }
  /** Stages an update (after) or a deletion (null) of an existing or prepared element. */
  function edit(ref: AssistantReference, after: AssistantElement | null) {
    const existing = plan.edits.find((item) => item.type === ref.type && item.id === ref.id);
    if (existing) existing.after = after;
    else plan.edits.push({ ...ref, before: structuredClone(element(ref.type, ref.id)), after });
    changed();
    return { id: ref.id, status: after ? 'update_prepared' : 'deletion_prepared' };
  }

  /** New overlay with its image bytes, saved only if the plan applies. */
  function stageImage(image: ImageElement, blob: Blob) {
    plan.images.push(image);
    plan.imageAssets[image.assetId] = blob;
    changed();
  }
  /** New placement of an overlay: edits a staged one in place, records an edit otherwise. */
  function placeImage(id: string, after: ImageElement) {
    const staged = plan.images.findIndex((image) => image.id === id);
    if (staged === -1) {
      const existing = plan.imageEdits.find((edit) => edit.id === id);
      if (existing) existing.after = after;
      else {
        const before = (project.images ?? []).find((image) => image.id === id)!;
        plan.imageEdits.push({ id, name: before.name, before: structuredClone(before), after });
      }
    } else {
      plan.images[staged] = after;
    }
    changed();
  }
  async function imageBlob(image: ImageElement): Promise<Blob> {
    return plan.imageAssets[image.assetId] ?? readImageAsset(image.assetId);
  }

  function registerLocation(location: Location): string {
    if (locations.size >= LIMITS.locations) {
      if (!memory.rolling) throw new AIError('limit');
      locations.delete(locations.keys().next().value!);
    }
    const id = `place-${++memory.lastLocation}`;
    locations.set(id, location);
    return id;
  }
  function location(id: unknown): Location {
    const found = locations.get(text(id));
    if (!found) throw new Error('Unknown location ID. Use search_places first.');
    return found;
  }
  /** Counts calls to external services; geocodes and research end the request when exceeded. */
  function budget(kind: keyof typeof used) {
    if (++used[kind] > LIMITS[kind]) {
      if (kind === 'network') throw new Error('Network tool limit reached for this request');
      throw new AIError('limit');
    }
  }
  const distanceKm = (a: LatLon, b: LatLon) =>
    geometry.getDistance([a.lon, a.lat], [b.lon, b.lat]) / 1000;

  return {
    plan,
    project,
    settings,
    signal,
    geometry,
    references,
    current,
    point: (id: unknown) => find(current().points, id, 'point'),
    line: (id: unknown) => find(current().lines, id, 'line'),
    circle: (id: unknown) => find(current().circles, id, 'circle'),
    polygon: (id: unknown) => find(current().polygons, id, 'polygon'),
    image: (id: unknown) => find(current().images, id, 'image overlay'),
    documents,
    stageImage,
    placeImage,
    imageBlob,
    element,
    anyElement,
    reference,
    edit,
    stagePoint,
    stageLine,
    stageCircle,
    stagePolygon,
    stageRoute,
    stageNote,
    changed,
    registerLocation,
    location,
    budget,
    distanceKm,
  };
}
export type ToolContext = ReturnType<typeof createToolContext>;

export function text(value: unknown, max = 300): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error('Invalid or missing text argument');
  return value.trim();
}
export function number(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    throw new Error(`Expected number between ${min} and ${max}`);
  return value;
}
export function idList(value: unknown, min: number, max: number): string[] {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    throw new Error(`Provide between ${min} and ${max} IDs`);
  const list = value.map((id) => text(id));
  if (new Set(list).size !== list.length) throw new Error('Duplicate IDs');
  return list;
}
