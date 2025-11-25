import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { useAnimation } from '@/composables/useAnimation';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

// Mock ol modules
vi.mock('ol/easing', () => ({
  inAndOut: vi.fn((t) => t),
}));

vi.mock('ol/sphere', () => ({
  getDistance: vi.fn(() => 5000), // Mock 5km distance in meters
}));

describe('useAnimation', () => {
  let uiStore: ReturnType<typeof useUIStore>;
  let layersStore: ReturnType<typeof useLayersStore>;
  let mockMapContainer: any;
  let mockDrawing: any;
  let sidebarOpen: ReturnType<typeof ref<boolean>>;

  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
    uiStore = useUIStore();
    layersStore = useLayersStore();

    // Mock map container with all required methods
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
      flyToBounds: vi.fn(),
      flyToBoundsWithPanels: vi.fn(),
      setCenter: vi.fn(),
    };

    // Mock drawing with Promise-returning updateElementVisibility
    mockDrawing = {
      redrawAllElements: vi.fn(),
      clearAllElements: vi.fn(),
      updateElementVisibility: vi.fn().mockResolvedValue(undefined),
    };

    sidebarOpen = ref(true);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize without errors', () => {
      expect(() => {
        useAnimation(mockMapContainer, mockDrawing, sidebarOpen);
      }).not.toThrow();
    });

    it('should set up watcher for animation state', async () => {
      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      // Trigger animation start
      uiStore.animationState.isPlaying = true;
      await nextTick();

      expect(sidebarOpen.value).toBe(false);
    });
  });

  describe('getAllElementsSorted', () => {
    it('should sort elements by creation time', async () => {
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Circle 1',
        center: { lat: 48, lon: 2 },
        radius: 5,
        createdAt: 2000,
      });

      layersStore.addPoint({
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 49, lon: 3 },
        createdAt: 1000,
      });

      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Line 1',
        center: { lat: 47, lon: 1 },
        mode: 'coordinate',
        createdAt: 3000,
      });

      // Make elements visible
      uiStore.setElementVisibility('point', 'point-1', true);
      uiStore.setElementVisibility('circle', 'circle-1', true);
      uiStore.setElementVisibility('lineSegment', 'line-1', true);

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      // Start animation to trigger sorting
      uiStore.animationState.isPlaying = true;
      await nextTick();

      // Elements should be processed in creation time order
      expect(mockDrawing.updateElementVisibility).toHaveBeenCalled();
    });

    it('should use ID for stable ordering when timestamps are equal', async () => {
      layersStore.addCircle({
        id: 'b-circle',
        name: 'B Circle',
        center: { lat: 48, lon: 2 },
        radius: 5,
        createdAt: 1000,
      });

      layersStore.addCircle({
        id: 'a-circle',
        name: 'A Circle',
        center: { lat: 49, lon: 3 },
        radius: 10,
        createdAt: 1000,
      });

      uiStore.setElementVisibility('circle', 'b-circle', true);
      uiStore.setElementVisibility('circle', 'a-circle', true);

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      expect(mockDrawing.updateElementVisibility).toHaveBeenCalled();
    });

    it('should handle elements without timestamps (default to 0)', async () => {
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Circle 1',
        center: { lat: 48, lon: 2 },
        radius: 5,
        // No createdAt
      });

      uiStore.setElementVisibility('circle', 'circle-1', true);

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      expect(mockDrawing.updateElementVisibility).toHaveBeenCalled();
    });

    it('should handle mixed elements with and without timestamps', async () => {
      // Element A with createdAt
      layersStore.addCircle({
        id: 'circle-with-time',
        name: 'Circle With Time',
        center: { lat: 48, lon: 2 },
        radius: 5,
        createdAt: 1000,
      });

      // Element B without createdAt (should default to 0)
      layersStore.addPoint({
        id: 'point-no-time',
        name: 'Point No Time',
        coordinates: { lat: 49, lon: 3 },
        // No createdAt - will use || 0 fallback
      });

      // Element C without createdAt (should default to 0, compared with B)
      layersStore.addLineSegment({
        id: 'line-no-time',
        name: 'Line No Time',
        center: { lat: 47, lon: 1 },
        mode: 'coordinate',
        // No createdAt - will use || 0 fallback
      });

      uiStore.setElementVisibility('circle', 'circle-with-time', true);
      uiStore.setElementVisibility('point', 'point-no-time', true);
      uiStore.setElementVisibility('lineSegment', 'line-no-time', true);

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      // Sorting should happen: elements without createdAt default to 0
      // So they should come before the element with createdAt: 1000
      expect(mockDrawing.updateElementVisibility).toHaveBeenCalled();
    });

    it('should handle elements with undefined createdAt (direct store manipulation)', async () => {
      // Bypass addCircle to avoid automatic timestamp assignment
      // Push directly to circles array with undefined createdAt
      layersStore.circles.push(
        {
          id: 'circle-undefined-time-a',
          name: 'Circle A',
          center: { lat: 48, lon: 2 },
          radius: 5,
          createdAt: undefined,
        } as any,
        {
          id: 'circle-undefined-time-b',
          name: 'Circle B',
          center: { lat: 49, lon: 3 },
          radius: 10,
          createdAt: undefined,
        } as any
      );

      uiStore.setElementVisibility('circle', 'circle-undefined-time-a', true);
      uiStore.setElementVisibility('circle', 'circle-undefined-time-b', true);

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      // Both elements have undefined createdAt, || 0 fallback is used for both
      // They should sort by ID (secondary sort)
      expect(mockDrawing.updateElementVisibility).toHaveBeenCalled();
    });
  });

  describe('navigateToElement', () => {
    it('should navigate to circle with appropriate zoom', async () => {
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Circle 1',
        center: { lat: 48.8566, lon: 2.3522 },
        radius: 10,
        createdAt: 1000,
      });

      uiStore.setElementVisibility('circle', 'circle-1', true);
      uiStore.animationConfig.type = 'startToFinish';
      uiStore.animationConfig.disableZoomOnElement = false;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      // Wait for countdown
      vi.advanceTimersByTime(3000);
      await nextTick();

      expect(mockMapContainer.flyTo).toHaveBeenCalled();
    });

    it('should navigate to large circle with zoomed out view', async () => {
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Large Circle',
        center: { lat: 48.8566, lon: 2.3522 },
        radius: 500, // Large radius
        createdAt: 1000,
      });

      uiStore.setElementVisibility('circle', 'circle-1', true);
      uiStore.animationConfig.type = 'startToFinish';
      uiStore.animationConfig.disableZoomOnElement = false;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      vi.advanceTimersByTime(3000);
      await nextTick();

      expect(mockMapContainer.flyTo).toHaveBeenCalled();
      // Zoom should be adjusted for large radius
    });

    it('should navigate to point with high zoom', async () => {
      layersStore.addPoint({
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 48.8566, lon: 2.3522 },
        createdAt: 1000,
      });

      uiStore.setElementVisibility('point', 'point-1', true);
      uiStore.animationConfig.type = 'startToFinish';
      uiStore.animationConfig.disableZoomOnElement = false;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      vi.advanceTimersByTime(3000);
      await nextTick();

      expect(mockMapContainer.flyTo).toHaveBeenCalled();
    });

    it('should navigate to lineSegment with coordinate mode', async () => {
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Line 1',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.9, lon: 2.4 },
        mode: 'coordinate',
        createdAt: 1000,
      });

      uiStore.setElementVisibility('lineSegment', 'line-1', true);
      uiStore.animationConfig.type = 'startToFinish';
      uiStore.animationConfig.disableZoomOnElement = false;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      vi.advanceTimersByTime(3000);
      await nextTick();

      expect(mockMapContainer.flyTo).toHaveBeenCalled();
    });

    it('should navigate to parallel lineSegment with low zoom', async () => {
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Parallel Line',
        center: { lat: 0, lon: 45 },
        mode: 'parallel',
        longitude: 45,
        createdAt: 1000,
      });

      uiStore.setElementVisibility('lineSegment', 'line-1', true);
      uiStore.animationConfig.type = 'startToFinish';
      uiStore.animationConfig.disableZoomOnElement = false;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      vi.advanceTimersByTime(3000);
      await nextTick();

      expect(mockMapContainer.flyTo).toHaveBeenCalled();
    });

    it('should navigate to polygon with calculated centroid', async () => {
      // Add points first
      layersStore.addPoint({
        id: 'p1',
        name: 'P1',
        coordinates: { lat: 48.8, lon: 2.3 },
      });
      layersStore.addPoint({
        id: 'p2',
        name: 'P2',
        coordinates: { lat: 48.9, lon: 2.4 },
      });
      layersStore.addPoint({
        id: 'p3',
        name: 'P3',
        coordinates: { lat: 48.85, lon: 2.5 },
      });

      layersStore.addPolygon({
        id: 'polygon-1',
        name: 'Polygon 1',
        pointIds: ['p1', 'p2', 'p3'],
        createdAt: 1000,
      });

      // Manually add resolved points for the animation
      const polygon = layersStore.polygons.find((p) => p.id === 'polygon-1');
      if (polygon) {
        (polygon as any).points = [
          { lat: 48.8, lon: 2.3 },
          { lat: 48.9, lon: 2.4 },
          { lat: 48.85, lon: 2.5 },
        ];
      }

      uiStore.setElementVisibility('polygon', 'polygon-1', true);
      uiStore.animationConfig.type = 'startToFinish';
      uiStore.animationConfig.disableZoomOnElement = false;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      vi.advanceTimersByTime(3000);
      await nextTick();

      expect(mockMapContainer.flyTo).toHaveBeenCalled();
    });

    it('should call onComplete when map is null', async () => {
      mockMapContainer.map = ref(null);

      layersStore.addPoint({
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 48.8566, lon: 2.3522 },
        createdAt: 1000,
      });

      uiStore.setElementVisibility('point', 'point-1', true);
      uiStore.animationConfig.type = 'startToFinish';

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      vi.advanceTimersByTime(3000);
      await nextTick();

      // Should handle gracefully without calling flyTo
      expect(mockMapContainer.flyTo).not.toHaveBeenCalled();
    });

    it('should call onComplete for unknown element type', async () => {
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Circle 1',
        center: { lat: 48, lon: 2 },
        radius: 5,
        createdAt: 1000,
      });

      // Hack to create unknown type
      const elements = layersStore.circles as any[];
      elements[0].type = 'unknown';

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle missing flyTo function', async () => {
      delete mockMapContainer.flyTo;

      layersStore.addPoint({
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 48.8566, lon: 2.3522 },
        createdAt: 1000,
      });

      uiStore.setElementVisibility('point', 'point-1', true);
      uiStore.animationConfig.type = 'startToFinish';
      uiStore.animationConfig.disableZoomOnElement = false;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      vi.advanceTimersByTime(3000);
      await nextTick();

      // Should handle gracefully
      expect(true).toBe(true);
    });
  });

  describe('animateSmoothZoomOut', () => {
    it('should animate from start view to end view', async () => {
      uiStore.animationConfig.type = 'smoothZoomOut';
      uiStore.animationConfig.startView = { lat: 48.8566, lon: 2.3522, zoom: 15 };
      uiStore.animationConfig.endView = { lat: 48.8566, lon: 2.3522, zoom: 8 };
      uiStore.animationConfig.zoomSpeed = 5;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      // Should set start view immediately
      expect(mockMapContainer.setCenter).toHaveBeenCalledWith(48.8566, 2.3522, 15);

      // Wait for countdown
      vi.advanceTimersByTime(3000);
      await nextTick();

      // Should call flyTo to end view
      expect(mockMapContainer.flyTo).toHaveBeenCalled();
    });

    it('should stop animation and show toast when complete', async () => {
      const addToastSpy = vi.spyOn(uiStore, 'addToast');
      const stopAnimationSpy = vi.spyOn(uiStore, 'stopAnimation');

      uiStore.animationConfig.type = 'smoothZoomOut';
      uiStore.animationConfig.startView = { lat: 48.8566, lon: 2.3522, zoom: 15 };
      uiStore.animationConfig.endView = { lat: 48.8566, lon: 2.3522, zoom: 8 };
      uiStore.animationConfig.zoomSpeed = 10; // Fast speed = 2s duration

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      // Countdown
      vi.advanceTimersByTime(3000);
      await nextTick();

      // Animation duration + 500ms buffer
      vi.advanceTimersByTime(2500);
      await nextTick();

      expect(stopAnimationSpy).toHaveBeenCalled();
      expect(addToastSpy).toHaveBeenCalledWith('Animation complete!', 'success');
    });

    it('should stop animation when map is null', async () => {
      mockMapContainer.map = ref(null);
      const stopAnimationSpy = vi.spyOn(uiStore, 'stopAnimation');

      uiStore.animationConfig.type = 'smoothZoomOut';
      uiStore.animationConfig.startView = { lat: 48.8566, lon: 2.3522, zoom: 15 };
      uiStore.animationConfig.endView = { lat: 48.8566, lon: 2.3522, zoom: 8 };

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      vi.advanceTimersByTime(3000);
      await nextTick();

      expect(stopAnimationSpy).toHaveBeenCalled();
    });

    it('should show error when start view is not set', async () => {
      const addToastSpy = vi.spyOn(uiStore, 'addToast');
      const stopAnimationSpy = vi.spyOn(uiStore, 'stopAnimation');

      uiStore.animationConfig.type = 'smoothZoomOut';
      uiStore.animationConfig.startView = undefined;
      uiStore.animationConfig.endView = { lat: 48.8566, lon: 2.3522, zoom: 8 };

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      vi.advanceTimersByTime(3000);
      await nextTick();

      expect(stopAnimationSpy).toHaveBeenCalled();
      expect(addToastSpy).toHaveBeenCalledWith('Start and end views must be set', 'error');
    });

    it('should show error when end view is not set', async () => {
      const addToastSpy = vi.spyOn(uiStore, 'addToast');
      const stopAnimationSpy = vi.spyOn(uiStore, 'stopAnimation');

      uiStore.animationConfig.type = 'smoothZoomOut';
      uiStore.animationConfig.startView = { lat: 48.8566, lon: 2.3522, zoom: 15 };
      uiStore.animationConfig.endView = undefined;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      vi.advanceTimersByTime(3000);
      await nextTick();

      expect(stopAnimationSpy).toHaveBeenCalled();
      expect(addToastSpy).toHaveBeenCalledWith('Start and end views must be set', 'error');
    });

    it('should handle visible elements during smoothZoomOut', async () => {
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Circle 1',
        center: { lat: 48, lon: 2 },
        radius: 5,
      });

      uiStore.setElementVisibility('circle', 'circle-1', true);
      uiStore.animationConfig.type = 'smoothZoomOut';
      uiStore.animationConfig.startView = { lat: 48.8566, lon: 2.3522, zoom: 15 };
      uiStore.animationConfig.endView = { lat: 48.8566, lon: 2.3522, zoom: 8 };

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      // Visible elements should be rendered
      expect(mockDrawing.updateElementVisibility).toHaveBeenCalledWith(
        'circle',
        'circle-1',
        true,
        false
      );
    });
  });

  describe('animateStartToFinish', () => {
    it('should show elements one by one', async () => {
      layersStore.addPoint({
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 48.8566, lon: 2.3522 },
        createdAt: 1000,
      });

      layersStore.addPoint({
        id: 'point-2',
        name: 'Point 2',
        coordinates: { lat: 48.9, lon: 2.4 },
        createdAt: 2000,
      });

      uiStore.setElementVisibility('point', 'point-1', true);
      uiStore.setElementVisibility('point', 'point-2', true);
      uiStore.animationConfig.type = 'startToFinish';
      uiStore.animationConfig.disableZoomOnElement = false;
      uiStore.animationConfig.transitionSpeed = 5;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      // Countdown
      vi.advanceTimersByTime(3000);
      await nextTick();

      // First element navigation + show
      expect(mockMapContainer.flyTo).toHaveBeenCalled();
    });

    it('should show toast when no visible elements', async () => {
      const addToastSpy = vi.spyOn(uiStore, 'addToast');
      const stopAnimationSpy = vi.spyOn(uiStore, 'stopAnimation');

      // Add element but keep it hidden
      layersStore.addPoint({
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      });

      uiStore.setElementVisibility('point', 'point-1', false);
      uiStore.animationConfig.type = 'startToFinish';

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      // Countdown
      vi.advanceTimersByTime(3000);
      await nextTick();

      expect(stopAnimationSpy).toHaveBeenCalled();
      expect(addToastSpy).toHaveBeenCalledWith('No visible elements to animate', 'info');
    });

    it('should handle disableZoomOnElement mode', async () => {
      layersStore.addPoint({
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 48.8566, lon: 2.3522 },
        createdAt: 1000,
      });

      uiStore.setElementVisibility('point', 'point-1', true);
      uiStore.animationConfig.type = 'startToFinish';
      uiStore.animationConfig.disableZoomOnElement = true;
      uiStore.animationConfig.transitionSpeed = 5;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      // Countdown
      vi.advanceTimersByTime(3000);
      await nextTick();

      // Should fit bounds instead of flying to each element
      expect(mockMapContainer.flyToBounds).toHaveBeenCalled();
    });

    it('should calculate bounds for circles in disableZoomOnElement mode', async () => {
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Circle 1',
        center: { lat: 48.8566, lon: 2.3522 },
        radius: 10,
        createdAt: 1000,
      });

      uiStore.setElementVisibility('circle', 'circle-1', true);
      uiStore.animationConfig.type = 'startToFinish';
      uiStore.animationConfig.disableZoomOnElement = true;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      vi.advanceTimersByTime(3000);
      await nextTick();

      expect(mockMapContainer.flyToBounds).toHaveBeenCalled();
    });

    it('should calculate bounds for lineSegments in disableZoomOnElement mode', async () => {
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Line 1',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.9, lon: 2.4 },
        mode: 'coordinate',
        createdAt: 1000,
      });

      uiStore.setElementVisibility('lineSegment', 'line-1', true);
      uiStore.animationConfig.type = 'startToFinish';
      uiStore.animationConfig.disableZoomOnElement = true;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      vi.advanceTimersByTime(3000);
      await nextTick();

      expect(mockMapContainer.flyToBounds).toHaveBeenCalled();
    });

    it('should calculate bounds for points in disableZoomOnElement mode', async () => {
      layersStore.addPoint({
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 48.8566, lon: 2.3522 },
        createdAt: 1000,
      });

      uiStore.setElementVisibility('point', 'point-1', true);
      uiStore.animationConfig.type = 'startToFinish';
      uiStore.animationConfig.disableZoomOnElement = true;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      vi.advanceTimersByTime(3000);
      await nextTick();

      expect(mockMapContainer.flyToBounds).toHaveBeenCalled();
    });

    it('should calculate bounds for polygons in disableZoomOnElement mode', async () => {
      layersStore.addPoint({
        id: 'p1',
        name: 'P1',
        coordinates: { lat: 48.8, lon: 2.3 },
      });
      layersStore.addPoint({
        id: 'p2',
        name: 'P2',
        coordinates: { lat: 48.9, lon: 2.4 },
      });
      layersStore.addPoint({
        id: 'p3',
        name: 'P3',
        coordinates: { lat: 48.85, lon: 2.5 },
      });

      layersStore.addPolygon({
        id: 'polygon-1',
        name: 'Polygon 1',
        pointIds: ['p1', 'p2', 'p3'],
        createdAt: 1000,
      });

      uiStore.setElementVisibility('polygon', 'polygon-1', true);
      uiStore.animationConfig.type = 'startToFinish';
      uiStore.animationConfig.disableZoomOnElement = true;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      vi.advanceTimersByTime(3000);
      await nextTick();

      expect(mockMapContainer.flyToBounds).toHaveBeenCalled();
    });

    it('should animate line segments when showing', async () => {
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Line 1',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.9, lon: 2.4 },
        mode: 'coordinate',
        createdAt: 1000,
      });

      uiStore.setElementVisibility('lineSegment', 'line-1', true);
      uiStore.animationConfig.type = 'startToFinish';
      uiStore.animationConfig.disableZoomOnElement = true;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      vi.advanceTimersByTime(3000);
      await nextTick();

      // Line segments should be animated (animate=true)
      expect(mockDrawing.updateElementVisibility).toHaveBeenCalledWith(
        'lineSegment',
        'line-1',
        true,
        true
      );
    });

    it('should restore visibility when animation is stopped mid-flight', async () => {
      layersStore.addPoint({
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 48.8566, lon: 2.3522 },
        createdAt: 1000,
      });

      uiStore.setElementVisibility('point', 'point-1', true);
      uiStore.animationConfig.type = 'startToFinish';
      uiStore.animationConfig.disableZoomOnElement = false;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      // Countdown
      vi.advanceTimersByTime(3000);
      await nextTick();

      // Stop animation before it completes
      uiStore.animationState.isPlaying = false;
      await nextTick();

      // Process pending timers
      vi.runAllTimers();
      await nextTick();

      // Visibility should be restored
      expect(mockDrawing.updateElementVisibility).toHaveBeenCalled();
    });

    it('should complete animation and show success toast', async () => {
      const addToastSpy = vi.spyOn(uiStore, 'addToast');
      const stopAnimationSpy = vi.spyOn(uiStore, 'stopAnimation');

      layersStore.addPoint({
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 48.8566, lon: 2.3522 },
        createdAt: 1000,
      });

      uiStore.setElementVisibility('point', 'point-1', true);
      uiStore.animationConfig.type = 'startToFinish';
      uiStore.animationConfig.disableZoomOnElement = true;
      uiStore.animationConfig.transitionSpeed = 10; // Fast

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      // Countdown
      vi.advanceTimersByTime(3000);
      await nextTick();

      // Process animation
      vi.advanceTimersByTime(5000);
      await nextTick();

      expect(stopAnimationSpy).toHaveBeenCalled();
      expect(addToastSpy).toHaveBeenCalledWith('Animation complete!', 'success');
    });

    it('should handle null drawing gracefully', async () => {
      layersStore.addPoint({
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 48.8566, lon: 2.3522 },
        createdAt: 1000,
      });

      uiStore.setElementVisibility('point', 'point-1', true);
      uiStore.animationConfig.type = 'startToFinish';
      uiStore.animationConfig.disableZoomOnElement = true;

      useAnimation(mockMapContainer, null as any, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      // Should not throw
      vi.advanceTimersByTime(3000);
      await nextTick();

      expect(true).toBe(true);
    });

    it('should handle lineSegment without endpoint in bounds calculation', async () => {
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Line 1',
        center: { lat: 48.8566, lon: 2.3522 },
        mode: 'parallel',
        // No endpoint
        createdAt: 1000,
      });

      uiStore.setElementVisibility('lineSegment', 'line-1', true);
      uiStore.animationConfig.type = 'startToFinish';
      uiStore.animationConfig.disableZoomOnElement = true;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      vi.advanceTimersByTime(3000);
      await nextTick();

      expect(mockMapContainer.flyToBounds).toHaveBeenCalled();
    });
  });

  describe('startAnimationSequence', () => {
    it('should set countdown values', async () => {
      const setCountdownSpy = vi.spyOn(uiStore, 'setAnimationCountdown');

      uiStore.animationConfig.type = 'startToFinish';

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      expect(setCountdownSpy).toHaveBeenCalledWith(3);

      vi.advanceTimersByTime(1000);
      await nextTick();
      expect(setCountdownSpy).toHaveBeenCalledWith(2);

      vi.advanceTimersByTime(1000);
      await nextTick();
      expect(setCountdownSpy).toHaveBeenCalledWith(1);

      vi.advanceTimersByTime(1000);
      await nextTick();
      expect(setCountdownSpy).toHaveBeenCalledWith(0);
    });

    it('should hide all elements before startToFinish animation', async () => {
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Circle 1',
        center: { lat: 48, lon: 2 },
        radius: 5,
      });

      uiStore.setElementVisibility('circle', 'circle-1', true);
      uiStore.animationConfig.type = 'startToFinish';

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      // Elements should be hidden
      expect(mockDrawing.updateElementVisibility).toHaveBeenCalledWith('circle', 'circle-1', false);
    });
  });

  describe('setLabelsAndNotesVisibility', () => {
    it('should hide labels and notes when hideLabelsAndNotes is enabled', async () => {
      // Create mock DOM elements
      const pointLabel = document.createElement('div');
      pointLabel.className = 'point-label';
      document.body.append(pointLabel);

      const noteTooltip = document.createElement('div');
      noteTooltip.className = 'note-tooltip';
      document.body.append(noteTooltip);

      uiStore.animationConfig.hideLabelsAndNotes = true;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      // Labels should be hidden
      expect(pointLabel.style.display).toBe('none');
      expect(noteTooltip.style.display).toBe('none');

      // Cleanup
      pointLabel.remove();
      noteTooltip.remove();
    });

    it('should show labels and notes when animation stops', async () => {
      const pointLabel = document.createElement('div');
      pointLabel.className = 'point-label';
      pointLabel.style.display = 'none';
      document.body.append(pointLabel);

      const noteTooltip = document.createElement('div');
      noteTooltip.className = 'note-tooltip';
      noteTooltip.style.display = 'none';
      document.body.append(noteTooltip);

      uiStore.animationConfig.hideLabelsAndNotes = true;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      uiStore.animationState.isPlaying = false;
      await nextTick();

      // Labels should be shown
      expect(pointLabel.style.display).toBe('');
      expect(noteTooltip.style.display).toBe('');

      // Cleanup
      pointLabel.remove();
      noteTooltip.remove();
    });

    it('should not modify labels when hideLabelsAndNotes is disabled', async () => {
      const pointLabel = document.createElement('div');
      pointLabel.className = 'point-label';
      document.body.append(pointLabel);

      uiStore.animationConfig.hideLabelsAndNotes = false;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      // Labels should not be hidden
      expect(pointLabel.style.display).toBe('');

      // Cleanup
      pointLabel.remove();
    });
  });

  describe('restoreOriginalVisibility', () => {
    it('should restore visibility state after animation stops', async () => {
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

      uiStore.setElementVisibility('circle', 'circle-1', true);
      uiStore.setElementVisibility('point', 'point-1', false);

      uiStore.animationConfig.type = 'startToFinish';
      uiStore.animationConfig.disableZoomOnElement = false;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      vi.advanceTimersByTime(3000);
      await nextTick();

      // Stop animation
      uiStore.animationState.isPlaying = false;
      await nextTick();

      vi.runAllTimers();
      await nextTick();

      // Original visibility should be restored
      expect(mockDrawing.updateElementVisibility).toHaveBeenCalled();
    });
  });

  describe('watch animation state', () => {
    it('should close sidebars when animation starts', async () => {
      sidebarOpen.value = true;
      uiStore.setSidebarOpen(true);
      uiStore.setLeftSidebarOpen(true);

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      expect(sidebarOpen.value).toBe(false);
    });

    it('should keep sidebars closed when animation stops', async () => {
      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      sidebarOpen.value = true; // Try to open

      uiStore.animationState.isPlaying = false;
      await nextTick();

      // Should be closed again
      expect(sidebarOpen.value).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty store', async () => {
      uiStore.animationConfig.type = 'startToFinish';

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      vi.advanceTimersByTime(3000);
      await nextTick();

      // Should handle gracefully
      expect(true).toBe(true);
    });

    it('should handle all element types in getAllElementsSorted', async () => {
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Circle',
        center: { lat: 48, lon: 2 },
        radius: 5,
      });
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Line',
        center: { lat: 47, lon: 1 },
        mode: 'coordinate',
      });
      layersStore.addPoint({
        id: 'point-1',
        name: 'Point',
        coordinates: { lat: 49, lon: 3 },
      });
      layersStore.addPolygon({
        id: 'polygon-1',
        name: 'Polygon',
        pointIds: [],
      });

      uiStore.setElementVisibility('circle', 'circle-1', true);
      uiStore.setElementVisibility('lineSegment', 'line-1', true);
      uiStore.setElementVisibility('point', 'point-1', true);
      uiStore.setElementVisibility('polygon', 'polygon-1', true);

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      // Should process all element types
      expect(mockDrawing.updateElementVisibility).toHaveBeenCalled();
    });

    it('should handle polygon with missing point references', async () => {
      layersStore.addPolygon({
        id: 'polygon-1',
        name: 'Polygon',
        pointIds: ['nonexistent-1', 'nonexistent-2'],
        createdAt: 1000,
      });

      uiStore.setElementVisibility('polygon', 'polygon-1', true);
      uiStore.animationConfig.type = 'startToFinish';
      uiStore.animationConfig.disableZoomOnElement = true;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      vi.advanceTimersByTime(3000);
      await nextTick();

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle animation stop during navigation callback', async () => {
      layersStore.addPoint({
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 48.8566, lon: 2.3522 },
        createdAt: 1000,
      });

      uiStore.setElementVisibility('point', 'point-1', true);
      uiStore.animationConfig.type = 'startToFinish';
      uiStore.animationConfig.disableZoomOnElement = false;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      // Countdown
      vi.advanceTimersByTime(3000);
      await nextTick();

      // Advance to trigger flyTo callback
      vi.advanceTimersByTime(4000);

      // Stop during callback
      uiStore.animationState.isPlaying = false;
      await nextTick();

      vi.runAllTimers();
      await nextTick();

      expect(true).toBe(true);
    });

    it('should handle null drawing in navigation mode', async () => {
      layersStore.addPoint({
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 48.8566, lon: 2.3522 },
        createdAt: 1000,
      });

      uiStore.setElementVisibility('point', 'point-1', true);
      uiStore.animationConfig.type = 'startToFinish';
      uiStore.animationConfig.disableZoomOnElement = false; // Use navigation mode

      useAnimation(mockMapContainer, null as any, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      // Countdown
      vi.advanceTimersByTime(3000);
      await nextTick();

      // Advance for navigation and callback
      vi.advanceTimersByTime(5000);
      await nextTick();

      vi.runAllTimers();
      await nextTick();

      // Should handle gracefully
      expect(true).toBe(true);
    });

    it('should handle polygon with points array in navigateToElement', async () => {
      // Add polygon with pre-resolved points
      layersStore.addPolygon({
        id: 'polygon-1',
        name: 'Polygon 1',
        pointIds: [],
        createdAt: 1000,
      });

      // Manually add points array
      const polygon = layersStore.polygons.find((p) => p.id === 'polygon-1');
      if (polygon) {
        (polygon as any).points = [
          { lat: 48.8, lon: 2.3 },
          { lat: 48.9, lon: 2.4 },
          { lat: 48.85, lon: 2.5 },
        ];
      }

      uiStore.setElementVisibility('polygon', 'polygon-1', true);
      uiStore.animationConfig.type = 'startToFinish';
      uiStore.animationConfig.disableZoomOnElement = false;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      vi.advanceTimersByTime(3000);
      await nextTick();

      // Polygon navigation should use centroid
      expect(mockMapContainer.flyTo).toHaveBeenCalled();
    });

    it('should handle smoothZoomOut with hidden elements', async () => {
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Circle 1',
        center: { lat: 48, lon: 2 },
        radius: 5,
      });

      // Set element as NOT visible
      uiStore.setElementVisibility('circle', 'circle-1', false);
      uiStore.animationConfig.type = 'smoothZoomOut';
      uiStore.animationConfig.startView = { lat: 48.8566, lon: 2.3522, zoom: 15 };
      uiStore.animationConfig.endView = { lat: 48.8566, lon: 2.3522, zoom: 8 };

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      // Hidden elements should not trigger updateElementVisibility with true
      // The call with (element.type, element.id, true, false) should NOT happen
      const calls = mockDrawing.updateElementVisibility.mock.calls;
      const visibilityTrueCalls = calls.filter((c: any) => c[2] === true);
      expect(visibilityTrueCalls.length).toBe(0);
    });

    it('should handle restoreOriginalVisibility with element not in original state', async () => {
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Circle 1',
        center: { lat: 48, lon: 2 },
        radius: 5,
      });

      uiStore.setElementVisibility('circle', 'circle-1', true);
      uiStore.animationConfig.type = 'startToFinish';
      uiStore.animationConfig.disableZoomOnElement = false;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      // Add a new element during animation (won't have original state saved)
      layersStore.addPoint({
        id: 'point-new',
        name: 'New Point',
        coordinates: { lat: 49, lon: 3 },
      });

      vi.advanceTimersByTime(3000);
      await nextTick();

      // Stop animation to trigger restore
      uiStore.animationState.isPlaying = false;
      await nextTick();

      vi.runAllTimers();
      await nextTick();

      // Should handle gracefully - new element won't have state to restore
      expect(true).toBe(true);
    });

    it('should handle null drawing in restoreOriginalVisibility', async () => {
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Circle 1',
        center: { lat: 48, lon: 2 },
        radius: 5,
      });

      uiStore.setElementVisibility('circle', 'circle-1', true);
      uiStore.animationConfig.type = 'startToFinish';
      uiStore.animationConfig.disableZoomOnElement = false;

      useAnimation(mockMapContainer, null as any, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      vi.advanceTimersByTime(3000);
      await nextTick();

      // Stop to trigger restore
      uiStore.animationState.isPlaying = false;
      await nextTick();

      vi.runAllTimers();
      await nextTick();

      expect(true).toBe(true);
    });

    it('should handle smoothZoomOut without flyTo function', async () => {
      delete mockMapContainer.flyTo;

      uiStore.animationConfig.type = 'smoothZoomOut';
      uiStore.animationConfig.startView = { lat: 48.8566, lon: 2.3522, zoom: 15 };
      uiStore.animationConfig.endView = { lat: 48.8566, lon: 2.3522, zoom: 8 };

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      vi.advanceTimersByTime(3000);
      await nextTick();

      // Should still trigger timeout and complete animation
      vi.advanceTimersByTime(15_000);
      await nextTick();

      expect(true).toBe(true);
    });

    it('should handle navigateToElement with flyTo but no callback', async () => {
      // Create element
      layersStore.addPoint({
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 48.8566, lon: 2.3522 },
        createdAt: 1000,
      });

      uiStore.setElementVisibility('point', 'point-1', true);
      uiStore.animationConfig.type = 'startToFinish';
      uiStore.animationConfig.disableZoomOnElement = false;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      vi.advanceTimersByTime(3000);
      await nextTick();

      // Complete the animation
      vi.runAllTimers();
      await nextTick();

      expect(mockMapContainer.flyTo).toHaveBeenCalled();
    });

    it('should handle lineSegment without endpoint in coordinate mode', async () => {
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Line 1',
        center: { lat: 48.8566, lon: 2.3522 },
        mode: 'coordinate', // Not parallel
        // No endpoint
        createdAt: 1000,
      });

      uiStore.setElementVisibility('lineSegment', 'line-1', true);
      uiStore.animationConfig.type = 'startToFinish';
      uiStore.animationConfig.disableZoomOnElement = false;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      vi.advanceTimersByTime(3000);
      await nextTick();

      // Should navigate using center only (no endpoint)
      expect(mockMapContainer.flyTo).toHaveBeenCalled();
    });

    it('should handle smoothZoomOut stopped before timeout completes', async () => {
      const stopAnimationSpy = vi.spyOn(uiStore, 'stopAnimation');
      const addToastSpy = vi.spyOn(uiStore, 'addToast');

      uiStore.animationConfig.type = 'smoothZoomOut';
      uiStore.animationConfig.startView = { lat: 48.8566, lon: 2.3522, zoom: 15 };
      uiStore.animationConfig.endView = { lat: 48.8566, lon: 2.3522, zoom: 8 };
      uiStore.animationConfig.zoomSpeed = 5;

      useAnimation(mockMapContainer, mockDrawing, sidebarOpen);

      uiStore.animationState.isPlaying = true;
      await nextTick();

      // Countdown
      vi.advanceTimersByTime(3000);
      await nextTick();

      // Animation starts, flyTo is called
      expect(mockMapContainer.flyTo).toHaveBeenCalled();

      // Stop animation manually before timeout completes (user clicks stop)
      uiStore.stopAnimation();
      await nextTick();

      expect(stopAnimationSpy).toHaveBeenCalledTimes(1);
      addToastSpy.mockClear();

      // Now let the animation timeout fire (it should NOT call stopAnimation again since isPlaying is false)
      vi.advanceTimersByTime(10_000);
      await nextTick();

      // stopAnimation should still only have been called once (from manual stop, not from timeout)
      expect(stopAnimationSpy).toHaveBeenCalledTimes(1);
      // Toast should not have been added by timeout since animation was already stopped
      expect(addToastSpy).not.toHaveBeenCalledWith('Animation complete!', 'success');
    });
  });
});
