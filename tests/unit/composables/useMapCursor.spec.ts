import type { MapContainer } from '@/composables/useMap';
import { describe, expect, it } from 'vitest';
import { useMapCursor } from '@/composables/useMapCursor';

describe('shared map cursor', () => {
  it.each([true, false])(
    'restores the correct cursor when hover ownership changes (endpoint first: %s)',
    (endpointFirst) => {
      const element = document.createElement('div');
      element.style.cursor = 'grab';
      const container = { map: { value: { getTargetElement: () => element } } } as MapContainer;
      const crossing = useMapCursor(container, 10);
      const endpoint = useMapCursor(container, 20);
      if (endpointFirst) {
        endpoint('pointer');
        crossing('crosshair');
      } else {
        crossing('crosshair');
        endpoint('pointer');
      }
      expect(element.style.cursor).toBe('pointer');
      crossing(null);
      expect(element.style.cursor).toBe('pointer');
      crossing('crosshair');
      endpoint(null);
      expect(element.style.cursor).toBe('crosshair');
      crossing(null);
      expect(element.style.cursor).toBe('grab');
    }
  );
});
