import type { useDrawing } from './useDrawing';
import type { MapContainer } from './useMap';
import type { useNoteTooltips } from './useNoteTooltips';
import type { InjectionKey, Ref } from 'vue';
import { inject } from 'vue';

export const mapKey: InjectionKey<MapContainer> = Symbol('mapContainer');
export const drawingKey: InjectionKey<ReturnType<typeof useDrawing>> = Symbol('drawing');
export const noteTooltipsKey: InjectionKey<Ref<ReturnType<typeof useNoteTooltips> | null>> =
  Symbol('noteTooltips');

export function useMapContext() {
  return requireInjection(mapKey);
}

export function useDrawingContext() {
  return requireInjection(drawingKey);
}

export function useNoteTooltipsContext() {
  return requireInjection(noteTooltipsKey);
}

function requireInjection<T>(key: InjectionKey<T>): T {
  const value = inject(key);
  if (value === undefined) {
    throw new Error(`Missing map context: ${String(key.description)}`);
  }
  return value;
}
