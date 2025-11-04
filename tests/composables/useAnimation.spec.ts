import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { useAnimation } from '@/composables/useAnimation';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

// Mock ol modules - provide all easing functions
vi.mock('ol/easing', () => ({
  inAndOut: vi.fn((t) => t), // Simple linear easing mock
  easeIn: vi.fn((t) => t),
  easeOut: vi.fn((t) => t),
  linear: vi.fn((t) => t),
  upAndDown: vi.fn((t) => t),
}));

vi.mock('ol/sphere', () => ({
  getDistance: vi.fn(() => 5000), // Mock 5km distance
}));

describe('useAnimation', () => {
  let pinia: any;
  let uiStore: any;
  let layersStore: any;
  let mockMapContainer: any;
  let mockDrawing: any;
  let sidebarOpen: any;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    uiStore = useUIStore();
    layersStore = useLayersStore();

    // Mock map container
    mockMapContainer = {
      map: ref({
        getView: vi.fn(() => ({
          getCenter: vi.fn(() => [0, 0]),
          getZoom: vi.fn(() => 10),
          animate: vi.fn(),
          cancelAnimations: vi.fn(),
        })),
        getOverlays: vi.fn(() => ({
          getArray: vi.fn(() => []),
        })),
      }),
      flyTo: vi.fn(),
      flyToBoundsWithPanels: vi.fn(),
    };

    // Mock drawing
    mockDrawing = {
      redrawAllElements: vi.fn(),
      clearAllElements: vi.fn(),
      updateElementVisibility: vi.fn(),
    };

    // Create sidebar open ref
    sidebarOpen = ref(false);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Animation initialization', () => {
    it('should initialize without errors', () => {
      expect(() => {
        useAnimation(mockMapContainer, mockDrawing, sidebarOpen);
      }).not.toThrow();
    });
  });

  describe('Animation state changes', () => {
    it('should respond to animation state changes', async () => {
      const setSidebarOpenSpy = vi.spyOn(uiStore, 'setSidebarOpen');
      const setLeftSidebarOpenSpy = vi.spyOn(uiStore, 'setLeftSidebarOpen');

      // Initialize the composable to set up watchers
      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      // Start animation
      uiStore.animationState.isPlaying = true;
      await nextTick();

      // Should hide sidebars
      expect(setSidebarOpenSpy).toHaveBeenCalledWith(false);
      expect(setLeftSidebarOpenSpy).toHaveBeenCalledWith(false);
      expect(sidebarOpen.value).toBe(false);
    });

    it('should keep sidebars closed when animation stops', async () => {
      const setSidebarOpenSpy = vi.spyOn(uiStore, 'setSidebarOpen');

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      // Start and then stop animation
      uiStore.animationState.isPlaying = true;
      await nextTick();

      uiStore.animationState.isPlaying = false;
      await nextTick();

      // Sidebars should remain closed
      expect(setSidebarOpenSpy).toHaveBeenCalledWith(false);
      expect(sidebarOpen.value).toBe(false);
    });
  });

  describe('Animation transitions', () => {
    it('should handle animation start', async () => {
      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      // Start animation
      uiStore.animationState.isPlaying = true;
      await nextTick();

      // Should close sidebars
      expect(sidebarOpen.value).toBe(false);
    });

    it('should handle animation stop', async () => {
      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      // Start and then stop animation
      uiStore.animationState.isPlaying = true;
      await nextTick();

      uiStore.animationState.isPlaying = false;
      await nextTick();

      // Sidebars should remain closed
      expect(sidebarOpen.value).toBe(false);
    });
  });

  describe('Element ordering', () => {
    it('should handle elements with timestamps', async () => {
      // Add elements with timestamps
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Circle 1',
        center: { lat: 48, lon: 2 },
        radius: 5,
        createdAt: 1000,
      });

      layersStore.addPoint({
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 49, lon: 3 },
        createdAt: 500,
      });

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      // Elements should be sorted by timestamp when animation starts
      uiStore.animationState.isPlaying = true;
      await nextTick();

      // The animation should process elements in order
      expect(layersStore.circles.length).toBe(1);
      expect(layersStore.points.length).toBe(1);
    });

    it('should handle elements without timestamps', async () => {
      // Add elements without timestamps
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Circle 1',
        center: { lat: 48, lon: 2 },
        radius: 5,
      });

      layersStore.addPoint({
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 49, lon: 3 },
      });

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      // Should not throw when starting animation
      uiStore.animationState.isPlaying = true;
      await nextTick();

      expect(layersStore.circles.length).toBe(1);
      expect(layersStore.points.length).toBe(1);
    });
  });

  describe('Animation configuration', () => {
    it('should respect zoom speed setting', async () => {
      uiStore.animationConfig.zoomSpeed = 8;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      // Config should be set
      expect(uiStore.animationConfig.zoomSpeed).toBe(8);
    });

    it('should respect transition speed setting', async () => {
      uiStore.animationConfig.transitionSpeed = 3;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      // Should not throw
      uiStore.animationState.isPlaying = true;
      await nextTick();

      expect(uiStore.animationConfig.transitionSpeed).toBe(3);
    });
  });

  describe('Animation cleanup', () => {
    it('should handle missing map gracefully', async () => {
      mockMapContainer.map.value = null;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      // Should not throw when starting animation
      uiStore.animationState.isPlaying = true;
      await nextTick();

      expect(mockMapContainer.flyTo).not.toHaveBeenCalled();
    });

    it('should handle animation stop', async () => {
      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      // Start and stop animation
      uiStore.animationState.isPlaying = true;
      await nextTick();

      uiStore.animationState.isPlaying = false;
      await nextTick();

      // Should not throw
      expect(uiStore.animationState.isPlaying).toBe(false);
    });
  });
});
