import type { RouteData } from '@/types/project';
import { isRecord } from '@/utils/guards';

export function isRouteData(value: unknown): value is RouteData {
  return (
    isRecord(value) &&
    Array.isArray(value.coordinates) &&
    value.coordinates.length >= 2 &&
    value.coordinates.every(
      (point: unknown) =>
        Array.isArray(point) &&
        point.length === 2 &&
        typeof point[0] === 'number' &&
        Number.isFinite(point[0]) &&
        Math.abs(point[0]) <= 180 &&
        typeof point[1] === 'number' &&
        Number.isFinite(point[1]) &&
        Math.abs(point[1]) <= 90
    ) &&
    typeof value.distance === 'number' &&
    Number.isFinite(value.distance) &&
    value.distance >= 0 &&
    typeof value.duration === 'number' &&
    Number.isFinite(value.duration) &&
    value.duration >= 0 &&
    (value.profile === 'pedestrian' || value.profile === 'car') &&
    (value.optimization === 'shortest' || value.optimization === 'fastest')
  );
}

/** Direct browser request: no key, proxy or application backend. */
export async function calculateRoute(
  start: { lat: number; lon: number },
  end: { lat: number; lon: number },
  profile: RouteData['profile'],
  optimization: RouteData['optimization'],
  signal: AbortSignal,
  intermediates: Array<{ lat: number; lon: number }> = []
): Promise<RouteData> {
  const params = new URLSearchParams({
    resource: 'bdtopo-osrm',
    start: `${start.lon},${start.lat}`,
    end: `${end.lon},${end.lat}`,
    profile,
    optimization,
    geometryFormat: 'geojson',
    crs: 'EPSG:4326',
    distanceUnit: 'meter',
    timeUnit: 'second',
    getSteps: 'false',
  });
  if (intermediates.length > 0) {
    params.set(
      'intermediates',
      intermediates.map((point) => `${point.lon},${point.lat}`).join('|')
    );
  }
  const response = await fetch(`https://data.geopf.fr/navigation/itineraire?${params}`, { signal });
  if (!response.ok) throw new Error(response.status === 429 ? 'rateLimit' : 'failed');
  const data: unknown = await response.json();
  if (!isRecord(data) || !isRecord(data.geometry) || data.geometry.type !== 'LineString') {
    throw new Error('failed');
  }
  const route = {
    coordinates: data.geometry.coordinates,
    distance: data.distance,
    duration: data.duration,
    profile,
    optimization,
  };
  if (!isRouteData(route)) throw new Error('failed');
  return route;
}

export function routeBounds(route: RouteData): [[number, number], [number, number]] {
  const bounds: [[number, number], [number, number]] = [
    [90, 180],
    [-90, -180],
  ];
  for (const [lon, lat] of route.coordinates) {
    bounds[0][0] = Math.min(bounds[0][0], lat);
    bounds[0][1] = Math.min(bounds[0][1], lon);
    bounds[1][0] = Math.max(bounds[1][0], lat);
    bounds[1][1] = Math.max(bounds[1][1], lon);
  }
  return bounds;
}
