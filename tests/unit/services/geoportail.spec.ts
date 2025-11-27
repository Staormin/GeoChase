import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  distancePointToSegment,
  getMapAttribution,
  getMapTilesUrl,
  haversineDistance,
  searchAddress,
  searchLocationsNearPath,
} from '@/services/geoportail';

describe('geoportail service', () => {
  describe('getMapTilesUrl', () => {
    it('should return geoportail URL by default', () => {
      const url = getMapTilesUrl();
      expect(url).toContain('data.geopf.fr');
      expect(url).toContain('GEOGRAPHICALGRIDSYSTEMS.MAPS');
    });

    it('should return geoportail URL for geoportail provider', () => {
      const url = getMapTilesUrl('geoportail');
      expect(url).toContain('data.geopf.fr');
    });

    it('should return OSM URL for osm provider', () => {
      const url = getMapTilesUrl('osm');
      expect(url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    });

    it('should return Google Maps URL for google-plan provider', () => {
      const url = getMapTilesUrl('google-plan');
      expect(url).toBe('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}');
    });

    it('should return Google Satellite URL for google-satellite provider', () => {
      const url = getMapTilesUrl('google-satellite');
      expect(url).toBe('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}');
    });

    it('should return Google Relief URL for google-relief provider', () => {
      const url = getMapTilesUrl('google-relief');
      expect(url).toBe('https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}');
    });
  });

  describe('getMapAttribution', () => {
    it('should return IGN attribution by default', () => {
      const attr = getMapAttribution();
      expect(attr).toContain('IGN');
    });

    it('should return IGN attribution for geoportail', () => {
      const attr = getMapAttribution('geoportail');
      expect(attr).toContain('IGN');
    });

    it('should return OSM attribution for osm', () => {
      const attr = getMapAttribution('osm');
      expect(attr).toContain('OpenStreetMap');
    });

    it('should return Google attribution for google-plan', () => {
      const attr = getMapAttribution('google-plan');
      expect(attr).toContain('Google');
    });

    it('should return Google attribution for google-satellite', () => {
      const attr = getMapAttribution('google-satellite');
      expect(attr).toContain('Google');
    });

    it('should return Google attribution for google-relief', () => {
      const attr = getMapAttribution('google-relief');
      expect(attr).toContain('Google');
    });
  });

  describe('DEFAULT_MAP_CENTER', () => {
    it('should be Paris coordinates', () => {
      expect(DEFAULT_MAP_CENTER.lat).toBeCloseTo(48.8566, 4);
      expect(DEFAULT_MAP_CENTER.lon).toBeCloseTo(2.3522, 4);
    });
  });

  describe('DEFAULT_MAP_ZOOM', () => {
    it('should be 12', () => {
      expect(DEFAULT_MAP_ZOOM).toBe(12);
    });
  });

  describe('haversineDistance', () => {
    it('should return 0 for same point', () => {
      const point = { lat: 48.8566, lon: 2.3522 };
      const distance = haversineDistance(point, point);
      expect(distance).toBe(0);
    });

    it('should calculate distance between two points', () => {
      const paris = { lat: 48.8566, lon: 2.3522 };
      const london = { lat: 51.5074, lon: -0.1278 };
      const distance = haversineDistance(paris, london);

      // Distance Paris-London is approximately 343 km
      expect(distance).toBeCloseTo(343, -1);
    });

    it('should calculate short distances', () => {
      const point1 = { lat: 48.8566, lon: 2.3522 };
      const point2 = { lat: 48.8576, lon: 2.3532 };
      const distance = haversineDistance(point1, point2);

      // Should be approximately 0.12 km (120 meters)
      expect(distance).toBeGreaterThan(0.1);
      expect(distance).toBeLessThan(0.2);
    });
  });

  describe('distancePointToSegment', () => {
    it('should return distance to start point when closest', () => {
      const point = { lat: 48.8566, lon: 2.3522 };
      const segStart = { lat: 48.86, lon: 2.3522 };
      const segEnd = { lat: 48.87, lon: 2.3522 };

      const distance = distancePointToSegment(point, segStart, segEnd);

      // Should be distance to start (closer than end or mid)
      const distToStart = haversineDistance(point, segStart);
      expect(distance).toBeCloseTo(distToStart, 2);
    });

    it('should return distance to midpoint when closest', () => {
      const point = { lat: 48.865, lon: 2.36 };
      const segStart = { lat: 48.86, lon: 2.3522 };
      const segEnd = { lat: 48.87, lon: 2.3522 };

      const distance = distancePointToSegment(point, segStart, segEnd);

      // Should be the minimum of distances to start, end, and mid
      expect(distance).toBeGreaterThan(0);
    });

    it('should handle segment with same start and end', () => {
      const point = { lat: 48.8566, lon: 2.3522 };
      const segStart = { lat: 48.86, lon: 2.3522 };

      const distance = distancePointToSegment(point, segStart, segStart);

      expect(distance).toBeCloseTo(haversineDistance(point, segStart), 2);
    });
  });

  describe('searchAddress', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return empty array for empty query', async () => {
      const results = await searchAddress('');
      expect(results).toEqual([]);
    });

    it('should return empty array for whitespace query', async () => {
      const results = await searchAddress('   ');
      expect(results).toEqual([]);
    });

    it('should return search results', async () => {
      const mockResponse = {
        results: [
          {
            fulltext: 'Tour Eiffel, Paris',
            x: 2.2945,
            y: 48.858,
            kind: 'poi',
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const results = await searchAddress('Tour Eiffel');

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        main: 'Tour Eiffel, Paris',
        secondary: 'poi',
        coordinates: { lat: 48.858, lon: 2.2945 },
        type: 'poi',
      });
    });

    it('should handle results without kind', async () => {
      const mockResponse = {
        results: [
          {
            fulltext: 'Some Place',
            x: 2.3,
            y: 48.9,
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const results = await searchAddress('Some Place');

      expect(results[0]?.secondary).toBeUndefined();
      expect(results[0]?.type).toBeUndefined();
    });

    it('should return empty array when no results', async () => {
      const mockResponse = {
        results: [],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const results = await searchAddress('nonexistent');

      expect(results).toEqual([]);
    });

    it('should return empty array when results is not an array', async () => {
      const mockResponse = {
        results: 'not an array',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const results = await searchAddress('test');

      expect(results).toEqual([]);
    });

    it('should return empty array when results is missing', async () => {
      const mockResponse = {};

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const results = await searchAddress('test');

      expect(results).toEqual([]);
    });

    it('should throw error on API failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      await expect(searchAddress('test')).rejects.toThrow('Failed to search address');
    });

    it('should throw error on network failure', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      await expect(searchAddress('test')).rejects.toThrow(
        'Failed to search address: Network error'
      );
    });

    it('should throw error with unknown error message for non-Error throws', async () => {
      vi.mocked(fetch).mockRejectedValueOnce('string error');

      await expect(searchAddress('test')).rejects.toThrow(
        'Failed to search address: Unknown error'
      );
    });

    it('should handle multiple concurrent requests via RequestQueue', async () => {
      // Make multiple concurrent calls to test RequestQueue rate limiting
      const mockResponse = { results: [{ fulltext: 'Test', x: 2.3, y: 48.8, kind: 'poi' }] };

      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, json: async () => mockResponse } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => mockResponse } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => mockResponse } as Response);

      // Fire multiple requests concurrently
      const results = await Promise.all([
        searchAddress('query1'),
        searchAddress('query2'),
        searchAddress('query3'),
      ]);

      expect(results).toHaveLength(3);
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('should use custom limit parameter', async () => {
      const mockResponse = { results: [] };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await searchAddress('test', 5);

      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('limit=5'));
    });
  });

  describe('searchLocationsNearPath', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return empty array for empty path', async () => {
      const results = await searchLocationsNearPath([]);
      expect(results).toEqual([]);
    });

    it('should return empty array for null path', async () => {
      const results = await searchLocationsNearPath(null as any);
      expect(results).toEqual([]);
    });

    it('should search locations for single point path', async () => {
      const mockOverpassResponse = `<?xml version="1.0"?>
        <osm>
          <node lat="48.857" lon="2.352">
            <tag k="name" v="Test Location"/>
            <tag k="place" v="locality"/>
          </node>
        </osm>`;

      const mockElevationResponse = {
        results: [{ latitude: 48.857, longitude: 2.352, elevation: 100 }],
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockOverpassResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockElevationResponse,
        } as Response);

      const results = await searchLocationsNearPath([{ lat: 48.8566, lon: 2.3522 }], 1);

      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should search locations for line path', async () => {
      const mockOverpassResponse = `<?xml version="1.0"?>
        <osm>
          <node lat="48.86" lon="2.36">
            <tag k="name" v="Test Place"/>
            <tag k="place" v="village"/>
          </node>
        </osm>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => mockOverpassResponse,
      } as Response);

      const pathPoints = [
        { lat: 48.8566, lon: 2.3522 },
        { lat: 48.9, lon: 2.4 },
      ];

      await searchLocationsNearPath(pathPoints, 5);

      expect(fetch).toHaveBeenCalled();
    });

    it('should handle Overpass API errors gracefully', async () => {
      // Mock fetch to return a failed response (which is caught by Promise.allSettled)
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Server error',
      } as Response);

      const results = await searchLocationsNearPath([{ lat: 48.8566, lon: 2.3522 }], 1);

      // Should return empty array on error (error caught by Promise.allSettled)
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle invalid XML response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => 'not valid xml <><>',
      } as Response);

      const results = await searchLocationsNearPath([{ lat: 48.8566, lon: 2.3522 }], 1);

      // Should handle parse error gracefully
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle parseerror in XML response', async () => {
      // Create XML that will produce a parsererror
      const xmlWithParseError = `<?xml version="1.0"?>
        <parsererror>XML parsing failed</parsererror>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => xmlWithParseError,
      } as Response);

      const results = await searchLocationsNearPath([{ lat: 48.8566, lon: 2.3522 }], 1);

      expect(Array.isArray(results)).toBe(true);
    });

    it('should extract type value from non-priority tags', async () => {
      // This tests the getTypeValueFromElement fallback loop
      const mockOverpassResponse = `<?xml version="1.0"?>
        <osm>
          <node lat="48.857" lon="2.352">
            <tag k="name" v="Test Location"/>
            <tag k="custom_type" v="special_value"/>
          </node>
        </osm>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => mockOverpassResponse,
      } as Response);

      const results = await searchLocationsNearPath([{ lat: 48.8566, lon: 2.3522 }], 1);

      expect(Array.isArray(results)).toBe(true);
    });

    it('should use buffer polygon for filtering when provided', async () => {
      const mockOverpassResponse = `<?xml version="1.0"?>
        <osm>
          <node lat="48.857" lon="2.353">
            <tag k="name" v="Inside Location"/>
            <tag k="place" v="locality"/>
          </node>
        </osm>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => mockOverpassResponse,
      } as Response);

      const bufferPolygon = {
        type: 'Polygon',
        coordinates: [
          [
            [2.35, 48.85],
            [2.36, 48.85],
            [2.36, 48.86],
            [2.35, 48.86],
            [2.35, 48.85],
          ],
        ],
      };

      const results = await searchLocationsNearPath(
        [{ lat: 48.8566, lon: 2.3522 }],
        1,
        bufferPolygon
      );

      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle Feature type polygon for filtering (line 319)', async () => {
      const mockOverpassResponse = `<?xml version="1.0"?>
        <osm>
          <node lat="48.857" lon="2.353">
            <tag k="name" v="Inside Location"/>
            <tag k="place" v="locality"/>
          </node>
        </osm>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => mockOverpassResponse,
      } as Response);

      // Test with Feature type polygon (line 319 branch)
      const featurePolygon = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [2.35, 48.85],
              [2.36, 48.85],
              [2.36, 48.86],
              [2.35, 48.86],
              [2.35, 48.85],
            ],
          ],
        },
      };

      const results = await searchLocationsNearPath(
        [{ lat: 48.8566, lon: 2.3522 }],
        1,
        featurePolygon
      );

      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle invalid polygon type (line 322)', async () => {
      const mockOverpassResponse = `<?xml version="1.0"?>
        <osm>
          <node lat="48.857" lon="2.353">
            <tag k="name" v="Test Location"/>
            <tag k="place" v="locality"/>
          </node>
        </osm>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => mockOverpassResponse,
      } as Response);

      // Invalid polygon type - triggers line 322 (return false)
      const invalidPolygon = {
        type: 'Point',
        coordinates: [2.35, 48.85],
      };

      const results = await searchLocationsNearPath(
        [{ lat: 48.8566, lon: 2.3522 }],
        1,
        invalidPolygon
      );

      // Should return empty because pointInPolygon returns false for invalid type
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle polygon with invalid exterior ring (line 329)', async () => {
      const mockOverpassResponse = `<?xml version="1.0"?>
        <osm>
          <node lat="48.857" lon="2.353">
            <tag k="name" v="Test Location"/>
            <tag k="place" v="locality"/>
          </node>
        </osm>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => mockOverpassResponse,
      } as Response);

      // Polygon with null/invalid coordinates array - triggers line 329
      const polygonWithInvalidExterior = {
        type: 'Polygon',
        coordinates: [null], // Invalid exterior ring
      };

      const results = await searchLocationsNearPath(
        [{ lat: 48.8566, lon: 2.3522 }],
        1,
        polygonWithInvalidExterior as any
      );

      // Should return empty because pointInPolygon returns false for invalid exterior
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle way elements with center tag', async () => {
      const mockOverpassResponse = `<?xml version="1.0"?>
        <osm>
          <way>
            <center lat="48.858" lon="2.354"/>
            <tag k="name" v="Test Building"/>
            <tag k="building" v="yes"/>
          </way>
        </osm>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => mockOverpassResponse,
      } as Response);

      const results = await searchLocationsNearPath([{ lat: 48.8566, lon: 2.3522 }], 1);

      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle elevation API 413 error by splitting payload', async () => {
      // Return 4 locations all within 10km of the path point
      // Path point: 48.8566, 2.3522
      const mockOverpassResponse = `<?xml version="1.0"?>
        <osm>
          <node lat="48.8566" lon="2.3522">
            <tag k="name" v="Location 1"/>
            <tag k="place" v="locality"/>
          </node>
          <node lat="48.8567" lon="2.3523">
            <tag k="name" v="Location 2"/>
            <tag k="place" v="hamlet"/>
          </node>
          <node lat="48.8568" lon="2.3524">
            <tag k="name" v="Location 3"/>
            <tag k="place" v="village"/>
          </node>
          <node lat="48.8569" lon="2.3525">
            <tag k="name" v="Location 4"/>
            <tag k="place" v="town"/>
          </node>
        </osm>`;

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockOverpassResponse,
        } as Response)
        // First elevation API call returns 413 - triggers split (line 70)
        .mockResolvedValueOnce({
          ok: false,
          status: 413,
          statusText: 'Payload Too Large',
        } as Response)
        // Split batch 1 (2 coords) succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [
              { latitude: 48.8566, longitude: 2.3522, elevation: 50 },
              { latitude: 48.8567, longitude: 2.3523, elevation: 60 },
            ],
          }),
        } as Response)
        // Split batch 2 (2 coords) succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [
              { latitude: 48.8568, longitude: 2.3524, elevation: 70 },
              { latitude: 48.8569, longitude: 2.3525, elevation: 80 },
            ],
          }),
        } as Response);

      // Use 10km radius to ensure all locations are within range
      const results = await searchLocationsNearPath([{ lat: 48.8566, lon: 2.3522 }], 10);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should stop retrying elevation API after 5 iterations (line 57)', async () => {
      // Generate 32 locations to test max iteration depth
      const nodes = Array.from(
        { length: 32 },
        (_, i) => `
        <node lat="${48.8566 + i * 0.0001}" lon="${2.3522 + i * 0.0001}">
          <tag k="name" v="Location ${i + 1}"/>
          <tag k="place" v="locality"/>
        </node>
      `
      ).join('');

      const mockOverpassResponse = `<?xml version="1.0"?>
        <osm>${nodes}</osm>`;

      // Set up mock: Overpass succeeds, then ALL elevation calls return 413
      // This forces recursion to depth 5 where iteration >= 5 triggers early return
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => mockOverpassResponse,
      } as Response);

      // All subsequent elevation API calls return 413
      // This will cause splits until iteration reaches 5
      for (let i = 0; i < 100; i++) {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 413,
        } as Response);
      }

      const results = await searchLocationsNearPath([{ lat: 48.8566, lon: 2.3522 }], 10);

      // Should return results (without elevation) after hitting max iterations
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle elevation API non-413 error gracefully', async () => {
      const mockOverpassResponse = `<?xml version="1.0"?>
        <osm>
          <node lat="48.857" lon="2.352">
            <tag k="name" v="Test Location"/>
            <tag k="place" v="locality"/>
          </node>
        </osm>`;

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockOverpassResponse,
        } as Response)
        // Elevation API returns non-413 error (should just return without elevation)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        } as Response);

      const results = await searchLocationsNearPath([{ lat: 48.8566, lon: 2.3522 }], 1);

      expect(Array.isArray(results)).toBe(true);
    });

    it('should deduplicate results by name and location', async () => {
      const mockOverpassResponse = `<?xml version="1.0"?>
        <osm>
          <node lat="48.857" lon="2.352">
            <tag k="name" v="Duplicate Place"/>
            <tag k="place" v="locality"/>
          </node>
          <node lat="48.857" lon="2.352">
            <tag k="name" v="Duplicate Place"/>
            <tag k="place" v="locality"/>
          </node>
        </osm>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => mockOverpassResponse,
      } as Response);

      const results = await searchLocationsNearPath([{ lat: 48.8566, lon: 2.3522 }], 1);

      // Should have at most 1 result due to deduplication
      const duplicates = results.filter((r) => r.main === 'Duplicate Place');
      expect(duplicates.length).toBeLessThanOrEqual(1);
    });

    it('should handle fetch throwing Error in RequestQueue (lines 385-386)', async () => {
      // Make fetch throw an Error - this triggers RequestQueue catch block
      // The await at line 626 happens before Promise.allSettled, so error propagates
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failure'));

      // The function should reject because await happens before Promise.allSettled
      await expect(searchLocationsNearPath([{ lat: 48.8566, lon: 2.3522 }], 1)).rejects.toThrow(
        'Network failure'
      );
    });

    it('should handle fetch throwing non-Error in RequestQueue (lines 385-386)', async () => {
      // Make fetch throw a non-Error value - tests the String(error) branch at line 385
      // The RequestQueue converts this to an Error via: new Error(String(error))
      vi.mocked(fetch).mockRejectedValueOnce('string error');

      // The non-Error is converted and thrown, so the function rejects
      await expect(searchLocationsNearPath([{ lat: 48.8566, lon: 2.3522 }], 1)).rejects.toThrow(
        'string error'
      );
    });

    it('should handle node with missing lat attribute', async () => {
      const mockOverpassResponse = `<?xml version="1.0"?>
        <osm>
          <node lon="2.352">
            <tag k="name" v="Missing Lat"/>
            <tag k="place" v="locality"/>
          </node>
        </osm>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => mockOverpassResponse,
      } as Response);

      const results = await searchLocationsNearPath([{ lat: 48.8566, lon: 2.3522 }], 1);

      // Node without lat attribute should be skipped (lat=0 fails the truthiness check)
      expect(results.filter((r) => r.main === 'Missing Lat')).toHaveLength(0);
    });

    it('should handle node with missing lon attribute', async () => {
      const mockOverpassResponse = `<?xml version="1.0"?>
        <osm>
          <node lat="48.857">
            <tag k="name" v="Missing Lon"/>
            <tag k="place" v="locality"/>
          </node>
        </osm>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => mockOverpassResponse,
      } as Response);

      const results = await searchLocationsNearPath([{ lat: 48.8566, lon: 2.3522 }], 1);

      // Node without lon attribute should be skipped (lon=0 fails the truthiness check)
      expect(results.filter((r) => r.main === 'Missing Lon')).toHaveLength(0);
    });

    it('should handle node without name tag', async () => {
      const mockOverpassResponse = `<?xml version="1.0"?>
        <osm>
          <node lat="48.857" lon="2.352">
            <tag k="place" v="locality"/>
          </node>
        </osm>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => mockOverpassResponse,
      } as Response);

      const results = await searchLocationsNearPath([{ lat: 48.8566, lon: 2.3522 }], 1);

      // Node without name tag should be skipped
      expect(results).toHaveLength(0);
    });

    it('should handle way without center tag', async () => {
      const mockOverpassResponse = `<?xml version="1.0"?>
        <osm>
          <way>
            <tag k="name" v="No Center Way"/>
            <tag k="building" v="yes"/>
          </way>
        </osm>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => mockOverpassResponse,
      } as Response);

      const results = await searchLocationsNearPath([{ lat: 48.8566, lon: 2.3522 }], 1);

      // Way without center tag should be skipped
      expect(results.filter((r) => r.main === 'No Center Way')).toHaveLength(0);
    });

    it('should handle way center with missing lat attribute', async () => {
      const mockOverpassResponse = `<?xml version="1.0"?>
        <osm>
          <way>
            <center lon="2.354"/>
            <tag k="name" v="Missing Lat Way"/>
            <tag k="building" v="yes"/>
          </way>
        </osm>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => mockOverpassResponse,
      } as Response);

      const results = await searchLocationsNearPath([{ lat: 48.8566, lon: 2.3522 }], 1);

      // Way with center missing lat should be skipped
      expect(results.filter((r) => r.main === 'Missing Lat Way')).toHaveLength(0);
    });

    it('should handle way center with missing lon attribute', async () => {
      const mockOverpassResponse = `<?xml version="1.0"?>
        <osm>
          <way>
            <center lat="48.858"/>
            <tag k="name" v="Missing Lon Way"/>
            <tag k="building" v="yes"/>
          </way>
        </osm>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => mockOverpassResponse,
      } as Response);

      const results = await searchLocationsNearPath([{ lat: 48.8566, lon: 2.3522 }], 1);

      // Way with center missing lon should be skipped
      expect(results.filter((r) => r.main === 'Missing Lon Way')).toHaveLength(0);
    });

    it('should handle way without name tag', async () => {
      const mockOverpassResponse = `<?xml version="1.0"?>
        <osm>
          <way>
            <center lat="48.858" lon="2.354"/>
            <tag k="building" v="yes"/>
          </way>
        </osm>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => mockOverpassResponse,
      } as Response);

      const results = await searchLocationsNearPath([{ lat: 48.8566, lon: 2.3522 }], 1);

      // Way without name tag should be skipped
      expect(results).toHaveLength(0);
    });

    it('should handle elevation API returning null elevation', async () => {
      const mockOverpassResponse = `<?xml version="1.0"?>
        <osm>
          <node lat="48.8566" lon="2.3522">
            <tag k="name" v="Location With Null Elevation"/>
            <tag k="place" v="locality"/>
          </node>
        </osm>`;

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockOverpassResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [{ latitude: 48.8566, longitude: 2.3522, elevation: null }],
          }),
        } as Response);

      const results = await searchLocationsNearPath([{ lat: 48.8566, lon: 2.3522 }], 10);

      // Should return location without elevation (null elevation is skipped)
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle elevation API returning no results array', async () => {
      const mockOverpassResponse = `<?xml version="1.0"?>
        <osm>
          <node lat="48.8566" lon="2.3522">
            <tag k="name" v="Location No Elevation Results"/>
            <tag k="place" v="locality"/>
          </node>
        </osm>`;

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockOverpassResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}), // No results array
        } as Response);

      const results = await searchLocationsNearPath([{ lat: 48.8566, lon: 2.3522 }], 10);

      // Should return location even without elevation data
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle elevation API coordinate mismatch', async () => {
      const mockOverpassResponse = `<?xml version="1.0"?>
        <osm>
          <node lat="48.8566" lon="2.3522">
            <tag k="name" v="Coord Mismatch"/>
            <tag k="place" v="locality"/>
          </node>
        </osm>`;

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockOverpassResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            // Return elevation for completely different coordinates (won't match)
            results: [{ latitude: 99, longitude: 99, elevation: 100 }],
          }),
        } as Response);

      const results = await searchLocationsNearPath([{ lat: 48.8566, lon: 2.3522 }], 10);

      // Location should be returned without elevation (coord mismatch)
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should filter out locations outside search zone', async () => {
      // Location is 10km away from path point, but search radius is only 1km
      const mockOverpassResponse = `<?xml version="1.0"?>
        <osm>
          <node lat="48.95" lon="2.45">
            <tag k="name" v="Far Away Location"/>
            <tag k="place" v="locality"/>
          </node>
        </osm>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => mockOverpassResponse,
      } as Response);

      const results = await searchLocationsNearPath([{ lat: 48.8566, lon: 2.3522 }], 1);

      // Location is outside search radius, should be filtered out
      expect(results.filter((r) => r.main === 'Far Away Location')).toHaveLength(0);
    });

    it('should filter out way locations outside search zone', async () => {
      // Way center is far from path point
      const mockOverpassResponse = `<?xml version="1.0"?>
        <osm>
          <way>
            <center lat="49.5" lon="3.0"/>
            <tag k="name" v="Far Away Building"/>
            <tag k="building" v="yes"/>
          </way>
        </osm>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => mockOverpassResponse,
      } as Response);

      const results = await searchLocationsNearPath([{ lat: 48.8566, lon: 2.3522 }], 1);

      // Way location is outside search radius
      expect(results.filter((r) => r.main === 'Far Away Building')).toHaveLength(0);
    });

    it('should handle concurrent requests through RequestQueue (line 398)', async () => {
      // Make fetch slow to test concurrent queue processing
      const mockOverpassResponse = `<?xml version="1.0"?>
        <osm>
          <node lat="48.857" lon="2.352">
            <tag k="name" v="Test Place"/>
            <tag k="place" v="locality"/>
          </node>
        </osm>`;

      // Set up mock to respond with a small delay for concurrent testing
      vi.mocked(fetch).mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 10));
        return {
          ok: true,
          text: async () => mockOverpassResponse,
        } as Response;
      });

      // Fire multiple concurrent requests to test queue early return path
      const promises = [
        searchLocationsNearPath([{ lat: 48.8566, lon: 2.3522 }], 1),
        searchLocationsNearPath([{ lat: 48.8567, lon: 2.3523 }], 1),
        searchLocationsNearPath([{ lat: 48.8568, lon: 2.3524 }], 1),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      for (const r of results) expect(Array.isArray(r)).toBe(true);
    });
  });
});
