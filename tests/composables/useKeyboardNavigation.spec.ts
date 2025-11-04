import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useKeyboardNavigation } from '@/composables/useKeyboardNavigation';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

// Mock useNavigation
const mockNavigation = {
  navigateCircleForward: vi.fn(),
  navigateCircleBackward: vi.fn(),
  navigateSegmentForward: vi.fn(),
  navigateSegmentBackward: vi.fn(),
  getCircleNavigationCoords: vi.fn(() => ({ lat: 48.8566, lon: 2.3522 })),
  getSegmentNavigationCoords: vi.fn(() => ({ lat: 48.8566, lon: 2.3522 })),
};

vi.mock('@/composables/useNavigation', () => ({
  useNavigation: () => mockNavigation,
}));

describe('useKeyboardNavigation', () => {
  let pinia: any;
  let uiStore: any;
  let layersStore: any;
  let mockMapContainer: any;
  let onFreeHandEscape: any;
  let keyboardNav: any;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    uiStore = useUIStore();
    layersStore = useLayersStore();

    // Create a mock map container
    mockMapContainer = {
      map: ref({
        getView: vi.fn(() => ({
          getZoom: vi.fn(() => 15),
        })),
      }),
      flyTo: vi.fn(),
    };

    // Mock callback
    onFreeHandEscape = vi.fn();

    // Clear all mocks
    vi.clearAllMocks();

    // Initialize keyboard navigation
    keyboardNav = useKeyboardNavigation(mockMapContainer, onFreeHandEscape);
  });

  afterEach(() => {
    keyboardNav.cleanup();
  });

  describe('Setup and Cleanup', () => {
    it('should add event listener on setup', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      keyboardNav.setup();

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', keyboardNav.handleKeydown);
    });

    it('should remove event listener on cleanup', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      keyboardNav.cleanup();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', keyboardNav.handleKeydown);
    });
  });

  describe('View Capture Mode', () => {
    it('should stop view capture on Escape', () => {
      const stopViewCaptureSpy = vi.spyOn(uiStore, 'stopViewCapture');
      const openModalSpy = vi.spyOn(uiStore, 'openModal');

      uiStore.viewCaptureState.isCapturing = true;

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      keyboardNav.handleKeydown(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopViewCaptureSpy).toHaveBeenCalled();
      expect(openModalSpy).toHaveBeenCalledWith('animationModal');
    });

    it('should ignore other keys during view capture', () => {
      uiStore.viewCaptureState.isCapturing = true;

      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      keyboardNav.handleKeydown(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
  });

  describe('Free Hand Drawing Mode', () => {
    it('should call onFreeHandEscape callback on Escape', () => {
      uiStore.freeHandDrawing.isDrawing = true;

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      keyboardNav.handleKeydown(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(onFreeHandEscape).toHaveBeenCalled();
    });

    it('should not call callback if not drawing', () => {
      uiStore.freeHandDrawing.isDrawing = false;

      const event = new KeyboardEvent('keydown', { key: 'Escape' });

      keyboardNav.handleKeydown(event);

      expect(onFreeHandEscape).not.toHaveBeenCalled();
    });
  });

  describe('Circle Navigation', () => {
    beforeEach(() => {
      // Add a test circle
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Test Circle',
        center: { lat: 48.8566, lon: 2.3522 },
        radius: 10,
        color: '#ff0000',
        visible: true,
      });

      // Set navigating element
      uiStore.navigatingElement = {
        type: 'circle',
        id: 'circle-1',
      };
    });

    it('should navigate circle forward on ArrowRight', () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      keyboardNav.handleKeydown(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(mockNavigation.navigateCircleForward).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'circle-1' }),
        15
      );
      expect(mockNavigation.getCircleNavigationCoords).toHaveBeenCalled();
      expect(mockMapContainer.flyTo).toHaveBeenCalledWith(48.8566, 2.3522, 15, { duration: 500 });
    });

    it('should navigate circle backward on ArrowLeft', () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      keyboardNav.handleKeydown(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(mockNavigation.navigateCircleBackward).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'circle-1' }),
        15
      );
      expect(mockNavigation.getCircleNavigationCoords).toHaveBeenCalled();
      expect(mockMapContainer.flyTo).toHaveBeenCalled();
    });
  });

  describe('Line Segment Navigation', () => {
    beforeEach(() => {
      // Add a test line segment
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 49.8566, lon: 3.3522 },
        color: '#0000ff',
        mode: 'coordinate',
        visible: true,
      });

      // Set navigating element
      uiStore.navigatingElement = {
        type: 'lineSegment',
        id: 'line-1',
      };
    });

    it('should navigate segment forward on ArrowRight', () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      keyboardNav.handleKeydown(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(mockNavigation.navigateSegmentForward).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'line-1' }),
        15
      );
      expect(mockNavigation.getSegmentNavigationCoords).toHaveBeenCalled();
      expect(mockMapContainer.flyTo).toHaveBeenCalled();
    });

    it('should navigate segment backward on ArrowLeft', () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      keyboardNav.handleKeydown(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(mockNavigation.navigateSegmentBackward).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'line-1' }),
        15
      );
      expect(mockNavigation.getSegmentNavigationCoords).toHaveBeenCalled();
      expect(mockMapContainer.flyTo).toHaveBeenCalled();
    });
  });

  describe('Navigation Exit', () => {
    it('should stop navigating on Escape', () => {
      const stopNavigatingSpy = vi.spyOn(uiStore, 'stopNavigating');

      // Set navigating element
      uiStore.navigatingElement = {
        type: 'circle',
        id: 'circle-1',
      };

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      keyboardNav.handleKeydown(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopNavigatingSpy).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should do nothing when not navigating', () => {
      uiStore.navigatingElement = null;

      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      keyboardNav.handleKeydown(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
      expect(mockNavigation.navigateCircleForward).not.toHaveBeenCalled();
    });

    it('should handle missing map container', () => {
      mockMapContainer.map = ref(null);

      uiStore.navigatingElement = {
        type: 'circle',
        id: 'circle-1',
      };

      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });

      // Should not throw
      expect(() => keyboardNav.handleKeydown(event)).not.toThrow();
    });

    it('should handle missing element in store', () => {
      // Set navigating element to non-existent ID
      uiStore.navigatingElement = {
        type: 'circle',
        id: 'non-existent',
      };

      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });

      keyboardNav.handleKeydown(event);

      expect(mockNavigation.navigateCircleForward).not.toHaveBeenCalled();
    });

    it('should ignore unrelated keys', () => {
      uiStore.navigatingElement = {
        type: 'circle',
        id: 'circle-1',
      };

      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      keyboardNav.handleKeydown(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
      expect(mockNavigation.navigateCircleForward).not.toHaveBeenCalled();
    });
  });
});
