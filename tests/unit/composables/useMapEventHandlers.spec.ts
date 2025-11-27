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

    it('should format coordinates and open modal on right-click', () => {
      const setCoordinatesFormDataSpy = vi.spyOn(uiStore, 'setCoordinatesFormData');
      const openModalSpy = vi.spyOn(uiStore, 'openModal');

      // Simulate right-click with coordinates
      mockRightClickHandler(48.856_613, 2.352_222);

      // Should format coordinates to 6 decimal places
      expect(setCoordinatesFormDataSpy).toHaveBeenCalledWith({
        name: '',
        coordinates: '48.856613, 2.352222',
      });

      expect(openModalSpy).toHaveBeenCalledWith('coordinatesModal');
    });

    it('should handle different coordinate precisions', () => {
      const setCoordinatesFormDataSpy = vi.spyOn(uiStore, 'setCoordinatesFormData');

      // Test with many decimal places
      mockRightClickHandler(48.123_456_789, 2.987_654_321);

      expect(setCoordinatesFormDataSpy).toHaveBeenCalledWith({
        name: '',
        coordinates: '48.123457, 2.987654',
      });
    });

    it('should handle negative coordinates', () => {
      const setCoordinatesFormDataSpy = vi.spyOn(uiStore, 'setCoordinatesFormData');

      // Test with negative coordinates
      mockRightClickHandler(-33.868_82, 151.209_29);

      expect(setCoordinatesFormDataSpy).toHaveBeenCalledWith({
        name: '',
        coordinates: '-33.868820, 151.209290',
      });
    });

    it('should handle zero coordinates', () => {
      const setCoordinatesFormDataSpy = vi.spyOn(uiStore, 'setCoordinatesFormData');

      // Test with zero coordinates (Null Island)
      mockRightClickHandler(0, 0);

      expect(setCoordinatesFormDataSpy).toHaveBeenCalledWith({
        name: '',
        coordinates: '0.000000, 0.000000',
      });
    });

    it('should round coordinates to 6 decimal places', () => {
      const setCoordinatesFormDataSpy = vi.spyOn(uiStore, 'setCoordinatesFormData');

      // Test rounding
      mockRightClickHandler(48.856_613_999_999_9, 2.352_222_999_999_9);

      expect(setCoordinatesFormDataSpy).toHaveBeenCalledWith({
        name: '',
        coordinates: '48.856614, 2.352223',
      });
    });

    it('should handle very large coordinates', () => {
      const setCoordinatesFormDataSpy = vi.spyOn(uiStore, 'setCoordinatesFormData');

      // Test with maximum valid latitude/longitude
      mockRightClickHandler(89.999_999, 179.999_999);

      expect(setCoordinatesFormDataSpy).toHaveBeenCalledWith({
        name: '',
        coordinates: '89.999999, 179.999999',
      });
    });

    it('should handle very small negative coordinates', () => {
      const setCoordinatesFormDataSpy = vi.spyOn(uiStore, 'setCoordinatesFormData');

      // Test with minimum valid latitude/longitude
      mockRightClickHandler(-89.999_999, -179.999_999);

      expect(setCoordinatesFormDataSpy).toHaveBeenCalledWith({
        name: '',
        coordinates: '-89.999999, -179.999999',
      });
    });

    it('should always set empty name in form data', () => {
      const setCoordinatesFormDataSpy = vi.spyOn(uiStore, 'setCoordinatesFormData');

      // Multiple calls should always have empty name
      mockRightClickHandler(10, 20);
      expect(setCoordinatesFormDataSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ name: '' })
      );

      mockRightClickHandler(30, 40);
      expect(setCoordinatesFormDataSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ name: '' })
      );
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
