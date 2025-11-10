import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLayersStore } from '@/stores/layers';

describe('Polygon ↔ Point Bidirectional References', () => {
  let layersStore: ReturnType<typeof useLayersStore>;

  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    layersStore = useLayersStore();
  });

  describe('addPolygon', () => {
    it('sets point.polygonIds when polygon is added', () => {
      // Create points
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

      // Add polygon
      layersStore.addPolygon({
        id: 'poly1',
        name: 'Polygon 1',
        pointIds: ['p1', 'p2', 'p3'],
      });

      // Verify bidirectional references
      const p1 = layersStore.points.find((p) => p.id === 'p1');
      const p2 = layersStore.points.find((p) => p.id === 'p2');
      const p3 = layersStore.points.find((p) => p.id === 'p3');

      expect(p1?.polygonIds).toContain('poly1');
      expect(p2?.polygonIds).toContain('poly1');
      expect(p3?.polygonIds).toContain('poly1');
    });

    it('handles point used in multiple polygons', () => {
      // Create points
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

      // Add first polygon
      layersStore.addPolygon({
        id: 'poly1',
        name: 'Polygon 1',
        pointIds: ['p1', 'p2', 'p3'],
      });

      // Add second polygon sharing points
      layersStore.addPolygon({
        id: 'poly2',
        name: 'Polygon 2',
        pointIds: ['p1', 'p3', 'p4'],
      });

      // Verify shared points reference both polygons
      const p1 = layersStore.points.find((p) => p.id === 'p1');
      const p3 = layersStore.points.find((p) => p.id === 'p3');

      expect(p1?.polygonIds).toContain('poly1');
      expect(p1?.polygonIds).toContain('poly2');
      expect(p3?.polygonIds).toContain('poly1');
      expect(p3?.polygonIds).toContain('poly2');

      // Verify exclusive points only reference their polygon
      const p2 = layersStore.points.find((p) => p.id === 'p2');
      const p4 = layersStore.points.find((p) => p.id === 'p4');

      expect(p2?.polygonIds).toEqual(['poly1']);
      expect(p4?.polygonIds).toEqual(['poly2']);
    });
  });

  describe('updatePolygon', () => {
    it('updates point.polygonIds when polygon points change', () => {
      // Create points
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

      // Add polygon with p1, p2, p3
      layersStore.addPolygon({
        id: 'poly1',
        name: 'Polygon 1',
        pointIds: ['p1', 'p2', 'p3'],
      });

      // Update polygon to use p1, p3, p4 (remove p2, add p4)
      layersStore.updatePolygon('poly1', {
        pointIds: ['p1', 'p3', 'p4'],
      });

      // Verify p2 no longer references polygon
      const p2 = layersStore.points.find((p) => p.id === 'p2');
      expect(p2?.polygonIds).not.toContain('poly1');

      // Verify p4 now references polygon
      const p4 = layersStore.points.find((p) => p.id === 'p4');
      expect(p4?.polygonIds).toContain('poly1');

      // Verify p1 and p3 still reference polygon
      const p1 = layersStore.points.find((p) => p.id === 'p1');
      const p3 = layersStore.points.find((p) => p.id === 'p3');
      expect(p1?.polygonIds).toContain('poly1');
      expect(p3?.polygonIds).toContain('poly1');
    });
  });

  describe('deletePolygon', () => {
    it('clears point.polygonIds when polygon is deleted', () => {
      // Create points
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

      // Add polygon
      layersStore.addPolygon({
        id: 'poly1',
        name: 'Polygon 1',
        pointIds: ['p1', 'p2', 'p3'],
      });

      // Verify references exist
      const p1Before = layersStore.points.find((p) => p.id === 'p1');
      expect(p1Before?.polygonIds).toContain('poly1');

      // Delete polygon
      layersStore.deletePolygon('poly1');

      // Verify references cleared
      const p1 = layersStore.points.find((p) => p.id === 'p1');
      const p2 = layersStore.points.find((p) => p.id === 'p2');
      const p3 = layersStore.points.find((p) => p.id === 'p3');

      expect(p1?.polygonIds).not.toContain('poly1');
      expect(p2?.polygonIds).not.toContain('poly1');
      expect(p3?.polygonIds).not.toContain('poly1');
    });

    it('does not affect points references to other polygons', () => {
      // Create points
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

      // Add two polygons sharing p1
      layersStore.addPolygon({
        id: 'poly1',
        name: 'Polygon 1',
        pointIds: ['p1', 'p2', 'p3'],
      });
      layersStore.addPolygon({
        id: 'poly2',
        name: 'Polygon 2',
        pointIds: ['p1', 'p2', 'p3'],
      });

      // Delete first polygon
      layersStore.deletePolygon('poly1');

      // Verify points still reference poly2
      const p1 = layersStore.points.find((p) => p.id === 'p1');
      expect(p1?.polygonIds).not.toContain('poly1');
      expect(p1?.polygonIds).toContain('poly2');
    });
  });

  describe('deletePoint', () => {
    it('removes point from polygon.pointIds when point is deleted', () => {
      // Create points
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

      // Add polygon with 4 points
      layersStore.addPolygon({
        id: 'poly1',
        name: 'Polygon 1',
        pointIds: ['p1', 'p2', 'p3', 'p4'],
      });

      // Delete one point
      layersStore.deletePoint('p4');

      // Verify polygon.pointIds updated
      const polygon = layersStore.polygons.find((p) => p.id === 'poly1');
      expect(polygon?.pointIds).toEqual(['p1', 'p2', 'p3']);
      expect(polygon?.pointIds).not.toContain('p4');
    });

    it('deletes polygon when point count drops below 3', () => {
      // Create points
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

      // Add polygon with exactly 3 points
      layersStore.addPolygon({
        id: 'poly1',
        name: 'Polygon 1',
        pointIds: ['p1', 'p2', 'p3'],
      });

      // Verify polygon exists
      expect(layersStore.polygons.find((p) => p.id === 'poly1')).toBeDefined();

      // Delete one point (drops to 2 points)
      layersStore.deletePoint('p3');

      // Polygon should be auto-deleted
      expect(layersStore.polygons.find((p) => p.id === 'poly1')).toBeUndefined();
    });

    it('deletes multiple polygons when point shared across polygons is deleted', () => {
      // Create points
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

      // Add two polygons, both with exactly 3 points, sharing p1
      layersStore.addPolygon({
        id: 'poly1',
        name: 'Polygon 1',
        pointIds: ['p1', 'p2', 'p3'],
      });
      layersStore.addPolygon({
        id: 'poly2',
        name: 'Polygon 2',
        pointIds: ['p1', 'p2', 'p3'],
      });

      // Delete shared point
      layersStore.deletePoint('p1');

      // Both polygons should be deleted
      expect(layersStore.polygons.find((p) => p.id === 'poly1')).toBeUndefined();
      expect(layersStore.polygons.find((p) => p.id === 'poly2')).toBeUndefined();
    });

    it('only deletes polygons that drop below 3 points', () => {
      // Create points
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

      // Add polygon with 3 points and polygon with 4 points, sharing p1
      layersStore.addPolygon({
        id: 'poly1',
        name: 'Polygon 1 (3 points)',
        pointIds: ['p1', 'p2', 'p3'],
      });
      layersStore.addPolygon({
        id: 'poly2',
        name: 'Polygon 2 (4 points)',
        pointIds: ['p1', 'p2', 'p3', 'p4'],
      });

      // Delete shared point
      layersStore.deletePoint('p1');

      // poly1 should be deleted (drops to 2 points)
      expect(layersStore.polygons.find((p) => p.id === 'poly1')).toBeUndefined();

      // poly2 should still exist (drops to 3 points, still valid)
      const poly2 = layersStore.polygons.find((p) => p.id === 'poly2');
      expect(poly2).toBeDefined();
      expect(poly2?.pointIds).toEqual(['p2', 'p3', 'p4']);
    });
  });

  describe('getPolygonsReferencingPoint', () => {
    it('returns all polygons using a specific point', () => {
      // Create points
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

      // Add polygons
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
      layersStore.addPolygon({
        id: 'poly3',
        name: 'Polygon 3',
        pointIds: ['p2', 'p3', 'p4'],
      });

      // Test point in multiple polygons
      const polygonsWithP1 = layersStore.getPolygonsReferencingPoint('p1');
      expect(polygonsWithP1).toHaveLength(2);
      expect(polygonsWithP1.map((p) => p.id)).toContain('poly1');
      expect(polygonsWithP1.map((p) => p.id)).toContain('poly2');

      // Test point in all polygons
      const polygonsWithP3 = layersStore.getPolygonsReferencingPoint('p3');
      expect(polygonsWithP3).toHaveLength(3);
    });

    it('returns empty array for point not in any polygon', () => {
      layersStore.addPoint({
        id: 'p1',
        name: 'Point 1',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      });

      const polygons = layersStore.getPolygonsReferencingPoint('p1');
      expect(polygons).toEqual([]);
    });
  });
});
