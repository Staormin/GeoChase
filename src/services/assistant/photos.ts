import type { LatLon } from '../geometry';
import type { AIAttachment } from './providers';
import { isRecord } from '@/utils/guards';
import { normalizeName } from '@/utils/names';

interface Candidate {
  subject: string;
  file: string;
  distanceM: number;
  source: PlacePhoto['source'];
}

export interface PlacePhoto {
  /** What the photo shows: the Wikidata item label, or the Commons file name. */
  subject: string;
  source: 'wikidata' | 'commons_nearby';
  distanceM: number;
  /** Commons page of the file, for attribution. */
  page: string;
  image: AIAttachment;
}

const SPARQL = 'https://query.wikidata.org/sparql';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const SEARCH_RADIUS_M = 300;
const THUMB_WIDTH = 800;
// Words shared by many place names; they say nothing about which place it is.
const GENERIC = new Set([
  'eglise',
  'chapelle',
  'cathedrale',
  'basilique',
  'saint',
  'sainte',
  'saints',
  'notre',
  'dame',
  'des',
  'les',
  'del',
  'the',
]);

function words(name: string) {
  return normalizeName(name)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2);
}
/**
 * Share of the point name's distinctive words found in the candidate name.
 * Words shared by many nearby names (usually the town: "… de Melun") are not
 * distinctive, so they cannot match a different building on their own.
 */
function nameScore(pointName: string, candidate: string, common: ReadonlySet<string>) {
  const got = new Set(words(candidate));
  const distinctive = (name: string) =>
    words(name).filter((word) => !GENERIC.has(word) && !common.has(word));
  // "Église Pentecôtiste de Melun": the trailing "de …" usually names the town,
  // which nearby buildings share; match on what comes before it when possible.
  const qualifier = [...pointName.matchAll(/\s(?:de|du|des|d')\s?/giu)].at(-1);
  const core = qualifier ? distinctive(pointName.slice(0, qualifier.index)) : [];
  const key = core.length > 0 ? core : distinctive(pointName);
  return key.length === 0 ? 0 : key.filter((word) => got.has(word)).length / key.length;
}
function commonWords(candidates: Candidate[]) {
  const counts = new Map<string, number>();
  for (const candidate of candidates)
    for (const word of new Set(words(candidate.subject)))
      counts.set(word, (counts.get(word) ?? 0) + 1);
  const threshold = Math.max(2, candidates.length * 0.3);
  return new Set([...counts].filter(([, count]) => count >= threshold).map(([word]) => word));
}

async function json(url: string, signal: AbortSignal, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
    credentials: 'omit',
  });
  if (!response.ok) throw new Error(`Wikimedia ${response.status}`);
  const data: unknown = await response.json();
  if (!isRecord(data)) throw new Error('Wikimedia response');
  return data;
}

/** Wikidata items with an image around the point. */
async function wikidataCandidates(at: LatLon, signal: AbortSignal): Promise<Candidate[]> {
  const query = `SELECT ?itemLabel ?image ?dist WHERE {
  SERVICE wikibase:around { ?item wdt:P625 ?loc . bd:serviceParam wikibase:center "Point(${at.lon} ${at.lat})"^^geo:wktLiteral . bd:serviceParam wikibase:radius "${SEARCH_RADIUS_M / 1000}" . bd:serviceParam wikibase:distance ?dist . }
  ?item wdt:P18 ?image .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" . }
} ORDER BY ?dist LIMIT 20`;
  const data = await json(`${SPARQL}?${new URLSearchParams({ query, format: 'json' })}`, signal, {
    headers: { Accept: 'application/sparql-results+json' },
  });
  const bindings =
    isRecord(data.results) && Array.isArray(data.results.bindings) ? data.results.bindings : [];
  return bindings.flatMap((binding: unknown) => {
    if (!isRecord(binding)) return [];
    const value = (key: string) => {
      const field = binding[key];
      return isRecord(field) && typeof field.value === 'string' ? field.value : '';
    };
    const image = value('image');
    if (!image.includes('Special:FilePath/')) return [];
    return [
      {
        subject: value('itemLabel'),
        file: `File:${decodeURIComponent(image.split('Special:FilePath/', 2)[1]!)}`,
        distanceM: Number(value('dist')) * 1000,
        source: 'wikidata' as const,
      },
    ];
  });
}

/** Commons photos taken around the point, used when no Wikidata item has an image. */
async function commonsCandidates(at: LatLon, signal: AbortSignal): Promise<Candidate[]> {
  const params = new URLSearchParams({
    action: 'query',
    list: 'geosearch',
    gscoord: `${at.lat}|${at.lon}`,
    gsradius: String(Math.min(SEARCH_RADIUS_M, 150)),
    gsnamespace: '6',
    gslimit: '20',
    format: 'json',
    origin: '*',
  });
  const data = await json(`${COMMONS_API}?${params}`, signal);
  const results =
    isRecord(data.query) && Array.isArray(data.query.geosearch) ? data.query.geosearch : [];
  return results.flatMap((item: unknown) =>
    isRecord(item) && typeof item.title === 'string' && /\.(?:jpe?g|png|webp)$/i.test(item.title)
      ? [
          {
            subject: item.title.replace(/^File:/, '').replace(/\.\w+$/, ''),
            file: item.title,
            distanceM: typeof item.dist === 'number' ? item.dist : SEARCH_RADIUS_M,
            source: 'commons_nearby' as const,
          },
        ]
      : []
  );
}

async function thumbnail(file: string, signal: AbortSignal) {
  const params = new URLSearchParams({
    action: 'query',
    titles: file,
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: String(THUMB_WIDTH),
    format: 'json',
    origin: '*',
  });
  const data = await json(`${COMMONS_API}?${params}`, signal);
  const pages =
    isRecord(data.query) && isRecord(data.query.pages) ? Object.values(data.query.pages) : [];
  const info = pages
    .flatMap((page) => (isRecord(page) && Array.isArray(page.imageinfo) ? page.imageinfo : []))
    .find(isRecord);
  if (!info || typeof info.thumburl !== 'string' || typeof info.descriptionurl !== 'string')
    throw new Error('No thumbnail');
  const response = await fetch(info.thumburl, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
    credentials: 'omit',
  });
  const blob = await response.blob();
  if (!response.ok || !/^image\/(?:jpeg|png|webp|gif)$/.test(blob.type))
    throw new Error('No image');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x80_00)
    binary += String.fromCodePoint(...bytes.subarray(i, i + 0x80_00));
  return { page: info.descriptionurl, mimeType: blob.type, data: btoa(binary) };
}

/**
 * Best photo of a named place: the Wikidata item whose name matches, else the
 * nearest Commons photo around it. Returns null when nothing is found.
 */
export async function findPlacePhoto(
  place: { name: string; coordinates: LatLon },
  signal: AbortSignal
): Promise<PlacePhoto | null> {
  const ranked = (candidates: Candidate[]) => {
    const common = commonWords(candidates);
    return candidates
      .map((candidate) => ({
        ...candidate,
        score: nameScore(place.name, candidate.subject, common),
      }))
      .toSorted((a, b) => b.score - a.score || a.distanceM - b.distanceM);
  };
  let candidates = ranked(await wikidataCandidates(place.coordinates, signal)).filter(
    (candidate) => candidate.score >= 0.5
  );
  if (candidates.length === 0)
    candidates = ranked(await commonsCandidates(place.coordinates, signal));
  for (const candidate of candidates.slice(0, 3)) {
    try {
      const { page, mimeType, data } = await thumbnail(candidate.file, signal);
      return {
        subject: candidate.subject,
        source: candidate.source,
        distanceM: Math.round(candidate.distanceM),
        page,
        image: { name: `${place.name} — ${candidate.subject}`, mimeType, data },
      };
    } catch {
      signal.throwIfAborted();
    }
  }
  return null;
}
