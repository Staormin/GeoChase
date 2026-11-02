import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useElementVisibility, visibilityCategories } from '@/composables/useElementVisibility';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

describe('useElementVisibility', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('exposes notes as a global category with its own Alt shortcut', () => {
    const notes = visibilityCategories.find((category) => category.type === 'note');
    expect(notes?.key).toBe('n');
    const keys = visibilityCategories.map((category) => category.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('toggles every note of the category and leaves other elements alone', () => {
    const layers = useLayersStore();
    const ui = useUIStore();
    layers.addNote({ id: 'a', title: 'A', content: '' });
    layers.addNote({ id: 'b', title: 'B', content: '' });
    layers.addPoint({ id: 'p', name: 'P', coordinates: { lat: 48, lon: 2 } });
    const updateElementVisibility = vi.fn();
    const { categoryVisibilityTargets, areAllTargetsVisible, toggleVisibilityTargets } =
      useElementVisibility({ updateElementVisibility });

    const targets = categoryVisibilityTargets('note');
    expect(targets).toEqual([
      { type: 'note', id: 'a' },
      { type: 'note', id: 'b' },
    ]);
    expect(areAllTargetsVisible(targets)).toBe(true);

    toggleVisibilityTargets(targets);
    expect(ui.isElementVisible('note', 'a')).toBe(false);
    expect(ui.isElementVisible('note', 'b')).toBe(false);
    expect(ui.isElementVisible('point', 'p')).toBe(true);
    expect(updateElementVisibility).toHaveBeenCalledWith('note', 'a', false);

    toggleVisibilityTargets(targets);
    expect(areAllTargetsVisible(targets)).toBe(true);
  });
});
