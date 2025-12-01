import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMapEventHandlers } from '@/composables/useMapEventHandlers';
import { useUIStore } from '@/stores/ui';

describe('useMapEventHandlers', () => {
  let pinia: any;
  let uiStore: any;
  let mockMapContainer: any;
  let mapEventHandlers: any;
  let mockRightClickHandler: any;
  let mockUnsubscribe: any;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    uiStore = useUIStore();

    // Create mock unsubscribe function
    mockUnsubscribe = vi.fn();

    // Create mock map container
    mockMapContainer = {
      onMapRightClick: vi.fn((handler) => {
        mockRightClickHandler = handler;
        return mockUnsubscribe;
      }),
    };

    // Initialize map event handlers
    mapEventHandlers = useMapEventHandlers(mockMapContainer);
  });

  describe('Setup', () => {
    it('should register right-click handler on setup', () => {
      mapEventHandlers.setup();

      expect(mockMapContainer.onMapRightClick).toHaveBeenCalled();
      expect(mockMapContainer.onMapRightClick).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should return unsubscribe function', () => {
      const unsubscribe = mapEventHandlers.setup();

      expect(unsubscribe).toBe(mockUnsubscribe);
    });
  });

  describe('Right-Click Handler', () => {
    beforeEach(() => {
      mapEventHandlers.setup();
    });

    it('should start creating point and open modal on right-click', () => {
      const startCreatingSpy = vi.spyOn(uiStore, 'startCreating');
      const openModalSpy = vi.spyOn(uiStore, 'openModal');

      // Simulate right-click with coordinates
      mockRightClickHandler(48.856_613, 2.352_222);

      // Should start creating a point with prefill
      expect(startCreatingSpy).toHaveBeenCalledWith('point', {
        lat: 48.856_613,
        lon: 2.352_222,
      });

      expect(openModalSpy).toHaveBeenCalledWith('pointModal');
    });

    it('should handle negative coordinates', () => {
      const startCreatingSpy = vi.spyOn(uiStore, 'startCreating');

      // Test with negative coordinates
      mockRightClickHandler(-33.868_82, 151.209_29);

      expect(startCreatingSpy).toHaveBeenCalledWith('point', {
        lat: -33.868_82,
        lon: 151.209_29,
      });
    });

    it('should handle zero coordinates', () => {
      const startCreatingSpy = vi.spyOn(uiStore, 'startCreating');

      // Test with zero coordinates (Null Island)
      mockRightClickHandler(0, 0);

      expect(startCreatingSpy).toHaveBeenCalledWith('point', {
        lat: 0,
        lon: 0,
      });
    });

    it('should handle very large coordinates', () => {
      const startCreatingSpy = vi.spyOn(uiStore, 'startCreating');

      // Test with maximum valid latitude/longitude
      mockRightClickHandler(89.999_999, 179.999_999);

      expect(startCreatingSpy).toHaveBeenCalledWith('point', {
        lat: 89.999_999,
        lon: 179.999_999,
      });
    });

    it('should handle very small negative coordinates', () => {
      const startCreatingSpy = vi.spyOn(uiStore, 'startCreating');

      // Test with minimum valid latitude/longitude
      mockRightClickHandler(-89.999_999, -179.999_999);

      expect(startCreatingSpy).toHaveBeenCalledWith('point', {
        lat: -89.999_999,
        lon: -179.999_999,
      });
    });

    it('should always open point modal', () => {
      const openModalSpy = vi.spyOn(uiStore, 'openModal');

      // Multiple calls should always open pointModal
      mockRightClickHandler(10, 20);
      expect(openModalSpy).toHaveBeenLastCalledWith('pointModal');

      mockRightClickHandler(30, 40);
      expect(openModalSpy).toHaveBeenLastCalledWith('pointModal');
    });
  });

  describe('Cleanup', () => {
    it('should allow unsubscribing from events', () => {
      const unsubscribe = mapEventHandlers.setup();

      // Call unsubscribe
      unsubscribe();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });
});
