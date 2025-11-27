import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useDrawing } from '@/composables/useDrawing';
import { useLayersStore } from '@/stores/layers';

// Mock functions for the drawing composables
const mockDrawCircle = vi.fn();
const mockUpdateCircle = vi.fn();
const mockRedrawCircleOnMap = vi.fn();

const mockDrawLineSegment = vi.fn();
const mockUpdateLineSegment = vi.fn();
const mockDrawParallel = vi.fn();
const mockUpdateParallel = vi.fn();
const mockRedrawLineSegmentOnMap = vi.fn();
const mockRedrawParallelOnMap = vi.fn();
const mockAnimateLineSegmentOnMap = vi.fn();

const mockDrawPoint = vi.fn();
const mockRedrawPointOnMap = vi.fn();

const mockDrawPolygon = vi.fn();
const mockRedrawPolygonOnMap = vi.fn();

// Mock the drawing composables
vi.mock('@/composables/useCircleDrawing', () => ({
  useCircleDrawing: vi.fn(function () {
    return {
      drawCircle: mockDrawCircle,
      updateCircle: mockUpdateCircle,
      redrawCircleOnMap: mockRedrawCircleOnMap,
    };
  }),
}));

vi.mock('@/composables/useLineDrawing', () => ({
  useLineDrawing: vi.fn(function () {
    return {
      drawLineSegment: mockDrawLineSegment,
      updateLineSegment: mockUpdateLineSegment,
      drawParallel: mockDrawParallel,
      updateParallel: mockUpdateParallel,
      redrawLineSegmentOnMap: mockRedrawLineSegmentOnMap,
      redrawParallelOnMap: mockRedrawParallelOnMap,
      animateLineSegmentOnMap: mockAnimateLineSegmentOnMap,
    };
  }),
}));

vi.mock('@/composables/usePointDrawing', () => ({
  usePointDrawing: vi.fn(function () {
    return {
      drawPoint: mockDrawPoint,
      redrawPointOnMap: mockRedrawPointOnMap,
    };
  }),
}));

vi.mock('@/composables/usePolygonDrawing', () => ({
  usePolygonDrawing: vi.fn(function () {
    return {
      drawPolygon: mockDrawPolygon,
      redrawPolygonOnMap: mockRedrawPolygonOnMap,
    };
  }),
}));

describe('useDrawing', () => {
  let layersStore: ReturnType<typeof useLayersStore>;
  let mockMapRef: any;
  let drawing: ReturnType<typeof useDrawing>;
  let mockRemoveFeature: ReturnType<typeof vi.fn>;
  let mockGetFeatureById: ReturnType<typeof vi.fn>;
  let mockClear: ReturnType<typeof vi.fn>;
  let mockRemoveOverlay: ReturnType<typeof vi.fn>;
  let overlaysArray: any[];

  beforeEach(() => {
    setActivePinia(createPinia());
    layersStore = useLayersStore();

    // Reset all mocks
    vi.clearAllMocks();

    mockRemoveFeature = vi.fn();
    mockGetFeatureById = vi.fn();
    mockClear = vi.fn();
    mockRemoveOverlay = vi.fn();
    overlaysArray = [];

    mockMapRef = {
      map: ref({
        getOverlays: vi.fn(function () {
          return {
            getArray: vi.fn(function () {
              return overlaysArray;
            }),
          };
        }),
        removeOverlay: mockRemoveOverlay,
      }),
      circlesSource: ref({
        removeFeature: mockRemoveFeature,
        getFeatureById: mockGetFeatureById,
        addFeature: vi.fn(),
        clear: mockClear,
      }),
      linesSource: ref({
        removeFeature: mockRemoveFeature,
        getFeatureById: mockGetFeatureById,
        addFeature: vi.fn(),
        clear: mockClear,
      }),
      pointsSource: ref({
        removeFeature: mockRemoveFeature,
        getFeatureById: mockGetFeatureById,
        addFeature: vi.fn(),
        clear: mockClear,
      }),
      polygonsSource: ref({
        removeFeature: mockRemoveFeature,
        getFeatureById: mockGetFeatureById,
        addFeature: vi.fn(),
        clear: mockClear,
      }),
      flyToBoundsWithPanels: vi.fn(),
    };

    drawing = useDrawing(mockMapRef);
  });

  describe('initialization', () => {
    it('should expose all drawing methods from sub-composables', () => {
      expect(drawing.drawCircle).toBe(mockDrawCircle);
      expect(drawing.updateCircle).toBe(mockUpdateCircle);
      expect(drawing.drawLineSegment).toBe(mockDrawLineSegment);
      expect(drawing.updateLineSegment).toBe(mockUpdateLineSegment);
      expect(drawing.drawParallel).toBe(mockDrawParallel);
      expect(drawing.updateParallel).toBe(mockUpdateParallel);
      expect(drawing.drawPoint).toBe(mockDrawPoint);
      expect(drawing.drawPolygon).toBe(mockDrawPolygon);
    });

    it('should expose utility methods', () => {
      expect(typeof drawing.updateElementVisibility).toBe('function');
      expect(typeof drawing.deleteElement).toBe('function');
      expect(typeof drawing.clearAllElements).toBe('function');
      expect(typeof drawing.redrawAllElements).toBe('function');
    });
  });

  describe('updateElementVisibility', () => {
    it('should do nothing if map is null', async () => {
      mockMapRef.map = ref(null);
      drawing = useDrawing(mockMapRef);

      await drawing.updateElementVisibility('circle', 'circle-1', true);

      expect(mockGetFeatureById).not.toHaveBeenCalled();
    });

    it('should do nothing if elementId is undefined', async () => {
      await drawing.updateElementVisibility('circle', undefined, true);

      expect(mockGetFeatureById).not.toHaveBeenCalled();
    });

    it('should do nothing for unknown element type', async () => {
      await drawing.updateElementVisibility('unknown', 'elem-1', true);

      expect(mockGetFeatureById).not.toHaveBeenCalled();
    });

    it('should remove circle feature when hiding visible element', async () => {
      const mockFeature = { getId: () => 'circle-1' };
      mockGetFeatureById.mockReturnValue(mockFeature);

      await drawing.updateElementVisibility('circle', 'circle-1', false);

      expect(mockGetFeatureById).toHaveBeenCalledWith('circle-1');
      expect(mockRemoveFeature).toHaveBeenCalledWith(mockFeature);
    });

    it('should remove lineSegment feature when hiding visible element', async () => {
      const mockFeature = { getId: () => 'line-1' };
      mockGetFeatureById.mockReturnValue(mockFeature);

      await drawing.updateElementVisibility('lineSegment', 'line-1', false);

      expect(mockGetFeatureById).toHaveBeenCalledWith('line-1');
      expect(mockRemoveFeature).toHaveBeenCalledWith(mockFeature);
    });

    it('should remove point feature and label overlay when hiding visible point', async () => {
      const mockFeature = { getId: () => 'point-1' };
      const mockLabelOverlay = { get: (key: string) => (key === 'id' ? 'label-point-1' : null) };
      overlaysArray = [mockLabelOverlay];
      mockGetFeatureById.mockReturnValue(mockFeature);

      await drawing.updateElementVisibility('point', 'point-1', false);

      expect(mockGetFeatureById).toHaveBeenCalledWith('point-1');
      expect(mockRemoveFeature).toHaveBeenCalledWith(mockFeature);
      expect(mockRemoveOverlay).toHaveBeenCalledWith(mockLabelOverlay);
    });

    it('should remove polygon feature when hiding visible element', async () => {
      const mockFeature = { getId: () => 'polygon-1' };
      mockGetFeatureById.mockReturnValue(mockFeature);

      await drawing.updateElementVisibility('polygon', 'polygon-1', false);

      expect(mockGetFeatureById).toHaveBeenCalledWith('polygon-1');
      expect(mockRemoveFeature).toHaveBeenCalledWith(mockFeature);
    });

    it('should redraw circle when showing hidden element', async () => {
      mockGetFeatureById.mockReturnValue(null);
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Test Circle',
        center: { lat: 48.8566, lon: 2.3522 },
        radius: 1000,
        color: '#ff0000',
      });

      await drawing.updateElementVisibility('circle', 'circle-1', true);

      expect(mockRedrawCircleOnMap).toHaveBeenCalledWith(
        'circle-1',
        48.8566,
        2.3522,
        1000,
        '#ff0000'
      );
    });

    it('should redraw point when showing hidden element', async () => {
      mockGetFeatureById.mockReturnValue(null);
      layersStore.addPoint({
        id: 'point-1',
        name: 'Test Point',
        coordinates: { lat: 48.8566, lon: 2.3522 },
        color: '#00ff00',
      });

      await drawing.updateElementVisibility('point', 'point-1', true);

      expect(mockRedrawPointOnMap).toHaveBeenCalledWith('point-1', 48.8566, 2.3522, '#00ff00');
    });

    it('should redraw polygon when showing hidden element', async () => {
      mockGetFeatureById.mockReturnValue(null);
      layersStore.addPolygon({
        id: 'polygon-1',
        name: 'Test Polygon',
        pointIds: ['p1', 'p2', 'p3'],
        color: '#0000ff',
      });

      await drawing.updateElementVisibility('polygon', 'polygon-1', true);

      expect(mockRedrawPolygonOnMap).toHaveBeenCalledWith(
        'polygon-1',
        ['p1', 'p2', 'p3'],
        '#0000ff'
      );
    });

    it('should redraw parallel line when showing hidden element', async () => {
      mockGetFeatureById.mockReturnValue(null);
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Test Parallel',
        center: { lat: 48.8566, lon: 2.3522 },
        mode: 'parallel',
        longitude: 45.5,
        color: '#ff00ff',
      });

      await drawing.updateElementVisibility('lineSegment', 'line-1', true);

      expect(mockRedrawParallelOnMap).toHaveBeenCalledWith('line-1', 45.5, '#ff00ff');
    });

    it('should redraw regular line segment when showing hidden element without animation', async () => {
      mockGetFeatureById.mockReturnValue(null);
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.9, lon: 2.4 },
        mode: 'coordinate',
        color: '#ff00ff',
      });

      await drawing.updateElementVisibility('lineSegment', 'line-1', true, false);

      expect(mockRedrawLineSegmentOnMap).toHaveBeenCalledWith(
        'line-1',
        48.8566,
        2.3522,
        48.9,
        2.4,
        'coordinate',
        undefined,
        undefined,
        '#ff00ff'
      );
    });

    it('should animate line segment when showing hidden element with animation', async () => {
      mockGetFeatureById.mockReturnValue(null);
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.9, lon: 2.4 },
        mode: 'azimuth',
        intersectionPoint: { lat: 48.85, lon: 2.36 },
        color: '#ff00ff',
      });

      await drawing.updateElementVisibility('lineSegment', 'line-1', true, true);

      expect(mockAnimateLineSegmentOnMap).toHaveBeenCalledWith(
        'line-1',
        48.8566,
        2.3522,
        48.9,
        2.4,
        'azimuth',
        48.85,
        2.36,
        '#ff00ff'
      );
    });

    it('should remove intersection marker when hiding lineSegment', async () => {
      const mockLineFeature = { getId: () => 'line-1' };
      const mockIntersectionFeature = { getId: () => 'intersection-line-1' };
      mockGetFeatureById.mockImplementation((id: string) => {
        if (id === 'line-1') return mockLineFeature;
        if (id === 'intersection-line-1') return mockIntersectionFeature;
        return null;
      });

      await drawing.updateElementVisibility('lineSegment', 'line-1', false);

      expect(mockGetFeatureById).toHaveBeenCalledWith('intersection-line-1');
      expect(mockRemoveFeature).toHaveBeenCalledWith(mockIntersectionFeature);
    });

    it('should not fail when circle not found in store for redraw', async () => {
      mockGetFeatureById.mockReturnValue(null);
      // No element added to store

      await drawing.updateElementVisibility('circle', 'nonexistent', true);

      expect(mockRedrawCircleOnMap).not.toHaveBeenCalled();
    });

    it('should not fail when lineSegment not found in store for redraw', async () => {
      mockGetFeatureById.mockReturnValue(null);
      // No element added to store

      await drawing.updateElementVisibility('lineSegment', 'nonexistent', true);

      expect(mockRedrawLineSegmentOnMap).not.toHaveBeenCalled();
      expect(mockRedrawParallelOnMap).not.toHaveBeenCalled();
    });

    it('should not fail when point not found in store for redraw', async () => {
      mockGetFeatureById.mockReturnValue(null);
      // No element added to store

      await drawing.updateElementVisibility('point', 'nonexistent', true);

      expect(mockRedrawPointOnMap).not.toHaveBeenCalled();
    });

    it('should not fail when polygon not found in store for redraw', async () => {
      mockGetFeatureById.mockReturnValue(null);
      // No element added to store

      await drawing.updateElementVisibility('polygon', 'nonexistent', true);

      expect(mockRedrawPolygonOnMap).not.toHaveBeenCalled();
    });

    it('should not fail when element has no id for redraw', async () => {
      mockGetFeatureById.mockReturnValue(null);
      // Add element without id
      layersStore.circles.push({
        id: undefined as any,
        name: 'No ID Circle',
        center: { lat: 48.8566, lon: 2.3522 },
        radius: 1000,
      });

      await drawing.updateElementVisibility('circle', 'some-id', true);

      expect(mockRedrawCircleOnMap).not.toHaveBeenCalled();
    });

    it('should not remove feature if not found when hiding', async () => {
      mockGetFeatureById.mockReturnValue(null);

      await drawing.updateElementVisibility('circle', 'nonexistent', false);

      expect(mockRemoveFeature).not.toHaveBeenCalled();
    });

    it('should not redraw if feature already exists when showing', async () => {
      const mockFeature = { getId: () => 'circle-1' };
      mockGetFeatureById.mockReturnValue(mockFeature);
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Test Circle',
        center: { lat: 48.8566, lon: 2.3522 },
        radius: 1000,
      });

      await drawing.updateElementVisibility('circle', 'circle-1', true);

      expect(mockRedrawCircleOnMap).not.toHaveBeenCalled();
    });
  });

  describe('deleteElement', () => {
    it('should do nothing if map is null', () => {
      mockMapRef.map = ref(null);
      drawing = useDrawing(mockMapRef);

      drawing.deleteElement('circle', 'circle-1');

      expect(mockGetFeatureById).not.toHaveBeenCalled();
    });

    it('should do nothing if elementId is undefined', () => {
      drawing.deleteElement('circle', undefined);

      expect(mockGetFeatureById).not.toHaveBeenCalled();
    });

    it('should delete circle from map and store', () => {
      const mockFeature = { getId: () => 'circle-1' };
      mockGetFeatureById.mockReturnValue(mockFeature);
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Test Circle',
        center: { lat: 48.8566, lon: 2.3522 },
        radius: 1000,
      });

      drawing.deleteElement('circle', 'circle-1');

      expect(mockGetFeatureById).toHaveBeenCalledWith('circle-1');
      expect(mockRemoveFeature).toHaveBeenCalledWith(mockFeature);
      expect(layersStore.circles.find((c) => c.id === 'circle-1')).toBeUndefined();
    });

    it('should delete lineSegment and intersection marker from map and store', () => {
      const mockLineFeature = { getId: () => 'line-1' };
      const mockIntersectionFeature = { getId: () => 'intersection-line-1' };
      mockGetFeatureById.mockImplementation((id: string) => {
        if (id === 'line-1') return mockLineFeature;
        if (id === 'intersection-line-1') return mockIntersectionFeature;
        return null;
      });
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.9, lon: 2.4 },
        mode: 'intersection',
      });

      drawing.deleteElement('lineSegment', 'line-1');

      expect(mockGetFeatureById).toHaveBeenCalledWith('line-1');
      expect(mockGetFeatureById).toHaveBeenCalledWith('intersection-line-1');
      expect(mockRemoveFeature).toHaveBeenCalledWith(mockLineFeature);
      expect(mockRemoveFeature).toHaveBeenCalledWith(mockIntersectionFeature);
      expect(layersStore.lineSegments.find((l) => l.id === 'line-1')).toBeUndefined();
    });

    it('should delete point with label overlay from map and store', () => {
      const mockFeature = { getId: () => 'point-1' };
      const mockLabelOverlay = { get: (key: string) => (key === 'id' ? 'label-point-1' : null) };
      overlaysArray = [mockLabelOverlay];
      mockGetFeatureById.mockReturnValue(mockFeature);
      layersStore.addPoint({
        id: 'point-1',
        name: 'Test Point',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      });

      drawing.deleteElement('point', 'point-1');

      expect(mockGetFeatureById).toHaveBeenCalledWith('point-1');
      expect(mockRemoveFeature).toHaveBeenCalledWith(mockFeature);
      expect(mockRemoveOverlay).toHaveBeenCalledWith(mockLabelOverlay);
      expect(layersStore.points.find((p) => p.id === 'point-1')).toBeUndefined();
    });

    it('should delete polygon from map and store', () => {
      const mockFeature = { getId: () => 'polygon-1' };
      mockGetFeatureById.mockReturnValue(mockFeature);
      layersStore.addPolygon({
        id: 'polygon-1',
        name: 'Test Polygon',
        pointIds: ['p1', 'p2', 'p3'],
      });

      drawing.deleteElement('polygon', 'polygon-1');

      expect(mockGetFeatureById).toHaveBeenCalledWith('polygon-1');
      expect(mockRemoveFeature).toHaveBeenCalledWith(mockFeature);
      expect(layersStore.polygons.find((p) => p.id === 'polygon-1')).toBeUndefined();
    });

    it('should delete linked notes when deleting element', () => {
      const mockFeature = { getId: () => 'circle-1' };
      mockGetFeatureById.mockReturnValue(mockFeature);
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Test Circle',
        center: { lat: 48.8566, lon: 2.3522 },
        radius: 1000,
      });
      layersStore.addNote({
        id: 'note-1',
        content: 'Test note',
        coordinates: { lat: 48.8566, lon: 2.3522 },
        linkedElementType: 'circle',
        linkedElementId: 'circle-1',
      });

      drawing.deleteElement('circle', 'circle-1');

      expect(layersStore.notes.find((n) => n.id === 'note-1')).toBeUndefined();
    });

    it('should handle feature not found gracefully', () => {
      mockGetFeatureById.mockReturnValue(null);
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Test Circle',
        center: { lat: 48.8566, lon: 2.3522 },
        radius: 1000,
      });

      drawing.deleteElement('circle', 'circle-1');

      expect(mockRemoveFeature).not.toHaveBeenCalled();
      // Store should still be updated
      expect(layersStore.circles.find((c) => c.id === 'circle-1')).toBeUndefined();
    });

    it('should cascade delete polygons when point with 3-point polygon is deleted', () => {
      // Setup points and polygon
      layersStore.addPoint({
        id: 'p1',
        name: 'Point 1',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      });
      layersStore.addPoint({
        id: 'p2',
        name: 'Point 2',
        coordinates: { lat: 48.8606, lon: 2.3522 },
      });
      layersStore.addPoint({
        id: 'p3',
        name: 'Point 3',
        coordinates: { lat: 48.8606, lon: 2.3562 },
      });
      layersStore.addPolygon({
        id: 'poly1',
        name: 'Polygon 1',
        pointIds: ['p1', 'p2', 'p3'],
      });

      mockGetFeatureById.mockImplementation((id: string) => {
        if (['p1', 'poly1'].includes(id)) {
          return { getId: () => id };
        }
        return null;
      });

      drawing.deleteElement('point', 'p1');

      expect(mockGetFeatureById).toHaveBeenCalledWith('poly1');
      expect(layersStore.polygons.find((p) => p.id === 'poly1')).toBeUndefined();
    });

    it('should redraw polygon when point is deleted but 3+ points remain', () => {
      // Setup 4 points and polygon
      layersStore.addPoint({
        id: 'p1',
        name: 'Point 1',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      });
      layersStore.addPoint({
        id: 'p2',
        name: 'Point 2',
        coordinates: { lat: 48.8606, lon: 2.3522 },
      });
      layersStore.addPoint({
        id: 'p3',
        name: 'Point 3',
        coordinates: { lat: 48.8606, lon: 2.3562 },
      });
      layersStore.addPoint({
        id: 'p4',
        name: 'Point 4',
        coordinates: { lat: 48.8566, lon: 2.3562 },
      });
      layersStore.addPolygon({
        id: 'poly1',
        name: 'Polygon 1',
        pointIds: ['p1', 'p2', 'p3', 'p4'],
      });

      mockGetFeatureById.mockImplementation((id: string) => {
        if (['p1', 'poly1'].includes(id)) {
          return { getId: () => id };
        }
        return null;
      });

      drawing.deleteElement('point', 'p1');

      expect(mockRedrawPolygonOnMap).toHaveBeenCalled();
      const polygon = layersStore.polygons.find((p) => p.id === 'poly1');
      expect(polygon?.pointIds).toEqual(['p2', 'p3', 'p4']);
    });

    it('should handle point without polygonIds gracefully', () => {
      layersStore.addPoint({
        id: 'p1',
        name: 'Point 1',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      });
      // Manually remove polygonIds
      const point = layersStore.points.find((p) => p.id === 'p1');
      if (point) {
        delete (point as any).polygonIds;
      }

      mockGetFeatureById.mockReturnValue({ getId: () => 'p1' });

      expect(() => drawing.deleteElement('point', 'p1')).not.toThrow();
    });
  });

  describe('clearAllElements', () => {
    it('should clear all layers in store', () => {
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Test Circle',
        center: { lat: 48.8566, lon: 2.3522 },
        radius: 1000,
      });

      drawing.clearAllElements();

      expect(layersStore.circles).toHaveLength(0);
    });

    it('should clear all vector sources', () => {
      drawing.clearAllElements();

      expect(mockClear).toHaveBeenCalledTimes(4); // circles, lines, points, polygons
    });

    it('should remove all overlays', () => {
      const overlay1 = { get: () => 'label-1' };
      const overlay2 = { get: () => 'label-2' };
      overlaysArray = [overlay1, overlay2];

      drawing.clearAllElements();

      expect(mockRemoveOverlay).toHaveBeenCalledWith(overlay1);
      expect(mockRemoveOverlay).toHaveBeenCalledWith(overlay2);
    });

    it('should handle null sources gracefully', () => {
      mockMapRef.circlesSource = ref(null);
      mockMapRef.linesSource = ref(null);
      drawing = useDrawing(mockMapRef);

      expect(() => drawing.clearAllElements()).not.toThrow();
    });

    it('should handle null map gracefully', () => {
      mockMapRef.map = ref(null);
      drawing = useDrawing(mockMapRef);

      expect(() => drawing.clearAllElements()).not.toThrow();
    });
  });

  describe('redrawAllElements', () => {
    it('should clear all sources before redrawing', () => {
      drawing.redrawAllElements();

      expect(mockClear).toHaveBeenCalledTimes(4);
    });

    it('should remove all overlays before redrawing', () => {
      const overlay1 = { get: () => 'label-1' };
      overlaysArray = [overlay1];

      drawing.redrawAllElements();

      expect(mockRemoveOverlay).toHaveBeenCalledWith(overlay1);
    });

    it('should redraw all circles from store', () => {
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Test Circle',
        center: { lat: 48.8566, lon: 2.3522 },
        radius: 1000,
        color: '#ff0000',
      });
      layersStore.addCircle({
        id: 'circle-2',
        name: 'Test Circle 2',
        center: { lat: 49, lon: 2.5 },
        radius: 2000,
        color: '#00ff00',
      });

      drawing.redrawAllElements();

      expect(mockRedrawCircleOnMap).toHaveBeenCalledWith(
        'circle-1',
        48.8566,
        2.3522,
        1000,
        '#ff0000'
      );
      expect(mockRedrawCircleOnMap).toHaveBeenCalledWith('circle-2', 49, 2.5, 2000, '#00ff00');
    });

    it('should redraw parallel lines from store', () => {
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Test Parallel',
        center: { lat: 48.8566, lon: 2.3522 },
        mode: 'parallel',
        longitude: 45.5,
        color: '#ff00ff',
      });

      drawing.redrawAllElements();

      expect(mockRedrawParallelOnMap).toHaveBeenCalledWith('line-1', 45.5, '#ff00ff');
    });

    it('should redraw regular line segments from store', () => {
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.9, lon: 2.4 },
        mode: 'coordinate',
        color: '#ff00ff',
      });

      drawing.redrawAllElements();

      expect(mockRedrawLineSegmentOnMap).toHaveBeenCalledWith(
        'line-1',
        48.8566,
        2.3522,
        48.9,
        2.4,
        'coordinate',
        undefined,
        undefined,
        '#ff00ff'
      );
    });

    it('should redraw line segments with intersection points from store', () => {
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.9, lon: 2.4 },
        mode: 'intersection',
        intersectionPoint: { lat: 48.85, lon: 2.36 },
        color: '#ff00ff',
      });

      drawing.redrawAllElements();

      expect(mockRedrawLineSegmentOnMap).toHaveBeenCalledWith(
        'line-1',
        48.8566,
        2.3522,
        48.9,
        2.4,
        'intersection',
        48.85,
        2.36,
        '#ff00ff'
      );
    });

    it('should redraw all points from store', () => {
      layersStore.addPoint({
        id: 'point-1',
        name: 'Test Point',
        coordinates: { lat: 48.8566, lon: 2.3522 },
        color: '#00ff00',
      });

      drawing.redrawAllElements();

      expect(mockRedrawPointOnMap).toHaveBeenCalledWith('point-1', 48.8566, 2.3522, '#00ff00');
    });

    it('should redraw all polygons from store', () => {
      layersStore.addPolygon({
        id: 'polygon-1',
        name: 'Test Polygon',
        pointIds: ['p1', 'p2', 'p3'],
        color: '#0000ff',
      });

      drawing.redrawAllElements();

      expect(mockRedrawPolygonOnMap).toHaveBeenCalledWith(
        'polygon-1',
        ['p1', 'p2', 'p3'],
        '#0000ff'
      );
    });

    it('should skip circles without id', () => {
      layersStore.circles.push({
        id: undefined as any,
        name: 'No ID',
        center: { lat: 48.8566, lon: 2.3522 },
        radius: 1000,
      });

      drawing.redrawAllElements();

      expect(mockRedrawCircleOnMap).not.toHaveBeenCalled();
    });

    it('should skip line segments without id', () => {
      layersStore.lineSegments.push({
        id: undefined as any,
        name: 'No ID',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.9, lon: 2.4 },
        mode: 'coordinate',
      });

      drawing.redrawAllElements();

      expect(mockRedrawLineSegmentOnMap).not.toHaveBeenCalled();
      expect(mockRedrawParallelOnMap).not.toHaveBeenCalled();
    });

    it('should skip points without id', () => {
      layersStore.points.push({
        id: undefined as any,
        name: 'No ID',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      });

      drawing.redrawAllElements();

      expect(mockRedrawPointOnMap).not.toHaveBeenCalled();
    });

    it('should skip polygons without id', () => {
      layersStore.polygons.push({
        id: undefined as any,
        name: 'No ID',
        pointIds: ['p1', 'p2', 'p3'],
      });

      drawing.redrawAllElements();

      expect(mockRedrawPolygonOnMap).not.toHaveBeenCalled();
    });

    it('should skip line segments without endpoint for non-parallel mode', () => {
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        mode: 'coordinate',
        // No endpoint
      });

      drawing.redrawAllElements();

      expect(mockRedrawLineSegmentOnMap).not.toHaveBeenCalled();
    });

    it('should call flyToBoundsWithPanels when elements exist', () => {
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Test Circle',
        center: { lat: 48.8566, lon: 2.3522 },
        radius: 1000,
      });

      drawing.redrawAllElements();

      expect(mockMapRef.flyToBoundsWithPanels).toHaveBeenCalled();
    });

    it('should calculate correct bounds including circle radius', () => {
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Test Circle',
        center: { lat: 48.8566, lon: 2.3522 },
        radius: 111, // 1 degree
      });

      drawing.redrawAllElements();

      const callArgs = mockMapRef.flyToBoundsWithPanels.mock.calls[0][0];
      // minLat should be ~47.8566, maxLat should be ~49.8566
      expect(callArgs[0][0]).toBeCloseTo(47.8566, 1);
      expect(callArgs[1][0]).toBeCloseTo(49.8566, 1);
    });

    it('should calculate bounds for line segments', () => {
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.9, lon: 2.4 },
        mode: 'coordinate',
      });

      drawing.redrawAllElements();

      const callArgs = mockMapRef.flyToBoundsWithPanels.mock.calls[0][0];
      expect(callArgs[0][0]).toBeCloseTo(48.8566, 4); // minLat
      expect(callArgs[1][0]).toBeCloseTo(48.9, 4); // maxLat
    });

    it('should calculate bounds for points', () => {
      layersStore.addPoint({
        id: 'point-1',
        name: 'Test Point',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      });

      drawing.redrawAllElements();

      const callArgs = mockMapRef.flyToBoundsWithPanels.mock.calls[0][0];
      expect(callArgs[0][0]).toBeCloseTo(48.8566, 4);
      expect(callArgs[1][0]).toBeCloseTo(48.8566, 4);
    });

    it('should calculate bounds for polygons by resolving point IDs', () => {
      layersStore.addPoint({
        id: 'p1',
        name: 'Point 1',
        coordinates: { lat: 48.8, lon: 2.3 },
      });
      layersStore.addPoint({
        id: 'p2',
        name: 'Point 2',
        coordinates: { lat: 49, lon: 2.5 },
      });
      layersStore.addPoint({
        id: 'p3',
        name: 'Point 3',
        coordinates: { lat: 48.9, lon: 2.4 },
      });
      layersStore.addPolygon({
        id: 'polygon-1',
        name: 'Test Polygon',
        pointIds: ['p1', 'p2', 'p3'],
      });

      drawing.redrawAllElements();

      const callArgs = mockMapRef.flyToBoundsWithPanels.mock.calls[0][0];
      expect(callArgs[0][0]).toBeCloseTo(48.8, 4); // minLat
      expect(callArgs[1][0]).toBeCloseTo(49, 4); // maxLat
    });

    it('should not call flyToBoundsWithPanels when no elements exist', () => {
      drawing.redrawAllElements();

      expect(mockMapRef.flyToBoundsWithPanels).not.toHaveBeenCalled();
    });

    it('should not call flyToBoundsWithPanels when skipAutoFly is set', () => {
      (mockMapRef as any).skipAutoFly = true;
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Test Circle',
        center: { lat: 48.8566, lon: 2.3522 },
        radius: 1000,
      });

      drawing.redrawAllElements();

      expect(mockMapRef.flyToBoundsWithPanels).not.toHaveBeenCalled();
    });

    it('should not call flyToBoundsWithPanels if function not available', () => {
      delete mockMapRef.flyToBoundsWithPanels;
      drawing = useDrawing(mockMapRef);
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Test Circle',
        center: { lat: 48.8566, lon: 2.3522 },
        radius: 1000,
      });

      expect(() => drawing.redrawAllElements()).not.toThrow();
    });

    it('should handle null map gracefully', () => {
      mockMapRef.map = ref(null);
      drawing = useDrawing(mockMapRef);

      expect(() => drawing.redrawAllElements()).not.toThrow();
    });

    it('should handle null sources gracefully', () => {
      mockMapRef.circlesSource = ref(null);
      mockMapRef.linesSource = ref(null);
      drawing = useDrawing(mockMapRef);

      expect(() => drawing.redrawAllElements()).not.toThrow();
    });

    it('should handle line segment without endpoint for bounds calculation', () => {
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        mode: 'coordinate',
        // No endpoint
      });

      drawing.redrawAllElements();

      // Should still call flyToBounds with center coordinates
      expect(mockMapRef.flyToBoundsWithPanels).toHaveBeenCalled();
    });
  });

  describe('removeElementFromMap helper', () => {
    it('should handle point without label overlay', async () => {
      const mockFeature = { getId: () => 'point-1' };
      mockGetFeatureById.mockReturnValue(mockFeature);
      overlaysArray = []; // No overlays

      await drawing.updateElementVisibility('point', 'point-1', false);

      expect(mockRemoveOverlay).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle null source in deleteElement for circle', () => {
      mockMapRef.circlesSource = ref(null);
      drawing = useDrawing(mockMapRef);
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Test Circle',
        center: { lat: 48.8566, lon: 2.3522 },
        radius: 1000,
      });

      // Should not throw when source is null
      expect(() => drawing.deleteElement('circle', 'circle-1')).not.toThrow();
      // Store should still be updated
      expect(layersStore.circles.find((c) => c.id === 'circle-1')).toBeUndefined();
    });

    it('should handle null source in deleteElement for lineSegment', () => {
      mockMapRef.linesSource = ref(null);
      drawing = useDrawing(mockMapRef);
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.9, lon: 2.4 },
        mode: 'coordinate',
      });

      expect(() => drawing.deleteElement('lineSegment', 'line-1')).not.toThrow();
    });

    it('should handle null source in deleteElement for polygon', () => {
      mockMapRef.polygonsSource = ref(null);
      drawing = useDrawing(mockMapRef);
      layersStore.addPolygon({
        id: 'polygon-1',
        name: 'Test Polygon',
        pointIds: ['p1', 'p2', 'p3'],
      });

      expect(() => drawing.deleteElement('polygon', 'polygon-1')).not.toThrow();
    });

    it('should handle removeElementFromMap when feature disappears between checks', async () => {
      // First call (in updateElementVisibility) returns feature, second call (in removeElementFromMap) returns null
      const mockFeature = { getId: () => 'circle-1' };
      mockGetFeatureById
        .mockReturnValueOnce(mockFeature) // First call in updateElementVisibility
        .mockReturnValueOnce(null); // Second call in removeElementFromMap

      await drawing.updateElementVisibility('circle', 'circle-1', false);

      // removeFeature should not be called since feature was not found in removeElementFromMap
      expect(mockRemoveFeature).not.toHaveBeenCalled();
    });

    it('should handle note without id when deleting linked notes', () => {
      const mockFeature = { getId: () => 'circle-1' };
      mockGetFeatureById.mockReturnValue(mockFeature);
      layersStore.addCircle({
        id: 'circle-1',
        name: 'Test Circle',
        center: { lat: 48.8566, lon: 2.3522 },
        radius: 1000,
      });
      // Add note without id
      layersStore.notes.push({
        id: undefined as any,
        content: 'Test note',
        coordinates: { lat: 48.8566, lon: 2.3522 },
        linkedElementType: 'circle',
        linkedElementId: 'circle-1',
      });

      expect(() => drawing.deleteElement('circle', 'circle-1')).not.toThrow();
    });

    it('should handle unknown element type in deleteElement switch', () => {
      // This tests the "no default" case - should not throw
      expect(() => drawing.deleteElement('unknown' as any, 'elem-1')).not.toThrow();
    });

    it('should handle polygon with non-existent point IDs in bounds calculation', () => {
      layersStore.addPolygon({
        id: 'polygon-1',
        name: 'Test Polygon',
        pointIds: ['nonexistent-1', 'nonexistent-2', 'nonexistent-3'],
      });

      expect(() => drawing.redrawAllElements()).not.toThrow();
    });

    it('should handle redrawLineSegment with non-parallel segment without endpoint', async () => {
      // This tests line 120 - segment.endpoint is falsy for non-parallel mode
      mockGetFeatureById.mockReturnValue(null);
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        mode: 'azimuth', // Not parallel, but no endpoint
        // endpoint is undefined
      });

      await drawing.updateElementVisibility('lineSegment', 'line-1', true, true);

      // Should not call redraw methods since there's no endpoint
      expect(mockRedrawLineSegmentOnMap).not.toHaveBeenCalled();
      expect(mockAnimateLineSegmentOnMap).not.toHaveBeenCalled();
    });

    it('should handle polygon not found in deleteElement polygon lookup', () => {
      // Setup point with a polygon reference that doesn't exist in store
      layersStore.addPoint({
        id: 'p1',
        name: 'Point 1',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      });
      // Manually add a polygonId that references non-existent polygon
      const point = layersStore.points.find((p) => p.id === 'p1');
      if (point) {
        point.polygonIds = ['nonexistent-polygon'];
      }

      mockGetFeatureById.mockReturnValue({ getId: () => 'p1' });

      // Should not throw when polygon is not found (line 239 false branch)
      expect(() => drawing.deleteElement('point', 'p1')).not.toThrow();
    });

    it('should handle polygon not found in redrawAffectedPolygons', () => {
      // Setup points and polygon
      layersStore.addPoint({
        id: 'p1',
        name: 'Point 1',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      });
      layersStore.addPoint({
        id: 'p2',
        name: 'Point 2',
        coordinates: { lat: 48.8606, lon: 2.3522 },
      });
      layersStore.addPoint({
        id: 'p3',
        name: 'Point 3',
        coordinates: { lat: 48.8606, lon: 2.3562 },
      });
      layersStore.addPoint({
        id: 'p4',
        name: 'Point 4',
        coordinates: { lat: 48.8566, lon: 2.3562 },
      });

      // Add polygon with 4 points (so deleting one will trigger redrawAffectedPolygons)
      layersStore.addPolygon({
        id: 'poly1',
        name: 'Polygon 1',
        pointIds: ['p1', 'p2', 'p3', 'p4'],
      });

      // Link point to polygon
      const point = layersStore.points.find((p) => p.id === 'p1');
      if (point) {
        point.polygonIds = ['poly1'];
      }

      mockGetFeatureById.mockReturnValue({ getId: () => 'p1' });

      // Delete p1 to trigger polygonsToRedraw with poly1
      // Then remove poly1 from store before redrawAffectedPolygons is called
      const originalFind = layersStore.polygons.find.bind(layersStore.polygons);
      let findCount = 0;
      vi.spyOn(layersStore.polygons, 'find').mockImplementation((predicate: any) => {
        findCount++;
        // First 2 calls are from deleteElement logic, subsequent from redrawAffectedPolygons
        if (findCount <= 1) {
          return originalFind(predicate);
        }
        // For redrawAffectedPolygons, return undefined to test the !polygon branch
        return undefined;
      });

      expect(() => drawing.deleteElement('point', 'p1')).not.toThrow();
    });

    it('should handle polygon without id in redrawAffectedPolygons', () => {
      // Setup points and polygon
      layersStore.addPoint({
        id: 'p1',
        name: 'Point 1',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      });
      layersStore.addPoint({
        id: 'p2',
        name: 'Point 2',
        coordinates: { lat: 48.8606, lon: 2.3522 },
      });
      layersStore.addPoint({
        id: 'p3',
        name: 'Point 3',
        coordinates: { lat: 48.8606, lon: 2.3562 },
      });
      layersStore.addPoint({
        id: 'p4',
        name: 'Point 4',
        coordinates: { lat: 48.8566, lon: 2.3562 },
      });

      // Add polygon with 4 points so deletion triggers redraw path
      layersStore.addPolygon({
        id: 'poly1',
        name: 'Polygon 1',
        pointIds: ['p1', 'p2', 'p3', 'p4'],
      });

      // Set up the point to reference this polygon
      const point = layersStore.points.find((p) => p.id === 'p1');
      if (point) {
        point.polygonIds = ['poly1'];
      }

      mockGetFeatureById.mockReturnValue({ getId: () => 'p1' });

      // Use spy to make the polygon's id undefined when redrawAffectedPolygons is called
      let callCount = 0;
      const originalFind = Array.prototype.find;
      vi.spyOn(Array.prototype, 'find').mockImplementation(function (this: any[], predicate: any) {
        const result = originalFind.call(this, predicate);
        // After deleteElement processes, null out the polygon id for redrawAffectedPolygons
        if (result && result.id === 'poly1') {
          callCount++;
          // Second find call for poly1 is from redrawAffectedPolygons
          if (callCount > 1) {
            return { ...result, id: undefined };
          }
        }
        return result;
      });

      expect(() => drawing.deleteElement('point', 'p1')).not.toThrow();

      vi.restoreAllMocks();
    });
  });
});
