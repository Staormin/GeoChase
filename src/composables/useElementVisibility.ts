import type { useDrawing } from '@/composables/useDrawing';
import type { ElementType } from '@/types/project';
import { onBeforeUnmount, onMounted } from 'vue';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

export interface VisibilityTarget {
  type: ElementType;
  id: string;
}

export const visibilityCategories: { type: ElementType; icon: string; key: string }[] = [
  { type: 'point', icon: 'mdi-map-marker-outline', key: 'a' },
  { type: 'circle', icon: 'mdi-circle-outline', key: 'c' },
  { type: 'lineSegment', icon: 'mdi-vector-line', key: 's' },
  { type: 'polygon', icon: 'mdi-vector-polygon', key: 'v' },
  { type: 'image', icon: 'mdi-image-outline', key: 'i' },
  { type: 'route', icon: 'mdi-routes', key: 'r' },
];
export const mapVisibilityKey = 'x';
export const visibilityShortcut = (key: string) => `Alt+${key.toUpperCase()}`;

export function useElementVisibility(
  drawing: Pick<ReturnType<typeof useDrawing>, 'updateElementVisibility'>
) {
  const layers = useLayersStore();
  const ui = useUIStore();

  function categoryVisibilityTargets(type: ElementType): VisibilityTarget[] {
    const categories = {
      point: layers.points,
      circle: layers.circles,
      lineSegment: layers.lineSegments,
      polygon: layers.polygons,
      image: layers.images,
      route: layers.routes,
    };
    return categories[type].map((element) => ({ type, id: element.id }));
  }

  function areAllTargetsVisible(targets: VisibilityTarget[]): boolean {
    return targets.length > 0 && targets.every(({ type, id }) => ui.isElementVisible(type, id));
  }

  function toggleVisibilityTargets(targets: VisibilityTarget[]) {
    const visible = !areAllTargetsVisible(targets);
    for (const { type, id } of targets) {
      ui.setElementVisibility(type, id, visible);
      void drawing.updateElementVisibility(type, id, visible);
    }
  }

  return { categoryVisibilityTargets, areAllTargetsVisible, toggleVisibilityTargets };
}

// Registered by the map page so shortcuts also work with the sidebar closed or replaced.
export function useVisibilityShortcuts(
  drawing: Pick<ReturnType<typeof useDrawing>, 'updateElementVisibility'>
) {
  const ui = useUIStore();
  const { categoryVisibilityTargets, toggleVisibilityTargets } = useElementVisibility(drawing);

  function handleKeydown(event: KeyboardEvent) {
    if (
      event.defaultPrevented ||
      event.repeat ||
      event.isComposing ||
      !event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.getModifierState('AltGraph') ||
      ui.gameMode ||
      ui.openModals.size > 0
    )
      return;
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target.closest(
          'input, textarea, select, [role="textbox"], [role="combobox"], [role="dialog"]'
        ))
    )
      return;
    if (document.querySelector('.v-overlay--active [role="dialog"], .v-dialog.v-overlay--active'))
      return;

    const key = event.key.toLowerCase();
    const category = visibilityCategories.find((category) => category.key === key);
    if (!category && key !== mapVisibilityKey) return;
    event.preventDefault();
    if (category) {
      toggleVisibilityTargets(categoryVisibilityTargets(category.type));
    } else {
      ui.mapBackgroundVisible = !ui.mapBackgroundVisible;
    }
  }

  onMounted(() => document.addEventListener('keydown', handleKeydown));
  onBeforeUnmount(() => document.removeEventListener('keydown', handleKeydown));
}
