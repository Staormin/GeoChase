import { isRecord } from '@/utils/guards';
import { normalizeName } from '@/utils/names';
import { searchAddress } from '../geoportail';

/** Exact municipality matches avoid mistaking an arbitrary POI for a town. */
export async function searchAssistantPlaces(query: string, signal: AbortSignal) {
  try {
    const params = new URLSearchParams({
      nom: query,
      fields: 'nom,code,codeDepartement,centre',
      limit: '5',
    });
    const response = await fetch(`https://geo.api.gouv.fr/communes?${params}`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
      credentials: 'omit',
    });
    if (response.ok) {
      const data: unknown = await response.json();
      const normalize = (name: string) => normalizeName(name).replace(/[^a-z0-9]/g, '');
      const exact = Array.isArray(data)
        ? data
            .filter(isRecord)
            .filter((c) => typeof c.nom === 'string' && normalize(c.nom) === normalize(query))
        : [];
      const matches = exact.flatMap((c) => {
        const coords = isRecord(c.centre) ? c.centre.coordinates : null;
        if (
          !Array.isArray(coords) ||
          typeof coords[0] !== 'number' ||
          typeof coords[1] !== 'number'
        )
          return [];
        return [
          {
            main: `${String(c.nom)} — commune (${String(c.codeDepartement)}), centre géographique`,
            coordinates: { lat: coords[1], lon: coords[0] },
            type: 'municipality',
          },
        ];
      });
      if (matches.length > 0) return matches;
    }
  } catch {
    signal.throwIfAborted();
  }
  return searchAddress(query, 5, signal);
}
