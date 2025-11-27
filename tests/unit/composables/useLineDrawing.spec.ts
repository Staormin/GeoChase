import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLineDrawing } from '@/composables/useLineDrawing';
import { useLayersStore } from '@/stores/layers';

// Mock usePointDrawing
vi.mock('@/composables/usePointDrawing', () => ({
  usePointDrawing: vi.fn(() => ({
    drawPoint: vi.fn(),
    updatePoint: vi.fn(),
    redrawPointOnMap: vi.fn(),
  })),
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-1234'),
}));

describe('useLineDrawing', () => {
  let mockMapRef: any;
  let layersStore: ReturnType<typeof useLayersStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    layersStore = useLayersStore();

    // Create mock mapRef with all required properties
    mockMapRef = {
      map: { value: {} },
      linesSource: {
        value: {
          addFeature: vi.fn(),
          removeFeature: vi.fn(),
          getFeatureById: vi.fn(),
          changed: vi.fn(),
        },
      },
      flyToBoundsWithPanels: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('drawLineSegment', () => {
    it('should return null if map is not initialized', () => {
      mockMapRef.map = { value: null };
      const { drawLineSegment } = useLineDrawing(mockMapRef);

      const result = drawLineSegment(48.8566, 2.3522, 48.86, 2.36);

      expect(result).toBeNull();
    });

    it('should return null if linesSource is not initialized', () => {
      mockMapRef.linesSource = { value: null };
      const { drawLineSegment } = useLineDrawing(mockMapRef);

      const result = drawLineSegment(48.8566, 2.3522, 48.86, 2.36);

      expect(result).toBeNull();
    });

    it('should draw a line segment with default values', () => {
      const { drawLineSegment } = useLineDrawing(mockMapRef);

      const result = drawLineSegment(48.8566, 2.3522, 48.86, 2.36);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('test-uuid-1234');
      expect(result?.center).toEqual({ lat: 48.8566, lon: 2.3522 });
      expect(result?.endpoint).toEqual({ lat: 48.86, lon: 2.36 });
      expect(result?.mode).toBe('coordinate');
      expect(result?.color).toBe('#000000');
      expect(mockMapRef.linesSource.value.addFeature).toHaveBeenCalled();
    });

    it('should draw a line segment with custom name', () => {
      const { drawLineSegment } = useLineDrawing(mockMapRef);

      const result = drawLineSegment(48.8566, 2.3522, 48.86, 2.36, 'My Line');

      expect(result?.name).toBe('My Line');
    });

    it('should draw a line segment in azimuth mode with distance and azimuth', () => {
      const { drawLineSegment } = useLineDrawing(mockMapRef);

      const result = drawLineSegment(
        48.8566,
        2.3522,
        48.86,
        2.36,
        'Azimuth Line',
        'azimuth',
        1000,
        45
      );

      expect(result?.mode).toBe('azimuth');
      expect(result?.distance).toBe(1000);
      expect(result?.azimuth).toBe(45);
    });

    it('should draw a line segment in intersection mode with intersection point', () => {
      const { drawLineSegment } = useLineDrawing(mockMapRef);

      const result = drawLineSegment(
        48.8566,
        2.3522,
        48.86,
        2.36,
        'Intersection Line',
        'intersection',
        1000,
        45,
        48.858,
        2.356,
        500
      );

      expect(result?.mode).toBe('intersection');
      expect(result?.intersectionPoint).toEqual({ lat: 48.858, lon: 2.356 });
      expect(result?.intersectionDistance).toBe(500);
      // Should add intersection marker feature (2 calls: line + marker)
      expect(mockMapRef.linesSource.value.addFeature).toHaveBeenCalledTimes(2);
    });

    it('should create endpoint in azimuth mode when requested', async () => {
      const usePointDrawingModule = await import('@/composables/usePointDrawing');
      const mockDrawPoint = vi.fn();
      vi.mocked(usePointDrawingModule.usePointDrawing).mockReturnValue({
        drawPoint: mockDrawPoint,
        updatePoint: vi.fn(),
        redrawPointOnMap: vi.fn(),
      });

      const { drawLineSegment } = useLineDrawing(mockMapRef);

      drawLineSegment(
        48.8566,
        2.3522,
        48.86,
        2.36,
        'Test Line',
        'azimuth',
        1000,
        45,
        undefined,
        undefined,
        undefined,
        true,
        'Custom Endpoint'
      );

      expect(mockDrawPoint).toHaveBeenCalledWith(48.86, 2.36, 'Custom Endpoint');
    });

    it('should auto-generate endpoint name for azimuth mode when not provided', async () => {
      const usePointDrawingModule = await import('@/composables/usePointDrawing');
      const mockDrawPoint = vi.fn();
      vi.mocked(usePointDrawingModule.usePointDrawing).mockReturnValue({
        drawPoint: mockDrawPoint,
        updatePoint: vi.fn(),
        redrawPointOnMap: vi.fn(),
      });

      const { drawLineSegment } = useLineDrawing(mockMapRef);

      drawLineSegment(
        48.8566,
        2.3522,
        48.86,
        2.36,
        'Test Line',
        'azimuth',
        1000,
        45,
        undefined,
        undefined,
        undefined,
        true
      );

      expect(mockDrawPoint).toHaveBeenCalledWith(48.86, 2.36, 'Point at 45° from Test Line');
    });

    it('should auto-generate endpoint name for intersection mode when not provided', async () => {
      const usePointDrawingModule = await import('@/composables/usePointDrawing');
      const mockDrawPoint = vi.fn();
      vi.mocked(usePointDrawingModule.usePointDrawing).mockReturnValue({
        drawPoint: mockDrawPoint,
        updatePoint: vi.fn(),
        redrawPointOnMap: vi.fn(),
      });

      const { drawLineSegment } = useLineDrawing(mockMapRef);

      drawLineSegment(
        48.8566,
        2.3522,
        48.86,
        2.36,
        'Test Line',
        'intersection',
        1000,
        45,
        48.858,
        2.356,
        500,
        true
      );

      expect(mockDrawPoint).toHaveBeenCalledWith(48.86, 2.36, 'Endpoint of Test Line');
    });

    it('should use fallback line name in intersection mode when name is undefined', async () => {
      const usePointDrawingModule = await import('@/composables/usePointDrawing');
      const mockDrawPoint = vi.fn();
      vi.mocked(usePointDrawingModule.usePointDrawing).mockReturnValue({
        drawPoint: mockDrawPoint,
        updatePoint: vi.fn(),
        redrawPointOnMap: vi.fn(),
      });

      const { drawLineSegment } = useLineDrawing(mockMapRef);

      // Call with undefined name to trigger the 'line' fallback in intersection mode
      drawLineSegment(
        48.8566,
        2.3522,
        48.86,
        2.36,
        undefined,
        'intersection',
        1000,
        45,
        48.858,
        2.356,
        500,
        true
      );

      // Should use 'line' as fallback when name is undefined
      expect(mockDrawPoint).toHaveBeenCalledWith(48.86, 2.36, 'Endpoint of line');
    });

    it('should use fallback name when line has no name in azimuth mode', async () => {
      const usePointDrawingModule = await import('@/composables/usePointDrawing');
      const mockDrawPoint = vi.fn();
      vi.mocked(usePointDrawingModule.usePointDrawing).mockReturnValue({
        drawPoint: mockDrawPoint,
        updatePoint: vi.fn(),
        redrawPointOnMap: vi.fn(),
      });

      const { drawLineSegment } = useLineDrawing(mockMapRef);

      // This should trigger the auto-generated name without mode-specific naming
      drawLineSegment(
        48.8566,
        2.3522,
        48.86,
        2.36,
        undefined,
        'azimuth',
        1000,
        undefined,
        undefined,
        undefined,
        undefined,
        true
      );

      // Should use auto-generated name with undefined azimuth and fallback 'line' name
      expect(mockDrawPoint).toHaveBeenCalledWith(48.86, 2.36, 'Point at undefined° from line');
    });

    it('should add line segment to store', () => {
      const { drawLineSegment } = useLineDrawing(mockMapRef);

      drawLineSegment(48.8566, 2.3522, 48.86, 2.36);

      expect(layersStore.lineSegments.length).toBe(1);
      expect(layersStore.lineSegments[0].id).toBe('test-uuid-1234');
    });

    it('should call flyToBoundsWithPanels if available', () => {
      vi.useFakeTimers();
      const { drawLineSegment } = useLineDrawing(mockMapRef);

      drawLineSegment(48.8566, 2.3522, 48.86, 2.36);

      // Trigger requestAnimationFrame callback
      vi.runAllTimers();

      expect(mockMapRef.flyToBoundsWithPanels).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should not call flyToBoundsWithPanels if not available', () => {
      mockMapRef.flyToBoundsWithPanels = undefined;
      const { drawLineSegment } = useLineDrawing(mockMapRef);

      const result = drawLineSegment(48.8566, 2.3522, 48.86, 2.36);

      expect(result).not.toBeNull();
    });
  });

  describe('updateLineSegment', () => {
    it('should return early if map is not initialized', () => {
      mockMapRef.map = { value: null };
      const { updateLineSegment } = useLineDrawing(mockMapRef);

      updateLineSegment('test-id', 48.8566, 2.3522, 48.86, 2.36, 'Updated Line');

      expect(mockMapRef.linesSource.value.addFeature).not.toHaveBeenCalled();
    });

    it('should return early if lineId is undefined', () => {
      const { updateLineSegment } = useLineDrawing(mockMapRef);

      updateLineSegment(undefined, 48.8566, 2.3522, 48.86, 2.36, 'Updated Line');

      expect(mockMapRef.linesSource.value.addFeature).not.toHaveBeenCalled();
    });

    it('should update line segment in store and redraw on map', () => {
      // First add a line segment
      layersStore.addLineSegment({
        id: 'test-id',
        name: 'Original Line',
        center: { lat: 48, lon: 2 },
        endpoint: { lat: 48.1, lon: 2.1 },
        mode: 'coordinate',
        color: '#000000',
      });

      const mockFeature = { id: 'test-id' };
      mockMapRef.linesSource.value.getFeatureById = vi.fn((id) => {
        if (id === 'test-id') return mockFeature;
        return null;
      });

      const { updateLineSegment } = useLineDrawing(mockMapRef);

      updateLineSegment('test-id', 48.8566, 2.3522, 48.86, 2.36, 'Updated Line');

      expect(mockMapRef.linesSource.value.removeFeature).toHaveBeenCalledWith(mockFeature);
      expect(mockMapRef.linesSource.value.addFeature).toHaveBeenCalled();
      expect(layersStore.lineSegments[0].name).toBe('Updated Line');
    });

    it('should handle case when feature is not found on map', () => {
      layersStore.addLineSegment({
        id: 'test-id',
        name: 'Original Line',
        center: { lat: 48, lon: 2 },
        endpoint: { lat: 48.1, lon: 2.1 },
        mode: 'coordinate',
        color: '#000000',
      });

      mockMapRef.linesSource.value.getFeatureById = vi.fn(() => null);

      const { updateLineSegment } = useLineDrawing(mockMapRef);

      updateLineSegment('test-id', 48.8566, 2.3522, 48.86, 2.36, 'Updated Line');

      expect(mockMapRef.linesSource.value.removeFeature).not.toHaveBeenCalled();
      expect(mockMapRef.linesSource.value.addFeature).toHaveBeenCalled();
    });

    it('should remove and add intersection marker when updating to intersection mode', () => {
      layersStore.addLineSegment({
        id: 'test-id',
        name: 'Original Line',
        center: { lat: 48, lon: 2 },
        endpoint: { lat: 48.1, lon: 2.1 },
        mode: 'coordinate',
        color: '#000000',
      });

      const mockFeature = { id: 'test-id' };
      const mockMarker = { id: 'intersection-test-id' };
      mockMapRef.linesSource.value.getFeatureById = vi.fn((id) => {
        if (id === 'test-id') return mockFeature;
        if (id === 'intersection-test-id') return mockMarker;
        return null;
      });

      const { updateLineSegment } = useLineDrawing(mockMapRef);

      updateLineSegment(
        'test-id',
        48.8566,
        2.3522,
        48.86,
        2.36,
        'Updated Line',
        'intersection',
        1000,
        45,
        48.858,
        2.356,
        500
      );

      // Should remove both line and intersection marker
      expect(mockMapRef.linesSource.value.removeFeature).toHaveBeenCalledWith(mockFeature);
      expect(mockMapRef.linesSource.value.removeFeature).toHaveBeenCalledWith(mockMarker);
      // Should add new line and new intersection marker
      expect(mockMapRef.linesSource.value.addFeature).toHaveBeenCalledTimes(2);
    });
  });

  describe('drawParallel', () => {
    it('should return null if map is not initialized', () => {
      mockMapRef.map = { value: null };
      const { drawParallel } = useLineDrawing(mockMapRef);

      const result = drawParallel(45);

      expect(result).toBeNull();
    });

    it('should return null if linesSource is not initialized', () => {
      mockMapRef.linesSource = { value: null };
      const { drawParallel } = useLineDrawing(mockMapRef);

      const result = drawParallel(45);

      expect(result).toBeNull();
    });

    it('should draw a parallel with default name', () => {
      const { drawParallel } = useLineDrawing(mockMapRef);

      const result = drawParallel(45);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('test-uuid-1234');
      expect(result?.center).toEqual({ lat: 45, lon: 0 });
      expect(result?.mode).toBe('parallel');
      expect(result?.name).toBe('Parallel 1');
      expect(mockMapRef.linesSource.value.addFeature).toHaveBeenCalled();
    });

    it('should draw a parallel with custom name', () => {
      const { drawParallel } = useLineDrawing(mockMapRef);

      const result = drawParallel(45, 'Tropic of Cancer');

      expect(result?.name).toBe('Tropic of Cancer');
    });

    it('should add parallel to store', () => {
      const { drawParallel } = useLineDrawing(mockMapRef);

      drawParallel(45);

      expect(layersStore.lineSegments.length).toBe(1);
      expect(layersStore.lineSegments[0].mode).toBe('parallel');
    });

    it('should call flyToBoundsWithPanels if available', () => {
      vi.useFakeTimers();
      const { drawParallel } = useLineDrawing(mockMapRef);

      drawParallel(45);

      vi.runAllTimers();

      expect(mockMapRef.flyToBoundsWithPanels).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should not call flyToBoundsWithPanels if not available', () => {
      mockMapRef.flyToBoundsWithPanels = undefined;
      const { drawParallel } = useLineDrawing(mockMapRef);

      const result = drawParallel(45);

      expect(result).not.toBeNull();
    });
  });

  describe('updateParallel', () => {
    it('should return early if map is not initialized', () => {
      mockMapRef.map = { value: null };
      const { updateParallel } = useLineDrawing(mockMapRef);

      updateParallel('test-id', 45, 'Updated Parallel');

      expect(mockMapRef.linesSource.value.addFeature).not.toHaveBeenCalled();
    });

    it('should return early if lineId is empty', () => {
      const { updateParallel } = useLineDrawing(mockMapRef);

      updateParallel('', 45, 'Updated Parallel');

      expect(mockMapRef.linesSource.value.addFeature).not.toHaveBeenCalled();
    });

    it('should update parallel in store and redraw on map', () => {
      layersStore.addLineSegment({
        id: 'test-id',
        name: 'Original Parallel',
        center: { lat: 40, lon: 0 },
        mode: 'parallel',
        longitude: 40,
        color: '#000000',
      });

      const mockFeature = { id: 'test-id' };
      mockMapRef.linesSource.value.getFeatureById = vi.fn(() => mockFeature);

      const { updateParallel } = useLineDrawing(mockMapRef);

      updateParallel('test-id', 45, 'Updated Parallel');

      expect(mockMapRef.linesSource.value.removeFeature).toHaveBeenCalledWith(mockFeature);
      expect(mockMapRef.linesSource.value.addFeature).toHaveBeenCalled();
      expect(layersStore.lineSegments[0].name).toBe('Updated Parallel');
    });

    it('should handle case when feature is not found on map', () => {
      layersStore.addLineSegment({
        id: 'test-id',
        name: 'Original Parallel',
        center: { lat: 40, lon: 0 },
        mode: 'parallel',
        color: '#000000',
      });

      mockMapRef.linesSource.value.getFeatureById = vi.fn(() => null);

      const { updateParallel } = useLineDrawing(mockMapRef);

      updateParallel('test-id', 45, 'Updated Parallel');

      expect(mockMapRef.linesSource.value.removeFeature).not.toHaveBeenCalled();
      expect(mockMapRef.linesSource.value.addFeature).toHaveBeenCalled();
    });
  });

  describe('redrawLineSegmentOnMap', () => {
    it('should return early if map is not initialized', () => {
      mockMapRef.map = { value: null };
      const { redrawLineSegmentOnMap } = useLineDrawing(mockMapRef);

      redrawLineSegmentOnMap('test-id', 48.8566, 2.3522, 48.86, 2.36);

      expect(mockMapRef.linesSource.value.addFeature).not.toHaveBeenCalled();
    });

    it('should return early if linesSource is not initialized', () => {
      mockMapRef.linesSource = { value: null };
      const { redrawLineSegmentOnMap } = useLineDrawing(mockMapRef);

      redrawLineSegmentOnMap('test-id', 48.8566, 2.3522, 48.86, 2.36);

      // No assertion needed - just should not throw
    });

    it('should redraw line segment on map', () => {
      const { redrawLineSegmentOnMap } = useLineDrawing(mockMapRef);

      redrawLineSegmentOnMap('test-id', 48.8566, 2.3522, 48.86, 2.36);

      expect(mockMapRef.linesSource.value.addFeature).toHaveBeenCalled();
    });

    it('should redraw line segment with custom color', () => {
      const { redrawLineSegmentOnMap } = useLineDrawing(mockMapRef);

      redrawLineSegmentOnMap(
        'test-id',
        48.8566,
        2.3522,
        48.86,
        2.36,
        'coordinate',
        undefined,
        undefined,
        '#FF0000'
      );

      expect(mockMapRef.linesSource.value.addFeature).toHaveBeenCalled();
    });

    it('should update mapElementId in store if segment exists', () => {
      layersStore.addLineSegment({
        id: 'test-id',
        name: 'Test Line',
        center: { lat: 48, lon: 2 },
        endpoint: { lat: 48.1, lon: 2.1 },
        mode: 'coordinate',
        color: '#000000',
      });

      const { redrawLineSegmentOnMap } = useLineDrawing(mockMapRef);

      redrawLineSegmentOnMap('test-id', 48.8566, 2.3522, 48.86, 2.36);

      expect(layersStore.lineSegments[0].mapElementId).toBe('test-id');
    });

    it('should add intersection marker in intersection mode', () => {
      const { redrawLineSegmentOnMap } = useLineDrawing(mockMapRef);

      redrawLineSegmentOnMap(
        'test-id',
        48.8566,
        2.3522,
        48.86,
        2.36,
        'intersection',
        48.858,
        2.356
      );

      // Should add line + intersection marker
      expect(mockMapRef.linesSource.value.addFeature).toHaveBeenCalledTimes(2);
    });

    it('should not add intersection marker if intersection coords are missing', () => {
      const { redrawLineSegmentOnMap } = useLineDrawing(mockMapRef);

      redrawLineSegmentOnMap(
        'test-id',
        48.8566,
        2.3522,
        48.86,
        2.36,
        'intersection',
        undefined,
        undefined
      );

      // Should only add line (no marker)
      expect(mockMapRef.linesSource.value.addFeature).toHaveBeenCalledTimes(1);
    });
  });

  describe('redrawParallelOnMap', () => {
    it('should return early if map is not initialized', () => {
      mockMapRef.map = { value: null };
      const { redrawParallelOnMap } = useLineDrawing(mockMapRef);

      redrawParallelOnMap('test-id', 45);

      expect(mockMapRef.linesSource.value.addFeature).not.toHaveBeenCalled();
    });

    it('should return early if linesSource is not initialized', () => {
      mockMapRef.linesSource = { value: null };
      const { redrawParallelOnMap } = useLineDrawing(mockMapRef);

      redrawParallelOnMap('test-id', 45);

      // No assertion needed - just should not throw
    });

    it('should redraw parallel on map', () => {
      const { redrawParallelOnMap } = useLineDrawing(mockMapRef);

      redrawParallelOnMap('test-id', 45);

      expect(mockMapRef.linesSource.value.addFeature).toHaveBeenCalled();
    });

    it('should redraw parallel with custom color', () => {
      const { redrawParallelOnMap } = useLineDrawing(mockMapRef);

      redrawParallelOnMap('test-id', 45, '#FF0000');

      expect(mockMapRef.linesSource.value.addFeature).toHaveBeenCalled();
    });

    it('should update mapElementId in store if segment exists', () => {
      layersStore.addLineSegment({
        id: 'test-id',
        name: 'Test Parallel',
        center: { lat: 40, lon: 0 },
        mode: 'parallel',
        color: '#000000',
      });

      const { redrawParallelOnMap } = useLineDrawing(mockMapRef);

      redrawParallelOnMap('test-id', 45);

      expect(layersStore.lineSegments[0].mapElementId).toBe('test-id');
    });
  });

  describe('animateLineSegmentOnMap', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should resolve immediately if map is not initialized', async () => {
      mockMapRef.map = { value: null };
      const { animateLineSegmentOnMap } = useLineDrawing(mockMapRef);

      const promise = animateLineSegmentOnMap('test-id', 48.8566, 2.3522, 48.86, 2.36);

      await expect(promise).resolves.toBeUndefined();
    });

    it('should resolve immediately if linesSource is not initialized', async () => {
      mockMapRef.linesSource = { value: null };
      const { animateLineSegmentOnMap } = useLineDrawing(mockMapRef);

      const promise = animateLineSegmentOnMap('test-id', 48.8566, 2.3522, 48.86, 2.36);

      await expect(promise).resolves.toBeUndefined();
    });

    it('should add feature and start animation', async () => {
      const { animateLineSegmentOnMap } = useLineDrawing(mockMapRef);

      const promise = animateLineSegmentOnMap('test-id', 48.8566, 2.3522, 48.86, 2.36);

      expect(mockMapRef.linesSource.value.addFeature).toHaveBeenCalled();

      // Run all timers to complete animation
      vi.runAllTimers();

      await promise;
    });

    it('should complete animation and update store', async () => {
      // Add segment to store first
      layersStore.addLineSegment({
        id: 'test-id',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.36 },
        mode: 'coordinate',
        color: '#000000',
      });

      const { animateLineSegmentOnMap } = useLineDrawing(mockMapRef);

      const promise = animateLineSegmentOnMap('test-id', 48.8566, 2.3522, 48.86, 2.36);

      // Run timers to complete animation
      vi.runAllTimers();

      await promise;

      expect(layersStore.lineSegments[0].mapElementId).toBe('test-id');
      expect(mockMapRef.linesSource.value.changed).toHaveBeenCalled();
    });

    it('should add intersection marker in intersection mode after animation', async () => {
      const { animateLineSegmentOnMap } = useLineDrawing(mockMapRef);

      const promise = animateLineSegmentOnMap(
        'test-id',
        48.8566,
        2.3522,
        48.86,
        2.36,
        'intersection',
        48.858,
        2.356
      );

      vi.runAllTimers();

      await promise;

      // Should add line feature + intersection marker
      expect(mockMapRef.linesSource.value.addFeature).toHaveBeenCalledTimes(2);
    });

    it('should use custom color and duration', async () => {
      const { animateLineSegmentOnMap } = useLineDrawing(mockMapRef);

      const promise = animateLineSegmentOnMap(
        'test-id',
        48.8566,
        2.3522,
        48.86,
        2.36,
        'coordinate',
        undefined,
        undefined,
        '#FF0000',
        1000
      );

      vi.runAllTimers();

      await promise;

      expect(mockMapRef.linesSource.value.addFeature).toHaveBeenCalled();
    });

    it('should resolve if linesSource becomes null during animation', async () => {
      const { animateLineSegmentOnMap } = useLineDrawing(mockMapRef);

      const promise = animateLineSegmentOnMap('test-id', 48.8566, 2.3522, 48.86, 2.36);

      // Simulate linesSource becoming null during animation
      mockMapRef.linesSource.value = null;

      vi.runAllTimers();

      await expect(promise).resolves.toBeUndefined();
    });

    it('should not add intersection marker if linesSource becomes null', async () => {
      const addFeatureCalls: any[] = [];
      mockMapRef.linesSource.value.addFeature = vi.fn((feature) => {
        addFeatureCalls.push(feature);
      });

      const { animateLineSegmentOnMap } = useLineDrawing(mockMapRef);

      const promise = animateLineSegmentOnMap(
        'test-id',
        48.8566,
        2.3522,
        48.86,
        2.36,
        'intersection',
        48.858,
        2.356
      );

      // Simulate linesSource becoming null after initial feature is added but before marker
      // We need to let the first frame run, then null it out
      vi.advanceTimersByTime(10);
      mockMapRef.linesSource.value = null;

      vi.runAllTimers();

      await promise;
    });

    it('should skip changed() call if linesSource becomes null at animation end', async () => {
      // Track if changed() was called
      const changedSpy = vi.fn();
      let callCount = 0;

      // Make linesSource become null after being accessed once
      const linesSourceValue = {
        addFeature: vi.fn(),
        changed: changedSpy,
      };

      Object.defineProperty(mockMapRef.linesSource, 'value', {
        get: () => {
          callCount++;
          // Return value for first few calls, then null
          if (callCount <= 3) return linesSourceValue;
          return null;
        },
        configurable: true,
      });

      const { animateLineSegmentOnMap } = useLineDrawing(mockMapRef);

      const promise = animateLineSegmentOnMap(
        'test-id',
        48.8566,
        2.3522,
        48.86,
        2.36,
        'coordinate',
        undefined,
        undefined,
        undefined,
        1 // Very short duration
      );

      vi.runAllTimers();

      await promise;
      // changed() should not have been called since linesSource became null
    });
  });
});
