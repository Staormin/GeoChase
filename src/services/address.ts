/**
 * Service for address lookup using IGN Geoplateforme API
 */

import { isRecord } from '@/utils/guards';

export interface ReverseGeocodeResult {
  address: string | null;
  city?: string;
  error?: string;
}

/**
 * Get the nearest address for given coordinates using IGN Geoplateforme reverse geocoding
 */
export async function getReverseGeocodeAddress(
  lat: number,
  lon: number,
  signal?: AbortSignal
): Promise<ReverseGeocodeResult> {
  try {
    // Use the IGN Geoplateforme reverse geocoding API
    // https://data.geopf.fr/geocodage/reverse
    const response = await fetch(
      `https://data.geopf.fr/geocodage/reverse?lon=${lon}&lat=${lat}&limit=1`,
      { signal: AbortSignal.any([AbortSignal.timeout(5000), ...(signal ? [signal] : [])]) }
    );

    if (!response.ok) {
      return { address: null, error: `API returned status ${response.status}` };
    }

    const data: unknown = await response.json();

    // The API returns a features array with the closest addresses
    if (isRecord(data) && Array.isArray(data.features) && data.features.length > 0) {
      const feature = data.features[0];
      if (!isRecord(feature) || !isRecord(feature.properties)) return { address: null };
      const properties = feature.properties;

      // Construct address from available properties
      // The API provides: name (street/place name), postcode, city, context (region)
      const addressParts: string[] = [];

      for (const part of [properties.name, properties.postcode, properties.city]) {
        if (typeof part === 'string' && part.trim()) addressParts.push(part.trim());
      }

      if (addressParts.length > 0) {
        const city = typeof properties.city === 'string' ? properties.city.trim() : '';
        return { address: addressParts.join(', '), city: city || undefined };
      }
    }

    return { address: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { address: null, error: errorMessage };
  }
}
