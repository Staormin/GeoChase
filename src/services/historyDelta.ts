import type { ProjectLayerData, ProjectProjection } from '@/types/project';
import { v4 as uuidv4 } from 'uuid';

export const HISTORY_LIMIT = 1000;
export const HISTORY_MAX_BYTES = 8 * 1024 * 1024;
export const historyCollections = [
  'images',
  'routes',
  'circles',
  'lineSegments',
  'points',
  'polygons',
  'notes',
  'elementGroups',
] as const;

type Collection = (typeof historyCollections)[number];
type HistoryLayers = { [K in Collection]: NonNullable<ProjectLayerData[K]> };
type Fields = Map<string, string>;
interface CollectionSnapshot {
  order: string[];
  items: Map<string, Fields>;
}
export interface HistorySnapshot {
  data: Record<Collection, CollectionSnapshot>;
  projection: ProjectProjection;
  visibility: Record<string, boolean>;
}
interface CollectionDelta {
  collection: Collection;
  elements: { id: string; fields: [string, string | null, string | null][] }[];
  order?: { index: number; before: string[]; after: string[] };
}
interface HistoryDelta {
  collections: CollectionDelta[];
  projection?: [ProjectProjection, ProjectProjection];
  visibility: [string, boolean | null, boolean | null][];
}
export interface HistoryStep {
  id: string;
  delta: string;
}
export interface ProjectHistory {
  steps: HistoryStep[];
  position: number;
  visibility: Record<string, boolean>;
}

// Keep only the present state in memory. Each field is encoded independently so a
// name/color edit never retains another copy of an itinerary's coordinate array.
export function captureHistorySnapshot(
  layers: HistoryLayers,
  projection: ProjectProjection,
  visibility: Record<string, boolean>
): HistorySnapshot {
  const data = {} as HistorySnapshot['data'];
  for (const collection of historyCollections) {
    data[collection] = {
      order: (layers[collection] ?? []).map((element) => element.id),
      items: new Map(
        (layers[collection] ?? []).map((element) => [
          element.id,
          new Map(
            Object.entries(element)
              .filter(([, value]) => value !== undefined)
              .map(([field, value]) => [field, JSON.stringify(value)])
          ),
        ])
      ),
    };
  }
  return { data, projection, visibility: { ...visibility } };
}

export function createHistoryStep(
  before: HistorySnapshot,
  after: HistorySnapshot
): HistoryStep | null {
  const delta: HistoryDelta = { collections: [], visibility: [] };
  for (const collection of historyCollections) {
    const old = before.data[collection];
    const current = after.data[collection];
    const change: CollectionDelta = { collection, elements: [] };
    for (const id of new Set([...old.items.keys(), ...current.items.keys()])) {
      const a = old.items.get(id) ?? new Map<string, string>();
      const b = current.items.get(id) ?? new Map<string, string>();
      const fields: CollectionDelta['elements'][number]['fields'] = [];
      for (const field of new Set([...a.keys(), ...b.keys()])) {
        const left = a.get(field) ?? null;
        const right = b.get(field) ?? null;
        if (left !== right) fields.push([field, left, right]);
      }
      if (fields.length > 0) change.elements.push({ id, fields });
    }
    // Preserve insertion/deletion/reordering without storing the unchanged IDs.
    let start = 0;
    while (
      start < old.order.length &&
      start < current.order.length &&
      old.order[start] === current.order[start]
    )
      start++;
    let end = 0;
    while (
      end < old.order.length - start &&
      end < current.order.length - start &&
      old.order[old.order.length - 1 - end] === current.order[current.order.length - 1 - end]
    )
      end++;
    if (start < old.order.length || start < current.order.length) {
      change.order = {
        index: start,
        before: old.order.slice(start, old.order.length - end),
        after: current.order.slice(start, current.order.length - end),
      };
    }
    if (change.elements.length > 0 || change.order) delta.collections.push(change);
  }
  if (before.projection !== after.projection)
    delta.projection = [before.projection, after.projection];
  for (const key of new Set([
    ...Object.keys(before.visibility),
    ...Object.keys(after.visibility),
  ])) {
    const a = before.visibility[key] ?? null;
    const b = after.visibility[key] ?? null;
    if (a !== b) delta.visibility.push([key, a, b]);
  }
  if (delta.collections.length === 0 && !delta.projection && delta.visibility.length === 0)
    return null;
  return { id: uuidv4(), delta: JSON.stringify(delta) };
}

export function applyHistoryStep(
  snapshot: HistorySnapshot,
  step: HistoryStep,
  forward: boolean
): HistorySnapshot {
  const delta = JSON.parse(step.delta) as HistoryDelta;
  const data = { ...snapshot.data };
  for (const change of delta.collections) {
    const collection = data[change.collection];
    const items = new Map(collection.items);
    for (const element of change.elements) {
      const identity = element.fields.find(([field]) => field === 'id');
      if (identity && identity[forward ? 2 : 1] === null) {
        // Remove the whole element, including defaults added by load normalization.
        items.delete(element.id);
        continue;
      }
      const fields = identity ? new Map<string, string>() : new Map(items.get(element.id));
      for (const [field, before, after] of element.fields) {
        const value = forward ? after : before;
        if (value === null) fields.delete(field);
        else fields.set(field, value);
      }
      if (fields.size > 0) items.set(element.id, fields);
      else items.delete(element.id);
    }
    const order = collection.order.slice();
    if (change.order) {
      const { index, before, after } = change.order;
      const inserted = forward ? after : before;
      order.splice(index, (forward ? before : after).length, ...inserted);
    }
    data[change.collection] = { items, order };
  }
  const visibility = new Map(Object.entries(snapshot.visibility));
  for (const [key, before, after] of delta.visibility) {
    const value = forward ? after : before;
    if (value === null) visibility.delete(key);
    else visibility.set(key, value);
  }
  return {
    data,
    projection: delta.projection ? delta.projection[forward ? 1 : 0] : snapshot.projection,
    visibility: Object.fromEntries(visibility),
  };
}

export function historyLayers(snapshot: HistorySnapshot): HistoryLayers {
  return Object.fromEntries(
    historyCollections.map((collection) => [
      collection,
      snapshot.data[collection].order.map((id) =>
        Object.fromEntries(
          [...snapshot.data[collection].items.get(id)!].map(([field, value]) => [
            field,
            JSON.parse(value),
          ])
        )
      ),
    ])
  ) as HistoryLayers;
}

// UTF-16 payload size with a conservative allowance for keys/record metadata.
// This bounds retained history, independently of browser compression and quotas.
export function historyBytes(history: ProjectHistory): number {
  return (
    512 +
    JSON.stringify(history.visibility).length * 2 +
    history.steps.reduce((sum, step) => sum + step.delta.length * 2 + step.id.length * 2 + 256, 0)
  );
}

export function trimHistory<T extends ProjectHistory>(history: T, maxBytes = HISTORY_MAX_BYTES): T {
  const result = { ...history, steps: history.steps.slice() };
  let bytes = historyBytes(result);
  while (result.steps.length > 0 && (result.steps.length > HISTORY_LIMIT || bytes > maxBytes)) {
    // Remove old undo first. If already at the beginning, remove distant redo.
    const removed = result.position > 0 ? result.steps.shift()! : result.steps.pop()!;
    if (result.position > 0) result.position--;
    bytes -= removed.delta.length * 2 + removed.id.length * 2 + 256;
  }
  return result;
}
