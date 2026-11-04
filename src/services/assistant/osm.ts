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
type Failure = 'timeout' | 'busy' | 'unreachable';
const FAILURES: Record<Failure, string> = {
  timeout:
    'OpenStreetMap ran out of time: this search is too broad. Use a specific tag value or a smaller radius.',
  busy: 'The OpenStreetMap servers are busy. Try again in a minute.',
  unreachable: 'OpenStreetMap did not answer. Tell the user to try again later.',
};
const BUSY_STATUSES = new Set([429, 503, 504]);
const KEY = /^[a-z][\w:]{0,39}$/;
const VALUE = /^[\p{L}\d_ :;.'-]{1,60}$/u;

/** A query that hits the server's time limit still answers 200, with what it found so far. */
function isCutShort(data: Record<string, unknown>) {
  return typeof data.remark === 'string' && /runtime error|timed out/i.test(data.remark);
}

/** Asks each server in turn until one completes the query, else keeps the fullest partial answer. */
async function askServers(query: string, signal: AbortSignal) {
  let data: Record<string, unknown> | undefined;
  let failure: Failure = 'unreachable';
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
        const answer: unknown = await response.json();
        if (!isRecord(answer) || !Array.isArray(answer.elements)) continue;
        if (!isCutShort(answer)) return { data: answer, partial: false };
        failure = 'timeout';
        if (answer.elements.length > ((data?.elements as unknown[]) ?? []).length) data = answer;
      } else if (BUSY_STATUSES.has(response.status) && failure !== 'timeout') {
        failure = 'busy';
      }
    } catch (error) {
      signal.throwIfAborted();
      if (error instanceof DOMException && error.name === 'TimeoutError') failure = 'timeout';
    }
  }
  if (!data) throw new Error(FAILURES[failure]);
  return { data, partial: true };
}

/**
 * Named OpenStreetMap objects with a given tag around a point. Tags are validated, never
 * interpolated raw. `partial` means the servers stopped before the end: more may exist.
 */
export async function searchOsmPlaces(
  options: { key: string; value: string; center: LatLon; radiusKm: number },
  signal: AbortSignal
): Promise<{ places: OsmPlace[]; partial: boolean }> {
  const { key, value, center, radiusKm } = options;
  if (!KEY.test(key)) throw new Error('Invalid OpenStreetMap tag key');
  if (value !== '*' && !VALUE.test(value)) throw new Error('Invalid OpenStreetMap tag value');
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 50)
    throw new Error('Radius must be between 0 and 50 km');
  const filter = value === '*' ? `["${key}"]` : `["${key}"="${value.replaceAll('"', '')}"]`;
  const around = `(around:${Math.round(radiusKm * 1000)},${center.lat},${center.lon})`;
  // Shorter than the request timeout, so that the server can say it ran out of time.
  const query = `[out:json][timeout:20];nwr${filter}["name"]${around};out center 200;`;
  const { data, partial } = await askServers(query, signal);
  const places: OsmPlace[] = [];
  for (const element of data.elements as unknown[]) {
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
  return { places, partial };
}
