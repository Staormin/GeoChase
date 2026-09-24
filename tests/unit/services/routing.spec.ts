import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseLayersJSON } from '@/domain/layers';
import { changeProjectProjection } from '@/services/projectProjection';
import { calculateRoute, isRouteData } from '@/services/routing';

const route = {
  coordinates: [
    [2, 48],
    [2.1, 48.2],
    [2.3, 48.1],
  ],
  distance: 30_000,
  duration: 3600,
  profile: 'pedestrian',
  optimization: 'shortest',
};
afterEach(() => vi.unstubAllGlobals());
describe('IGN routing', () => {
  it('requests WGS84 longitude first and explicit units, preserves road geometry', async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        geometry: { type: 'LineString', coordinates: route.coordinates },
        distance: route.distance,
        duration: route.duration,
      })
    );
    vi.stubGlobal('fetch', fetch);
    expect(
      await calculateRoute(
        { lat: 48, lon: 2 },
        { lat: 48.1, lon: 2.3 },
        'pedestrian',
        'shortest',
        new AbortController().signal
      )
    ).toEqual(route);
    const url = new URL(fetch.mock.calls[0]![0]);
    expect(url.searchParams.has('intermediates')).toBe(false);
    expect(url.searchParams.get('start')).toBe('2,48');
    expect(url.searchParams.get('distanceUnit')).toBe('meter');
    expect(url.searchParams.get('timeUnit')).toBe('second');
  });
  it('rejects malformed geometry and invalid metrics', () => {
    expect(isRouteData({ ...route, coordinates: [[2, 48]] })).toBe(false);
    expect(
      isRouteData({
        ...route,
        coordinates: [
          [Number.NaN, 48],
          [2, 48],
        ],
      })
    ).toBe(false);
    expect(isRouteData({ ...route, duration: -1 })).toBe(false);
  });
  it('preserves the road path through JSON import and projection changes', () => {
    const layers = parseLayersJSON(
      JSON.stringify({
        routes: [
          {
            id: 'r',
            name: 'Route',
            intermediates: [{ lat: 48.2, lon: 2.1 }],

            start: { lat: 48, lon: 2 },
            end: { lat: 48.1, lon: 2.3 },
            ...route,
          },
        ],
      })
    );
    expect(
      changeProjectProjection(layers, 'mercator', 'geodesic').routes?.[0]?.coordinates
    ).toEqual(route.coordinates);
    expect(
      changeProjectProjection(layers, 'mercator', 'geodesic').routes?.[0]?.intermediates
    ).toEqual([{ lat: 48.2, lon: 2.1 }]);
    expect(() =>
      parseLayersJSON(
        JSON.stringify({
          routes: [{ ...layers.routes?.[0], intermediates: [{ lat: 100, lon: 2 }] }],
        })
      )
    ).toThrow();
    expect(() =>
      parseLayersJSON(JSON.stringify({ routes: [{ ...layers.routes?.[0], intermediates: 'bad' }] }))
    ).toThrow();
    expect(() =>
      parseLayersJSON(
        JSON.stringify({
          routes: [{ ...layers.routes?.[0], coordinates: [] }],
        })
      )
    ).toThrow();
  });
});

it('encodes intermediate points in their requested order with pipe separators', async () => {
  const fetch = vi.fn().mockResolvedValue(
    Response.json({
      geometry: { type: 'LineString', coordinates: route.coordinates },
      distance: route.distance,
      duration: route.duration,
    })
  );
  vi.stubGlobal('fetch', fetch);
  await calculateRoute(
    { lat: 48, lon: 2 },
    { lat: 48.1, lon: 2.3 },
    'pedestrian',
    'shortest',
    new AbortController().signal,
    [
      { lat: 48.2, lon: 2.1 },
      { lat: 48.3, lon: 2.2 },
    ]
  );
  const params = new URL(fetch.mock.calls[0]![0]).searchParams;
  expect(params.get('intermediates')).toBe('2.1,48.2|2.2,48.3');
});
