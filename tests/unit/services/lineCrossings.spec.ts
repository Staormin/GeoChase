import type { CrossingLine } from '@/services/lineCrossings';
import { fromLonLat } from 'ol/proj';
import { describe, expect, it, vi } from 'vitest';
import { findNearestLineCrossing } from '@/services/lineCrossings';
import { createProjectGeometry } from '@/services/projectGeometry';

vi.unmock('ol/proj');

function line(id: string, coordinates: number[][], finite = true): CrossingLine {
  return {
    id,
    name: `Line ${id}`,
    coordinates,
    endpoints: finite ? [coordinates[0]!, coordinates.at(-1)!] : [],
  };
}

describe('interior line crossings', () => {
  const horizontal = line('east-west', [
    [-100, 0],
    [100, 0],
  ]);
  const vertical = line('north-south', [
    [0, -100],
    [0, 100],
  ]);

  it('returns the exact crossing and both names rather than the nearby pointer position', () => {
    const result = findNearestLineCrossing([horizontal, vertical], [3, 4], 10);
    expect(result?.coordinate).toEqual([0, 0]);
    expect(result?.lines.map((item) => item.name)).toEqual(['Line east-west', 'Line north-south']);
  });

  it('does not use infinite extensions, parallel lines or overlapping lines', () => {
    expect(
      findNearestLineCrossing(
        [
          horizontal,
          line('short', [
            [0, 1],
            [0, 100],
          ]),
        ],
        [0, 0],
        10
      )
    ).toBeNull();
    expect(
      findNearestLineCrossing(
        [
          horizontal,
          line('parallel', [
            [-100, 1],
            [100, 1],
          ]),
        ],
        [0, 0],
        10
      )
    ).toBeNull();
    expect(
      findNearestLineCrossing(
        [
          horizontal,
          line('overlap', [
            [-50, 0],
            [150, 0],
          ]),
        ],
        [0, 0],
        10
      )
    ).toBeNull();
  });

  it.each([
    [
      [0, 0],
      [0, 100],
    ],
    [
      [0, -100],
      [0, 0],
    ],
  ])('excludes a crossing at either endpoint: %j', (start, end) => {
    const endpoint = line('endpoint', [start, end]);
    expect(findNearestLineCrossing([horizontal, endpoint], [2, 2], 10)).toBeNull();
    expect(findNearestLineCrossing([endpoint, horizontal], [2, 2], 10)).toBeNull();
  });

  it('excludes a shared endpoint and reserves the endpoint hit area', () => {
    const short = line('short', [
      [0, -100],
      [0, 5],
    ]);
    expect(findNearestLineCrossing([horizontal, short], [0, 0], 10, 12)).toBeNull();
    expect(
      findNearestLineCrossing(
        [
          line('a', [
            [-100, 0],
            [0, 0],
          ]),
          line('b', [
            [0, 0],
            [0, 100],
          ]),
        ],
        [2, 2],
        10
      )
    ).toBeNull();
  });

  it('accepts sampled interior vertices and selects the closest crossing', () => {
    const sampled = line('sampled', [
      [-100, 0],
      [0, 0],
      [100, 0],
    ]);
    const farther = line('farther', [
      [5, -100],
      [5, 100],
    ]);
    expect(findNearestLineCrossing([sampled, farther, vertical], [1, 2], 10)?.coordinate).toEqual([
      0, 0,
    ]);
    expect(findNearestLineCrossing([sampled, vertical, farther], [4, 2], 10)?.coordinate).toEqual([
      5, 0,
    ]);
  });

  it('requires two distinct lines and a crossing within the cursor radius', () => {
    expect(
      findNearestLineCrossing([horizontal, { ...vertical, id: horizontal.id }], [0, 0], 10)
    ).toBeNull();
    expect(findNearestLineCrossing([horizontal, vertical], [9, 9], 10)).toBeNull();
    expect(
      findNearestLineCrossing(
        [
          horizontal,
          line('zero', [
            [0, 0],
            [0, 0],
          ]),
        ],
        [0, 0],
        10
      )
    ).toBeNull();
  });

  it('handles a parallel across the antimeridian in the displayed world', () => {
    const meridian = line('meridian', [fromLonLat([181, 40]), fromLonLat([181, 60])]);
    const parallel = line('parallel', [fromLonLat([-180, 50]), fromLonLat([180, 50])], false);
    const crossing = fromLonLat([181, 50]);
    expect(findNearestLineCrossing([meridian, parallel], crossing, 100)?.coordinate[0]).toBeCloseTo(
      crossing[0]!,
      5
    );
  });

  it.each(['mercator', 'geodesic'] as const)(
    'uses the displayed %s path for crossings',
    (projection) => {
      const geometry = createProjectGeometry(() => projection);
      const horizontal = line(
        'long',
        geometry.lineCoordinates({ lat: 60, lon: -60 }, { lat: 60, lon: 60 })
      );
      const vertical = line(
        'meridian',
        geometry.lineCoordinates({ lat: 40, lon: 0 }, { lat: 80, lon: 0 })
      );
      const expectedLat = projection === 'geodesic' ? 73.9 : 60;
      const result = findNearestLineCrossing(
        [horizontal, vertical],
        fromLonLat([0, expectedLat]),
        100_000
      );
      expect(result).not.toBeNull();
      expect(result!.coordinate[0]).toBeCloseTo(0, 5);
      expect(result!.coordinate[1]).toBeGreaterThan(fromLonLat([0, expectedLat - 0.2])[1]!);
      expect(result!.coordinate[1]).toBeLessThan(fromLonLat([0, expectedLat + 0.2])[1]!);
    }
  );
});
