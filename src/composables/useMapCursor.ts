import type { MapContainer } from './useMap';

interface CursorState {
  original: string;
  owners: Map<symbol, { cursor: string; priority: number }>;
}

const cursors = new WeakMap<HTMLElement, CursorState>();

/** Share cursor ownership so one hover interaction cannot restore another's stale cursor. */
export function useMapCursor(mapContainer: MapContainer, priority: number) {
  const owner = Symbol('map cursor');
  let target: HTMLElement | undefined;

  function render(element: HTMLElement, state: CursorState) {
    const active = [...state.owners.values()].toSorted((a, b) => b.priority - a.priority)[0];
    element.style.cursor = active?.cursor ?? state.original;
    if (!active) cursors.delete(element);
  }

  function release() {
    if (!target) return;
    const state = cursors.get(target);
    if (state) {
      state.owners.delete(owner);
      render(target, state);
    }
    target = undefined;
  }

  return (cursor: string | null) => {
    const element = mapContainer.map.value?.getTargetElement();
    if (!cursor || !element) {
      release();
      return;
    }
    if (target !== element) release();
    target = element;
    const state = cursors.get(element) ?? { original: element.style.cursor, owners: new Map() };
    state.owners.set(owner, { cursor, priority });
    cursors.set(element, state);
    render(element, state);
  };
}
