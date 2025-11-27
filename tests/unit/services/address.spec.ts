import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getReverseGeocodeAddress } from '@/services/address';

describe('address service', () => {
  describe('getReverseGeocodeAddress', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return address for valid coordinates', async () => {
      const mockResponse = {
        features: [
          {
            properties: {
              name: '1 Rue de Rivoli',
              postcode: '75001',
              city: 'Paris',
            },
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await getReverseGeocodeAddress(48.8566, 2.3522);

      expect(fetch).toHaveBeenCalledWith(
        'https://data.geopf.fr/geocodage/reverse?lon=2.3522&lat=48.8566&limit=1'
      );
      expect(result.address).toBe('1 Rue de Rivoli, 75001, Paris');
      expect(result.error).toBeUndefined();
    });

    it('should return address with only name', async () => {
      const mockResponse = {
        features: [
          {
            properties: {
              name: 'Tour Eiffel',
            },
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await getReverseGeocodeAddress(48.858, 2.2945);

      expect(result.address).toBe('Tour Eiffel');
    });

    it('should return address with only postcode and city', async () => {
      const mockResponse = {
        features: [
          {
            properties: {
              postcode: '75007',
              city: 'Paris',
            },
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await getReverseGeocodeAddress(48.858, 2.2945);

      expect(result.address).toBe('75007, Paris');
    });

    it('should return null address when no features found', async () => {
      const mockResponse = {
        features: [],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await getReverseGeocodeAddress(48.8566, 2.3522);

      expect(result.address).toBeNull();
    });

    it('should return null address when features is missing', async () => {
      const mockResponse = {};

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await getReverseGeocodeAddress(48.8566, 2.3522);

      expect(result.address).toBeNull();
    });

    it('should return null address when properties have no address parts', async () => {
      const mockResponse = {
        features: [
          {
            properties: {
              id: '12345',
              type: 'address',
            },
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await getReverseGeocodeAddress(48.8566, 2.3522);

      expect(result.address).toBeNull();
    });

    it('should return error when API returns non-ok status', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await getReverseGeocodeAddress(48.8566, 2.3522);

      expect(result.address).toBeNull();
      expect(result.error).toBe('API returned status 404');
    });

    it('should return error when fetch throws Error', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await getReverseGeocodeAddress(48.8566, 2.3522);

      expect(result.address).toBeNull();
      expect(result.error).toBe('Network error');
    });

    it('should return error with "Unknown error" for non-Error throws', async () => {
      vi.mocked(fetch).mockRejectedValueOnce('String error');

      const result = await getReverseGeocodeAddress(48.8566, 2.3522);

      expect(result.address).toBeNull();
      expect(result.error).toBe('Unknown error');
    });
  });
});
