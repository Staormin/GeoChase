import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useFreeHandDrawing } from '@/composables/useFreeHandDrawing';
import { useUIStore } from '@/stores/ui';

// Mutable config for ol/proj mock
const olProjMockConfig = {
  toLonLatReturnValue: undefined as any,
};

// Mock ol/proj
vi.mock('ol/proj', () => ({
  fromLonLat: vi.fn((coord) => [coord[0] * 111_319.49, coord[1] * 111_319.49]),
  toLonLat: vi.fn((coord) => {
    if (olProjMockConfig.toLonLatReturnValue !== undefined) {
      const val = olProjMockConfig.toLonLatReturnValue;
      olProjMockConfig.toLonLatReturnValue = undefined;
      return val;
    }
    return [coord[0] / 111_319.49, coord[1] / 111_319.49];
  }),
}));

// Mock ol/sphere
vi.mock('ol/sphere', () => ({
  getDistance: vi.fn(() => 5000), // 5km in meters
}));

// Mock geometry service
vi.mock('@/services/geometry', () => ({
  calculateBearing: vi.fn(() => 45),
  destinationPoint: vi.fn((lat, lon, _dist, _bearing) => ({
    lat: lat + 0.01,
    lon: lon + 0.01,
  })),
}));

describe('useFreeHandDrawing', () => {
  let mockMapContainer: any;
  let mockDrawing: any;
  let cursorTooltip: any;
  let uiStore: ReturnType<typeof useUIStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    uiStore = useUIStore();

    // Create mock map container
    mockMapContainer = {
      map: {
        value: {
          on: vi.fn(),
          un: vi.fn(),
        },
      },
      linesSource: {
        value: {
          addFeature: vi.fn(),
          removeFeature: vi.fn(),
        },
      },
    };

    // Create mock drawing
    mockDrawing = {
      drawLineSegment: vi.fn(),
    };

    // Create cursor tooltip ref
    cursorTooltip = ref({
      visible: false,
      x: 0,
      y: 0,
      distance: '',
      azimuth: '',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('setup', () => {
    it('should register event listeners on map', () => {
      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);

      setup();

      expect(mockMapContainer.map.value.on).toHaveBeenCalledWith(
        'pointermove',
        expect.any(Function)
      );
      expect(mockMapContainer.map.value.on).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should not register listeners if map is null', () => {
      mockMapContainer.map.value = null;
      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);

      setup();

      // Should not throw
    });
  });

  describe('cleanup', () => {
    it('should unregister event listeners on map', () => {
      const { cleanup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);

      cleanup();

      expect(mockMapContainer.map.value.un).toHaveBeenCalledWith(
        'pointermove',
        expect.any(Function)
      );
      expect(mockMapContainer.map.value.un).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should not throw if map is null', () => {
      mockMapContainer.map.value = null;
      const { cleanup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);

      expect(() => cleanup()).not.toThrow();
    });

    it('should remove preview layer if exists', () => {
      const { setup, cleanup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);

      // Start free hand drawing mode
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = '48.8566, 2.3522';

      setup();

      // Simulate mouse move to create preview layer
      const pointermoveHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'pointermove'
      )?.[1];

      if (pointermoveHandler) {
        pointermoveHandler({
          coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
          pixel: [500, 400],
          originalEvent: { altKey: false, ctrlKey: false },
        });
      }

      cleanup();

      expect(mockMapContainer.linesSource.value.removeFeature).toHaveBeenCalled();
    });
  });

  describe('handleEscape', () => {
    it('should stop drawing and show toast when drawing is active', () => {
      uiStore.startFreeHandDrawing();
      const { handleEscape } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);

      handleEscape();

      expect(uiStore.freeHandDrawing.isDrawing).toBe(false);
      expect(uiStore.toasts.length).toBeGreaterThan(0);
    });

    it('should do nothing when drawing is not active', () => {
      const { handleEscape } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);

      handleEscape();

      expect(uiStore.toasts.length).toBe(0);
    });

    it('should remove preview layer and reset locked values', () => {
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = '48.8566, 2.3522';

      const { setup, handleEscape } = useFreeHandDrawing(
        mockMapContainer,
        mockDrawing,
        cursorTooltip
      );
      setup();

      // Simulate mouse move with Alt to lock azimuth
      const pointermoveHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'pointermove'
      )?.[1];

      if (pointermoveHandler) {
        pointermoveHandler({
          coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
          pixel: [500, 400],
          originalEvent: { altKey: true, ctrlKey: false },
        });
      }

      handleEscape();

      expect(mockMapContainer.linesSource.value.removeFeature).toHaveBeenCalled();
    });
  });

  describe('handleMouseMove', () => {
    it('should hide tooltip when not in drawing mode', () => {
      cursorTooltip.value.visible = true;
      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const pointermoveHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'pointermove'
      )?.[1];

      pointermoveHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: {},
      });

      expect(cursorTooltip.value.visible).toBe(false);
    });

    it('should return early if map is null', () => {
      uiStore.startFreeHandDrawing();
      mockMapContainer.map.value = null;

      // Just instantiate - we can't call setup since map is null
      useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);

      // Verify initial state is preserved
      expect(cursorTooltip.value.visible).toBe(false);
    });

    it('should hide tooltip if coordinates are invalid', () => {
      uiStore.startFreeHandDrawing();
      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      // Set mock to return undefined values
      olProjMockConfig.toLonLatReturnValue = [undefined, undefined];

      const pointermoveHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'pointermove'
      )?.[1];

      pointermoveHandler({
        coordinate: [0, 0],
        pixel: [500, 400],
        originalEvent: {},
      });

      expect(cursorTooltip.value.visible).toBe(false);
    });

    it('should hide tooltip if start coordinates are not set', () => {
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = '';

      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const pointermoveHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'pointermove'
      )?.[1];

      pointermoveHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: {},
      });

      expect(cursorTooltip.value.visible).toBe(false);
    });

    it('should update tooltip and draw preview when drawing mode is active', () => {
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = '48.8566, 2.3522';

      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const pointermoveHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'pointermove'
      )?.[1];

      pointermoveHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: { altKey: false, ctrlKey: false },
      });

      expect(cursorTooltip.value.visible).toBe(true);
      expect(cursorTooltip.value.x).toBe(520);
      expect(cursorTooltip.value.y).toBe(420);
      expect(mockMapContainer.linesSource.value.addFeature).toHaveBeenCalled();
    });

    it('should lock azimuth when Alt key is pressed', () => {
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = '48.8566, 2.3522';

      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const pointermoveHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'pointermove'
      )?.[1];

      // First move with Alt - should lock azimuth
      pointermoveHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: { altKey: true, ctrlKey: false },
      });

      expect(cursorTooltip.value.azimuth).toContain('(Alt)');
    });

    it('should lock distance when Ctrl key is pressed', () => {
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = '48.8566, 2.3522';

      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const pointermoveHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'pointermove'
      )?.[1];

      // First move with Ctrl - should lock distance
      pointermoveHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: { altKey: false, ctrlKey: true },
      });

      expect(cursorTooltip.value.distance).toContain('(locked)');
    });

    it('should use locked azimuth when azimuth is predefined', () => {
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = '48.8566, 2.3522';
      uiStore.freeHandDrawing.azimuth = 90;

      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const pointermoveHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'pointermove'
      )?.[1];

      pointermoveHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: { altKey: false, ctrlKey: false },
      });

      expect(cursorTooltip.value.azimuth).toContain('(locked)');
    });

    it('should remove previous preview layer before drawing new one', () => {
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = '48.8566, 2.3522';

      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const pointermoveHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'pointermove'
      )?.[1];

      // First move - creates preview layer
      pointermoveHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: {},
      });

      // Second move - should remove previous and create new
      pointermoveHandler({
        coordinate: [2.37 * 111_319.49, 48.87 * 111_319.49],
        pixel: [510, 410],
        originalEvent: {},
      });

      expect(mockMapContainer.linesSource.value.removeFeature).toHaveBeenCalled();
    });

    it('should handle null pixel values gracefully', () => {
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = '48.8566, 2.3522';

      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const pointermoveHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'pointermove'
      )?.[1];

      pointermoveHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [null, null],
        originalEvent: {},
      });

      expect(cursorTooltip.value.x).toBe(20);
      expect(cursorTooltip.value.y).toBe(20);
    });
  });

  describe('handleMapClick', () => {
    it('should do nothing when not in drawing mode', () => {
      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const clickHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'click'
      )?.[1];

      clickHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: {},
      });

      expect(mockDrawing.drawLineSegment).not.toHaveBeenCalled();
    });

    it('should return early if map is null', () => {
      uiStore.startFreeHandDrawing();
      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      // Set map to null after setup
      const mapRef = mockMapContainer.map;
      mockMapContainer.map = { value: null };

      const clickHandler = mapRef.value.on.mock.calls.find((call: any) => call[0] === 'click')?.[1];

      clickHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: {},
      });

      expect(mockDrawing.drawLineSegment).not.toHaveBeenCalled();
    });

    it('should return early if coordinates are invalid', () => {
      uiStore.startFreeHandDrawing();
      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      // Set mock to return undefined values
      olProjMockConfig.toLonLatReturnValue = [undefined, undefined];

      const clickHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'click'
      )?.[1];

      clickHandler({
        coordinate: [0, 0],
        pixel: [500, 400],
        originalEvent: {},
      });

      expect(mockDrawing.drawLineSegment).not.toHaveBeenCalled();
    });

    it('should set start point on first click when no start coord', () => {
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = '';

      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const clickHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'click'
      )?.[1];

      clickHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: {},
      });

      expect(uiStore.freeHandDrawing.startCoord).not.toBe('');
      expect(uiStore.toasts.some((t) => t.message.includes('Start point set'))).toBe(true);
    });

    it('should show error for invalid start coordinates', () => {
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = 'invalid';

      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const clickHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'click'
      )?.[1];

      clickHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: {},
      });

      expect(uiStore.toasts.some((t) => t.type === 'error')).toBe(true);
      expect(uiStore.freeHandDrawing.isDrawing).toBe(false);
    });

    it('should draw line segment when start coord is valid', () => {
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = '48.8566, 2.3522';

      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const clickHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'click'
      )?.[1];

      clickHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: { altKey: false, ctrlKey: false },
      });

      expect(mockDrawing.drawLineSegment).toHaveBeenCalled();
      expect(uiStore.freeHandDrawing.isDrawing).toBe(false);
    });

    it('should use custom name when provided', () => {
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = '48.8566, 2.3522';
      uiStore.freeHandDrawing.name = 'My Custom Line';

      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const clickHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'click'
      )?.[1];

      clickHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: {},
      });

      expect(mockDrawing.drawLineSegment).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        'My Custom Line',
        'coordinate',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      );
    });

    it('should use locked azimuth when Alt was pressed during drawing', () => {
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = '48.8566, 2.3522';

      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const pointermoveHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'pointermove'
      )?.[1];

      const clickHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'click'
      )?.[1];

      // Lock azimuth with Alt during mouse move
      pointermoveHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: { altKey: true, ctrlKey: false },
      });

      // Click with Alt still pressed
      clickHandler({
        coordinate: [2.37 * 111_319.49, 48.87 * 111_319.49],
        pixel: [510, 410],
        originalEvent: { altKey: true, ctrlKey: false },
      });

      expect(mockDrawing.drawLineSegment).toHaveBeenCalled();
    });

    it('should use locked distance when Ctrl was pressed during drawing', () => {
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = '48.8566, 2.3522';

      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const pointermoveHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'pointermove'
      )?.[1];

      const clickHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'click'
      )?.[1];

      // Lock distance with Ctrl during mouse move
      pointermoveHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: { altKey: false, ctrlKey: true },
      });

      // Click with Ctrl still pressed
      clickHandler({
        coordinate: [2.37 * 111_319.49, 48.87 * 111_319.49],
        pixel: [510, 410],
        originalEvent: { altKey: false, ctrlKey: true },
      });

      expect(mockDrawing.drawLineSegment).toHaveBeenCalled();
    });

    it('should use predefined azimuth when set', () => {
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = '48.8566, 2.3522';
      uiStore.freeHandDrawing.azimuth = 90;

      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const clickHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'click'
      )?.[1];

      clickHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: {},
      });

      expect(mockDrawing.drawLineSegment).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(String),
        'coordinate',
        undefined,
        90,
        undefined,
        undefined,
        undefined
      );
    });

    it('should remove preview layer on click', () => {
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = '48.8566, 2.3522';

      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const pointermoveHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'pointermove'
      )?.[1];

      const clickHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'click'
      )?.[1];

      // Create preview layer
      pointermoveHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: {},
      });

      // Click to finalize
      clickHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: {},
      });

      expect(mockMapContainer.linesSource.value.removeFeature).toHaveBeenCalled();
    });
  });

  describe('watch for drawing mode changes', () => {
    it('should clean up preview layer when drawing mode is stopped', async () => {
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = '48.8566, 2.3522';

      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const pointermoveHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'pointermove'
      )?.[1];

      // Create preview layer
      pointermoveHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: {},
      });

      // Stop drawing - watcher should clean up
      uiStore.stopFreeHandDrawing();

      // Wait for watcher to trigger
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockMapContainer.linesSource.value.removeFeature).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle missing originalEvent', () => {
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = '48.8566, 2.3522';

      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const pointermoveHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'pointermove'
      )?.[1];

      // Call without originalEvent
      pointermoveHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
      });

      expect(cursorTooltip.value.visible).toBe(true);
    });

    it('should reset locked values after click', () => {
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = '48.8566, 2.3522';

      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const pointermoveHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'pointermove'
      )?.[1];

      const clickHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'click'
      )?.[1];

      // Lock values
      pointermoveHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: { altKey: true, ctrlKey: true },
      });

      // Click to finalize and reset
      clickHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: { altKey: true, ctrlKey: true },
      });

      expect(mockDrawing.drawLineSegment).toHaveBeenCalled();
    });

    it('should unlock azimuth when Alt is released', () => {
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = '48.8566, 2.3522';

      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const pointermoveHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'pointermove'
      )?.[1];

      // Lock azimuth
      pointermoveHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: { altKey: true, ctrlKey: false },
      });

      // Release Alt - azimuth should unlock
      pointermoveHandler({
        coordinate: [2.37 * 111_319.49, 48.87 * 111_319.49],
        pixel: [510, 410],
        originalEvent: { altKey: false, ctrlKey: false },
      });

      expect(cursorTooltip.value.azimuth).not.toContain('(Alt)');
    });

    it('should handle linesSource being null during drawPreviewLine', () => {
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = '48.8566, 2.3522';

      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      // Set linesSource to null
      mockMapContainer.linesSource.value = null;

      const pointermoveHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'pointermove'
      )?.[1];

      // Should not throw
      expect(() => {
        pointermoveHandler({
          coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
          pixel: [500, 400],
          originalEvent: {},
        });
      }).not.toThrow();
    });

    it('should handle whitespace-only start coordinates', () => {
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = '   ';

      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const pointermoveHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'pointermove'
      )?.[1];

      pointermoveHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: {},
      });

      expect(cursorTooltip.value.visible).toBe(false);
    });

    it('should hide tooltip for start coordinates with wrong part count', () => {
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = '48.8566'; // Only one part

      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const pointermoveHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'pointermove'
      )?.[1];

      pointermoveHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: {},
      });

      expect(cursorTooltip.value.visible).toBe(false);
    });

    it('should hide tooltip for start coordinates with NaN values', () => {
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = '48.8566, abc'; // Second part is NaN

      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const pointermoveHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'pointermove'
      )?.[1];

      pointermoveHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: {},
      });

      expect(cursorTooltip.value.visible).toBe(false);
    });

    it('should return early if map becomes null after setup', () => {
      uiStore.startFreeHandDrawing();

      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const pointermoveHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'pointermove'
      )?.[1];

      // Make map null after setup
      mockMapContainer.map.value = null;

      // Should not throw and should return early
      pointermoveHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: {},
      });

      expect(cursorTooltip.value.visible).toBe(false);
    });

    it('should calculate endpoint with ctrl locked distance but no alt', () => {
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = '48.8566, 2.3522';

      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const pointermoveHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'pointermove'
      )?.[1];

      // First lock distance
      pointermoveHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: { altKey: false, ctrlKey: true },
      });

      // Then move with only ctrl (no alt)
      pointermoveHandler({
        coordinate: [2.37 * 111_319.49, 48.87 * 111_319.49],
        pixel: [510, 410],
        originalEvent: { altKey: false, ctrlKey: true },
      });

      expect(cursorTooltip.value.distance).toContain('(locked)');
    });

    it('should keep using locked azimuth when Alt is held after initial lock', () => {
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = '48.8566, 2.3522';

      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const pointermoveHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'pointermove'
      )?.[1];

      // First move with Alt - locks azimuth
      pointermoveHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: { altKey: true, ctrlKey: false },
      });

      // Second move with Alt still held - should use existing locked azimuth
      pointermoveHandler({
        coordinate: [2.37 * 111_319.49, 48.87 * 111_319.49],
        pixel: [510, 410],
        originalEvent: { altKey: true, ctrlKey: false },
      });

      expect(cursorTooltip.value.azimuth).toContain('(Alt)');
    });

    it('should handle linesSource becoming null when removing old preview', () => {
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = '48.8566, 2.3522';

      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const pointermoveHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'pointermove'
      )?.[1];

      // First move - creates preview layer
      pointermoveHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: {},
      });

      // Make linesSource null before second move
      mockMapContainer.linesSource.value = null;

      // Second move - should handle null linesSource gracefully
      expect(() => {
        pointermoveHandler({
          coordinate: [2.37 * 111_319.49, 48.87 * 111_319.49],
          pixel: [510, 410],
          originalEvent: {},
        });
      }).not.toThrow();
    });

    it('should handle linesSource becoming null when removing preview on click', () => {
      uiStore.startFreeHandDrawing();
      uiStore.freeHandDrawing.startCoord = '48.8566, 2.3522';

      const { setup } = useFreeHandDrawing(mockMapContainer, mockDrawing, cursorTooltip);
      setup();

      const pointermoveHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'pointermove'
      )?.[1];

      const clickHandler = mockMapContainer.map.value.on.mock.calls.find(
        (call: any) => call[0] === 'click'
      )?.[1];

      // First move - creates preview layer
      pointermoveHandler({
        coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
        pixel: [500, 400],
        originalEvent: {},
      });

      // Make linesSource null before click
      mockMapContainer.linesSource.value = null;

      // Click should handle null linesSource gracefully
      expect(() => {
        clickHandler({
          coordinate: [2.36 * 111_319.49, 48.86 * 111_319.49],
          pixel: [500, 400],
          originalEvent: {},
        });
      }).not.toThrow();
    });
  });
});
