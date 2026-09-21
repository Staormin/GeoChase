import { circular } from 'ol/geom/Polygon';
import { fromLonLat, toLonLat } from 'ol/proj';
import { getDistance } from 'ol/sphere';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';
import { useNavigation } from '@/composables/useNavigation';
import { generateCompleteGPX, generateLineSegmentTracks } from '@/services/gpx';
import { createProjectGeometry } from '@/services/projectGeometry';

vi.unmock('ol/proj');
const geometry = createProjectGeometry(() => 'mercator');
const center = { lat: 60, lon: 12 };
const dist = (a: typeof center, b: typeof center) => getDistance([a.lon, a.lat], [b.lon, b.lat]);

describe('geometry consistency across features', () => {
  it('keeps a zero-length midpoint exactly at its endpoint', () => {
    expect(geometry.interpolateLine(center, center, 0.5)).toEqual(center);
  });

  it('uses the same radius for circle drawing, exported points and navigation', () => {
    setActivePinia(createPinia());
    const navigation = useNavigation();
    for (const radius of [1, 100, 1000]) {
      const drawn = circular([center.lon, center.lat], radius * 1000, 64).getCoordinates()[0]!;
      for (const [lon, lat] of drawn)
        expect(Math.abs(dist(center, { lat: lat!, lon: lon! }) - radius * 1000)).toBeLessThan(1e-5);
      for (const p of geometry.generateCircle(center.lat, center.lon, radius, 64))
        expect(Math.abs(dist(center, p) - radius * 1000)).toBeLessThan(1e-5);
      for (const angle of [0, 45, 90, 180, 270]) {
        navigation.navigationState.value.anglePosition = angle;
        const p = navigation.getCircleNavigationCoords({
          id: 'circle',
          name: 'Circle',
          center,
          radius,
        });
        expect(Math.abs(dist(center, p) - radius * 1000)).toBeLessThan(1e-5);
      }
    }
  });

  it('exports a Mercator line with its original vertices and the same measurement', () => {
    const from = { lat: 48.3904, lon: -4.4861 };
    const to = geometry.destinationPoint(from.lat, from.lon, 1000, 90);
    const xml = generateLineSegmentTracks([
      { name: 'Brest', center: from, endpoint: to, mode: 'azimuth', distance: 1000, azimuth: 90 },
    ]);
    const points = [...xml.matchAll(/<trkpt lat="([^"]+)" lon="([^"]+)"/g)].map((m) => ({
      lat: Number(m[1]),
      lon: Number(m[2]),
    }));
    expect(points).toHaveLength(2);
    expect(dist(points[0]!, from)).toBeLessThan(0.000001);
    expect(dist(points[1]!, to)).toBeLessThan(0.000001);
    expect(Math.abs(dist(points[0]!, points[1]!) - 1_000_000)).toBeLessThan(0.000001);
  });

  it('does not round precise user waypoints to six decimal places on export', () => {
    const p = { lat: 48.3904004999, lon: -4.4861004999 };
    const xml = generateCompleteGPX([], [], 64, [], [{ name: 'Precise', coordinates: p }]);
    const m = xml.match(/<wpt lat="([^"]+)" lon="([^"]+)"/)!;
    expect(dist(p, { lat: Number(m[1]), lon: Number(m[2]) })).toBeLessThan(0.000001);
  });

  it('keeps intersection extensions collinear in Mercator at the requested distance', () => {
    const from = { lat: 48.3904, lon: -4.4861 };
    const through = { lat: 50.4501, lon: 30.5234 };
    const to = geometry.endpointFromIntersection(from.lat, from.lon, through.lat, through.lon, 100);
    expect(Math.abs(dist(through, to) - 100_000)).toBeLessThan(0.01);
    const a = fromLonLat([from.lon, from.lat]),
      b = fromLonLat([through.lon, through.lat]),
      c = fromLonLat([to.lon, to.lat]);
    const t = (c[0]! - a[0]!) / (b[0]! - a[0]!);
    const [lon, lat] = toLonLat([a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t]);
    expect(dist(to, { lat: lat!, lon: lon! })).toBeLessThan(0.00001);
  });
});
