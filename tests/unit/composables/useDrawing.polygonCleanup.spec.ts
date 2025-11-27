import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useDrawing } from '@/composables/useDrawing';
import { useLayersStore } from '@/stores/layers';

// Mock the polygon drawing composable
vi.mock('@/composables/usePolygonDrawing', () => ({
  usePolygonDrawing: vi.fn(() => ({
    drawPolygon: vi.fn(),
    redrawPolygonOnMap: vi.fn(),
  })),
}));

describe('useDrawing - Polygon Cleanup on Point Delete', () => {
  let pinia: any;
  let layersStore: any;
  let mockMapRef: any;
  let drawing: any;
  let mockRemoveFeature: any;
  let mockGetFeatureById: any;
  let mockAddFeature: any;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    layersStore = useLayersStore();

    mockRemoveFeature = vi.fn();
    mockGetFeatureById = vi.fn();
    mockAddFeature = vi.fn();

    // Mock map reference with all required properties
    mockMapRef = {
      map: ref({
        getOverlays: vi.fn(() => ({
          getArray: vi.fn(() => []),
        })),
      }),
      pointsSource: ref({
        removeFeature: mockRemoveFeature,
        getFeatureById: mockGetFeatureById,
        addFeature: mockAddFeature,
      }),
      polygonsSource: ref({
        removeFeature: mockRemoveFeature,
        getFeatureById: mockGetFeatureById,
        addFeature: mockAddFeature,
      }),
      circlesSource: ref(null),
      linesSource: ref(null),
    };

    drawing = useDrawing(mockMapRef);
  });

  it('should remove polygon from map when point deletion causes polygon to drop below 3 points', () => {
    // Create 3 points
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

    // Create polygon with exactly 3 points
    layersStore.addPolygon({
      id: 'poly1',
      name: 'Polygon 1',
      pointIds: ['p1', 'p2', 'p3'],
    });

    // Mock getFeatureById to return mock features
    mockGetFeatureById.mockImplementation((id: string) => {
      if (id === 'p1' || id === 'poly1') {
        return { getId: () => id };
      }
      return null;
    });

    // Delete one point (should trigger polygon cascade deletion)
    drawing.deleteElement('point', 'p1');

    // Verify polygon was removed from both map sources
    expect(mockGetFeatureById).toHaveBeenCalledWith('poly1');
    expect(mockRemoveFeature).toHaveBeenCalled();

    // Verify polygon was removed from store
    expect(layersStore.polygons.find((p: any) => p.id === 'poly1')).toBeUndefined();
  });

  it('should remove multiple polygons from map when point is shared by multiple 3-point polygons', () => {
    // Create 4 points
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

    // Create two polygons, both with exactly 3 points, sharing p1
    layersStore.addPolygon({
      id: 'poly1',
      name: 'Polygon 1',
      pointIds: ['p1', 'p2', 'p3'],
    });
    layersStore.addPolygon({
      id: 'poly2',
      name: 'Polygon 2',
      pointIds: ['p1', 'p3', 'p4'],
    });

    mockGetFeatureById.mockImplementation((id: string) => {
      if (['p1', 'poly1', 'poly2'].includes(id)) {
        return { getId: () => id };
      }
      return null;
    });

    // Delete shared point (should cascade delete both polygons)
    drawing.deleteElement('point', 'p1');

    // Verify both polygons were queried for removal
    expect(mockGetFeatureById).toHaveBeenCalledWith('poly1');
    expect(mockGetFeatureById).toHaveBeenCalledWith('poly2');

    // Verify both polygons removed from store
    expect(layersStore.polygons.find((p: any) => p.id === 'poly1')).toBeUndefined();
    expect(layersStore.polygons.find((p: any) => p.id === 'poly2')).toBeUndefined();
  });

  it('should redraw polygon with new shape when point is deleted but 3+ points remain', () => {
    // Create 4 points
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

    // Create polygon with 4 points
    layersStore.addPolygon({
      id: 'poly1',
      name: 'Polygon 1',
      pointIds: ['p1', 'p2', 'p3', 'p4'],
    });

    mockGetFeatureById.mockImplementation((id: string) => {
      if (id === 'p1' || id === 'poly1') {
        return { getId: () => id };
      }
      return null;
    });

    // Clear mocks to track only deleteElement calls
    mockGetFeatureById.mockClear();
    mockRemoveFeature.mockClear();

    // Delete one point (polygon should be redrawn with 3 points)
    drawing.deleteElement('point', 'p1');

    // Verify old polygon was removed from map (to be redrawn)
    expect(mockGetFeatureById).toHaveBeenCalledWith('poly1');
    expect(mockRemoveFeature).toHaveBeenCalled();

    // Verify polygon still exists in store with updated pointIds
    const polygon = layersStore.polygons.find((p: any) => p.id === 'poly1');
    expect(polygon).toBeDefined();
    expect(polygon.pointIds).toEqual(['p2', 'p3', 'p4']);
  });

  it('should handle point with no polygon references gracefully', () => {
    // Create a point without any polygons
    layersStore.addPoint({
      id: 'p1',
      name: 'Point 1',
      coordinates: { lat: 48.8566, lon: 2.3522 },
    });

    mockGetFeatureById.mockImplementation((id: string) => {
      if (id === 'p1') {
        return { getId: () => id };
      }
      return null;
    });

    // Delete point (should not throw error)
    expect(() => {
      drawing.deleteElement('point', 'p1');
    }).not.toThrow();

    // Verify point was removed
    expect(layersStore.points.find((p: any) => p.id === 'p1')).toBeUndefined();
  });
});
