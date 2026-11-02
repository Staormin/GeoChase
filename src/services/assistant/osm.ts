import type { LatLon } from '../geometry';
import { isRecord } from '@/utils/guards';
import { OVERPASS_API, overpassQueue, PUBLIC_OVERPASS_API } from '../geoportail';

export interface OsmPlace {
  name: string;
  tag: string;
  coordinates: LatLon;
}

// The configured instance first; public ones are tried when it is overloaded or unreachable.
const OVERPASS_SERVERS = [
  ...new Set([
    OVERPASS_API,
    PUBLIC_OVERPASS_API,
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  ]),
];
const KEY = /^[a-z][\w:]{0,39}$/;
const VALUE = /^[\p{L}\d_ :;.'-]{1,60}$/u;

/** Named OpenStreetMap objects with a given tag around a point. Tags are validated, never interpolated raw. */
export async function searchOsmPlaces(
  options: { key: string; value: string; center: LatLon; radiusKm: number },
  signal: AbortSignal
): Promise<OsmPlace[]> {
  const { key, value, center, radiusKm } = options;
  if (!KEY.test(key)) throw new Error('Invalid OpenStreetMap tag key');
  if (value !== '*' && !VALUE.test(value)) throw new Error('Invalid OpenStreetMap tag value');
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 50)
    throw new Error('Radius must be between 0 and 50 km');
  const filter = value === '*' ? `["${key}"]` : `["${key}"="${value.replaceAll('"', '')}"]`;
  const around = `(around:${Math.round(radiusKm * 1000)},${center.lat},${center.lon})`;
  const query = `[out:json][timeout:25];nwr${filter}["name"]${around};out center 200;`;
  let data: unknown;
  for (const server of OVERPASS_SERVERS) {
    try {
      // Shares the app's Overpass queue so searches never overlap on a rate-limited server.
      const response = await overpassQueue.add(() =>
        fetch(server, {
          method: 'POST',
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.any([signal, AbortSignal.timeout(25_000)]),
          credentials: 'omit',
        })
      );
      if (response.ok) {
        data = await response.json();
        break;
      }
    } catch {
      signal.throwIfAborted();
    }
  }
  if (!isRecord(data) || !Array.isArray(data.elements))
    throw new Error('OpenStreetMap did not answer. Tell the user to try again later.');
  const places: OsmPlace[] = [];
  for (const element of data.elements) {
    if (!isRecord(element) || !isRecord(element.tags)) continue;
    const position = isRecord(element.center) ? element.center : element;
    const { lat, lon } = position;
    const name = element.tags.name;
    if (typeof name !== 'string' || typeof lat !== 'number' || typeof lon !== 'number') continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const tagValue = element.tags[key];
    places.push({
      name: name.slice(0, 200),
      tag: `${key}=${typeof tagValue === 'string' ? tagValue.slice(0, 60) : value}`,
      coordinates: { lat, lon },
    });
  }
  return places;
}
