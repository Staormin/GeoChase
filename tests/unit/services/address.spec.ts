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
        'https://data.geopf.fr/geocodage/reverse?lon=2.3522&lat=48.8566&limit=1',
        { signal: expect.any(AbortSignal) }
      );
      expect(result.address).toBe('1 Rue de Rivoli, 75001, Paris');
      expect(result.city).toBe('Paris');
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
      expect(result.city).toBeUndefined();
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
      expect(result.city).toBe('Paris');
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

    it.each([
      null,
      { features: [null] },
      { features: [{}] },
      {
        features: [{ properties: { name: {}, city: 123, postcode: [] } }],
      },
    ])('ignores malformed geocoding responses: %j', async (data) => {
      vi.mocked(fetch).mockResolvedValueOnce(Response.json(data));
      expect(await getReverseGeocodeAddress(48.8584, 2.2945)).toEqual({ address: null });
    });

    it('cancels the request when the caller aborts', async () => {
      const controller = new AbortController();
      vi.mocked(fetch).mockImplementationOnce(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () => reject(options.signal?.reason));
          })
      );
      const result = getReverseGeocodeAddress(48.8584, 2.2945, controller.signal);
      controller.abort();
      expect((await result).address).toBeNull();
      expect(vi.mocked(fetch).mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    });

    it('bounds the lookup so an unresponsive service cannot block point creation', async () => {
      const timeout = new AbortController();
      const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal);
      try {
        vi.mocked(fetch).mockImplementationOnce(
          (_url, options) =>
            new Promise((_resolve, reject) => {
              options?.signal?.addEventListener('abort', () => reject(options.signal?.reason));
            })
        );
        const result = getReverseGeocodeAddress(48.8584, 2.2945);
        expect(timeoutSpy).toHaveBeenCalledWith(5000);
        timeout.abort(new DOMException('Request timed out', 'TimeoutError'));
        expect((await result).address).toBeNull();
      } finally {
        timeoutSpy.mockRestore();
      }
    });
  });
});
