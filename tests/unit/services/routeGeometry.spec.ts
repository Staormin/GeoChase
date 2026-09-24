import { getDistance } from 'ol/sphere';
import { describe, expect, it } from 'vitest';
import { createRouteTraversal } from '@/services/routeGeometry';

describe('route traversal', () => {
  it('follows both legs of a bent route rather than the chord between endpoints', () => {
    const points: [number, number][] = [
      [2, 48],
      [2.01, 48],
      [2.01, 48.01],
    ];
    const firstLength = getDistance(points[0]!, points[1]!);
    const path = createRouteTraversal(points);
    expect(path.at(firstLength / 2).lat).toBeCloseTo(48, 8);
    expect(path.at(firstLength / 2).lon).toBeCloseTo(2.005, 8);
    expect(path.at(firstLength + (path.length - firstLength) / 2).lon).toBeCloseTo(2.01, 8);
    expect(path.at(-100)).toEqual(expect.objectContaining({ lon: 2 }));
    expect(path.at(path.length + 100).lat).toBeCloseTo(48.01, 8);
  });
  it('handles repeated vertices and zero length without invalid coordinates', () => {
    const path = createRouteTraversal([
      [2, 48],
      [2, 48],
    ]);
    expect(path.length).toBe(0);
    expect(path.at(500).lat).toBeCloseTo(48, 8);
  });
});
