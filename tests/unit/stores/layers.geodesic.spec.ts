/**
 * Unit tests for the per-line geodesic flag: persistence round-trip and
 * backward compatibility with projects saved before the flag existed.
 */

import type { LineSegmentElement } from '@/services/storage';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLayersStore } from '@/stores/layers';

function makeLine(overrides: Partial<LineSegmentElement> = {}): LineSegmentElement {
  return {
    id: 'line-1',
    name: 'Paris → New York',
    center: { lat: 48.8566, lon: 2.3522 },
    endpoint: { lat: 40.7128, lon: -74.006 },
    mode: 'coordinate',
    ...overrides,
  };
}

describe('LayersStore - geodesic flag', () => {
  let layersStore: ReturnType<typeof useLayersStore>;

  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    layersStore = useLayersStore();
  });

  it('round-trips the geodesic flag through export/load', () => {
    layersStore.addLineSegment(makeLine({ id: 'geo', geodesic: true }));
    layersStore.addLineSegment(makeLine({ id: 'straight', name: 'Straight line' }));

    // JSON round-trip simulates real persistence (localStorage / project files)
    // and safely unwraps Vue reactive proxies, unlike structuredClone
    // eslint-disable-next-line unicorn/prefer-structured-clone
    const exported = JSON.parse(JSON.stringify(layersStore.exportLayers()));
    layersStore.loadLayers(exported);

    const geodesicLine = layersStore.lineSegments.find((l) => l.id === 'geo');
    const straightLine = layersStore.lineSegments.find((l) => l.id === 'straight');
    expect(geodesicLine?.geodesic).toBe(true);
    expect(straightLine?.geodesic).toBeUndefined();
  });

  it('round-trip keeps the geometry unchanged (center and endpoint)', () => {
    const line = makeLine({ geodesic: true });
    layersStore.addLineSegment(line);

    // JSON round-trip simulates real persistence (localStorage / project files)
    // and safely unwraps Vue reactive proxies, unlike structuredClone
    // eslint-disable-next-line unicorn/prefer-structured-clone
    const exported = JSON.parse(JSON.stringify(layersStore.exportLayers()));
    layersStore.loadLayers(exported);

    const reloaded = layersStore.lineSegments[0]!;
    expect(reloaded.center).toEqual({ lat: 48.8566, lon: 2.3522 });
    expect(reloaded.endpoint).toEqual({ lat: 40.7128, lon: -74.006 });
    expect(reloaded.mode).toBe('coordinate');
    expect(reloaded.geodesic).toBe(true);
  });

  it('loads legacy projects without the geodesic field (missing means false)', () => {
    // Simulates a project JSON written before the geodesic feature existed
    const legacyProject = {
      circles: [],
      lineSegments: [
        {
          id: 'legacy-line',
          name: 'Legacy Line',
          center: { lat: 10, lon: 20 },
          endpoint: { lat: 11, lon: 21 },
          mode: 'coordinate',
        },
        {
          id: 'legacy-azimuth',
          name: 'Legacy Azimuth',
          center: { lat: 10, lon: 20 },
          endpoint: { lat: 12, lon: 22 },
          mode: 'azimuth',
          distance: 100,
          azimuth: 45,
        },
        {
          id: 'legacy-parallel',
          name: 'Legacy Parallel',
          center: { lat: 45, lon: 0 },
          mode: 'parallel',
          longitude: 45,
        },
      ] as LineSegmentElement[],
      points: [],
    };

    expect(() => layersStore.loadLayers(legacyProject)).not.toThrow();
    expect(layersStore.lineSegments).toHaveLength(3);

    for (const segment of layersStore.lineSegments) {
      // Missing flag: falsy, so all consumers treat it as a straight line
      expect(segment.geodesic ?? false).toBe(false);
    }

    // Geometry untouched on load
    const legacyLine = layersStore.lineSegments.find((l) => l.id === 'legacy-line');
    expect(legacyLine?.center).toEqual({ lat: 10, lon: 20 });
    expect(legacyLine?.endpoint).toEqual({ lat: 11, lon: 21 });
  });

  it('updateLineSegment can toggle the geodesic flag in place', () => {
    layersStore.addLineSegment(makeLine());
    layersStore.updateLineSegment('line-1', { geodesic: true });
    expect(layersStore.lineSegments[0]!.geodesic).toBe(true);

    layersStore.updateLineSegment('line-1', { geodesic: undefined });
    expect(layersStore.lineSegments[0]!.geodesic).toBeUndefined();
  });
});
