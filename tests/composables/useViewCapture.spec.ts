import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { useViewCapture } from '@/composables/useViewCapture';
import { useUIStore } from '@/stores/ui';

describe('useViewCapture', () => {
  let pinia: any;
  let uiStore: any;
  let mockMapContainer: any;
  let viewCapture: any;
  let mockMapClickHandler: any;
  let mockUnsubscribeClick: any;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    uiStore = useUIStore();

    // Reset view capture state
    uiStore.viewCaptureState.isCapturing = false;
    uiStore.viewCaptureState.captureType = 'start';

    // Reset timers
    vi.useFakeTimers();

    // Create mock functions
    mockUnsubscribeClick = vi.fn();
    mockMapClickHandler = vi.fn();

    // Create mock map container
    mockMapContainer = {
      map: ref({
        updateSize: vi.fn(),
      }),
      onMapClick: vi.fn((handler) => {
        mockMapClickHandler = handler;
        return mockUnsubscribeClick;
      }),
      getCenter: vi.fn(() => ({ lat: 48.8566, lon: 2.3522 })),
      getZoom: vi.fn(() => 15),
      captureScreenshot: vi.fn(() => Promise.resolve('data:image/png;base64,mockscreenshot')),
    };

    // Initialize view capture
    viewCapture = useViewCapture(mockMapContainer);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('Setup', () => {
    it('should register map click handler on setup', () => {
      viewCapture.setup();

      expect(mockMapContainer.onMapClick).toHaveBeenCalled();
    });

    it('should return cleanup function', () => {
      const cleanup = viewCapture.setup();

      expect(cleanup).toBeInstanceOf(Function);
    });

    it('should unsubscribe on cleanup', () => {
      const cleanup = viewCapture.setup();

      cleanup();

      expect(mockUnsubscribeClick).toHaveBeenCalled();
    });
  });

  describe('View Capture Mode', () => {
    it('should not update map size when not capturing', async () => {
      viewCapture.setup();

      // Change capturing to false
      uiStore.viewCaptureState.isCapturing = false;
      await nextTick();

      vi.advanceTimersByTime(100);

      expect(mockMapContainer.map.value.updateSize).not.toHaveBeenCalled();
    });

    it('should handle missing map gracefully', async () => {
      mockMapContainer.map = ref(null);
      viewCapture.setup();

      // Enter capture mode
      uiStore.viewCaptureState.isCapturing = true;
      await nextTick();

      vi.advanceTimersByTime(100);

      // Should not throw
      expect(() => vi.advanceTimersByTime(0)).not.toThrow();
    });
  });

  describe('Map Click Handling', () => {
    beforeEach(() => {
      viewCapture.setup();
    });

    it('should ignore clicks when not in capture mode', async () => {
      const captureViewSpy = vi.spyOn(uiStore, 'captureView');

      // Not in capture mode
      uiStore.viewCaptureState.isCapturing = false;

      // Simulate map click
      await mockMapClickHandler();

      expect(captureViewSpy).not.toHaveBeenCalled();
    });

    it('should handle end view capture', async () => {
      const addToastSpy = vi.spyOn(uiStore, 'addToast');

      // Enter capture mode for end view
      uiStore.viewCaptureState.isCapturing = true;
      uiStore.viewCaptureState.captureType = 'end';

      // Simulate map click
      await mockMapClickHandler();

      expect(addToastSpy).toHaveBeenCalledWith('End view captured successfully!', 'success');
    });

    it('should handle missing center', async () => {
      const addToastSpy = vi.spyOn(uiStore, 'addToast');
      const captureViewSpy = vi.spyOn(uiStore, 'captureView');

      mockMapContainer.getCenter = vi.fn(() => null);

      // Enter capture mode
      uiStore.viewCaptureState.isCapturing = true;

      // Simulate map click
      await mockMapClickHandler();

      expect(addToastSpy).toHaveBeenCalledWith('Failed to capture view center', 'error');
      expect(captureViewSpy).not.toHaveBeenCalled();
    });

    it('should continue without screenshot on error', async () => {
      const captureViewSpy = vi.spyOn(uiStore, 'captureView');

      // Make screenshot capture fail
      mockMapContainer.captureScreenshot = vi.fn(() =>
        Promise.reject(new Error('Screenshot failed'))
      );

      // Enter capture mode
      uiStore.viewCaptureState.isCapturing = true;

      // Simulate map click
      await mockMapClickHandler();

      // Should still capture view without screenshot (gracefully handling error)
      expect(captureViewSpy).toHaveBeenCalledWith({
        lat: 48.8566,
        lon: 2.3522,
        zoom: 15,
        screenshot: undefined,
      });
    });
  });

  describe('Screenshot Capture', () => {
    it('should include screenshot when successful', async () => {
      viewCapture.setup();
      const captureViewSpy = vi.spyOn(uiStore, 'captureView');

      uiStore.viewCaptureState.isCapturing = true;
      await mockMapClickHandler();

      expect(mockMapContainer.captureScreenshot).toHaveBeenCalled();
      expect(captureViewSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          screenshot: 'data:image/png;base64,mockscreenshot',
        })
      );
    });

    it('should handle different screenshot formats', async () => {
      viewCapture.setup();
      const captureViewSpy = vi.spyOn(uiStore, 'captureView');

      // Return different format
      mockMapContainer.captureScreenshot = vi.fn(() =>
        Promise.resolve('data:image/jpeg;base64,differentscreenshot')
      );

      uiStore.viewCaptureState.isCapturing = true;
      await mockMapClickHandler();

      expect(captureViewSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          screenshot: 'data:image/jpeg;base64,differentscreenshot',
        })
      );
    });
  });
});
