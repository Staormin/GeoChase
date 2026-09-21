import { getDistance } from 'ol/sphere';
import { describe, expect, it, vi } from 'vitest';
import { cartesGouvBearing, cartesGouvDestination } from '@/services/cartesGouvGeometry';
import { createProjectGeometry } from '@/services/projectGeometry';

vi.unmock('ol/proj');

// Captured from the deployed cartes.gouv.fr controls, 2026-09-21.
// Reference endpoints were also measured by those actual browser instances.
const brest = { lat: 48.3904, lon: -4.4861 };
const references = [
  { from: brest, km: 100, azimuth: 90, to: { lat: 48.39036026480809, lon: -3.131789801679117 } },
  { from: brest, km: 1000, azimuth: 90, to: { lat: 48.39000161866907, lon: 9.074508467863044 } },
  { from: brest, km: 2520, azimuth: 75, to: { lat: 54.31339604733617, lon: 30.979873180157394 } },
  {
    from: { lat: 48.8566, lon: 2.3522 },
    km: 100,
    azimuth: 45,
    to: { lat: 49.49249957425513, lon: 3.3249657865110582 },
  },
];
const distance = (a: typeof brest, b: typeof brest) => getDistance([a.lon, a.lat], [b.lon, b.lat]);
const angleError = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

describe('cartes.gouv.fr azimuth compatibility', () => {
  it.each(references)(
    'matches the live reference for $km km at $azimuth degrees',
    ({ from, km, azimuth, to }) => {
      expect(angleError(cartesGouvBearing(from, to), azimuth)).toBeLessThan(1e-8);
      const result = cartesGouvDestination(from, km, azimuth);
      expect(distance(result, to)).toBeLessThan(0.001);
      expect(Math.abs(distance(from, result) - km * 1000)).toBeLessThan(0.00001);
    }
  );

  it('matches the live measurement of an existing line without moving its endpoint', () => {
    expect(
      cartesGouvBearing(brest, { lat: 48.382453926466766, lon: -3.131945991238757 })
    ).toBeCloseTo(90.50371314167153, 8);
  });

  it('inverts measurements around the 500 m threshold, all quadrants and the antimeridian', () => {
    for (const from of [
      brest,
      { lat: -40, lon: 170 },
      { lat: 70, lon: -179 },
      { lat: 0, lon: 0 },
    ]) {
      for (const km of [0.001, 0.499999, 0.5, 0.500001, 10, 100, 1000]) {
        for (const azimuth of [0, 0.01, 45, 90, 135, 180, 225, 270, 315, 359.99]) {
          const to = cartesGouvDestination(from, km, azimuth);
          expect(angleError(cartesGouvBearing(from, to), azimuth)).toBeLessThan(1e-6);
          expect(Math.abs(distance(from, to) - km * 1000)).toBeLessThan(0.00001);
        }
      }
    }
  });

  it('routes Mercator measurements, reverse bearings and construction through the same policy', () => {
    const geometry = createProjectGeometry(() => 'mercator');
    const to = geometry.destinationPoint(brest.lat, brest.lon, 100, 90);
    expect(distance(to, references[0]!.to)).toBeLessThan(0.001);
    expect(geometry.calculateBearing(brest.lat, brest.lon, to.lat, to.lon)).toBeCloseTo(90, 7);
    expect(geometry.calculateInverseBearing(brest.lat, brest.lon, to.lat, to.lon)).toBe(
      cartesGouvBearing(to, brest)
    );
  });

  it('handles zero distance and rejects invalid or unreachable requests', () => {
    expect(cartesGouvDestination(brest, 0, 90)).toEqual(brest);
    expect(() => cartesGouvDestination(brest, -1, 90)).toThrow(RangeError);
    expect(() => cartesGouvDestination(brest, 1, Number.NaN)).toThrow(RangeError);
    expect(() => cartesGouvDestination(brest, 21_000, 90)).toThrow(RangeError);
    expect(() => cartesGouvDestination({ lat: 89, lon: 0 }, 1000, 0)).toThrow(RangeError);
  });
});
