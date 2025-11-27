import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLayersStore } from '@/stores/layers';

describe('LayersStore - Point on Line Bidirectional Relationship', () => {
  let layersStore: any;

  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    layersStore = useLayersStore();
  });

  describe('Adding point to line', () => {
    it('point references its parent line via lineId', () => {
      // Create a line
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.355 },
        mode: 'coordinate',
        pointsOnLine: [],
      });

      // Create a point and manually add it to the line
      layersStore.addPoint({
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 48.858, lon: 2.353 },
        lineId: 'line-1',
      });

      // Add point to line's pointsOnLine array
      const line = layersStore.lineSegments.find((l: any) => l.id === 'line-1');
      line.pointsOnLine.push('point-1');

      // Verify bidirectional relationship
      const point = layersStore.points.find((p: any) => p.id === 'point-1');
      expect(point.lineId).toBe('line-1');
      expect(line.pointsOnLine).toContain('point-1');
    });

    it('multiple points can reference the same line', () => {
      // Create a line
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.355 },
        mode: 'coordinate',
        pointsOnLine: [],
      });

      // Add multiple points to the line
      layersStore.addPoint({
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 48.857, lon: 2.353 },
        lineId: 'line-1',
      });

      layersStore.addPoint({
        id: 'point-2',
        name: 'Point 2',
        coordinates: { lat: 48.858, lon: 2.3535 },
        lineId: 'line-1',
      });

      layersStore.addPoint({
        id: 'point-3',
        name: 'Point 3',
        coordinates: { lat: 48.859, lon: 2.354 },
        lineId: 'line-1',
      });

      // Add points to line's array
      const line = layersStore.lineSegments.find((l: any) => l.id === 'line-1');
      line.pointsOnLine.push('point-1', 'point-2', 'point-3');

      // Verify all points reference the line
      const point1 = layersStore.points.find((p: any) => p.id === 'point-1');
      const point2 = layersStore.points.find((p: any) => p.id === 'point-2');
      const point3 = layersStore.points.find((p: any) => p.id === 'point-3');

      expect(point1.lineId).toBe('line-1');
      expect(point2.lineId).toBe('line-1');
      expect(point3.lineId).toBe('line-1');
      expect(line.pointsOnLine).toEqual(['point-1', 'point-2', 'point-3']);
    });
  });

  describe('Deleting point from line', () => {
    it('removes point from line pointsOnLine array when point is deleted', () => {
      // Create a line with a point
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.355 },
        mode: 'coordinate',
        pointsOnLine: ['point-1'],
      });

      layersStore.addPoint({
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 48.858, lon: 2.353 },
        lineId: 'line-1',
      });

      // Verify point is in line's array
      let line = layersStore.lineSegments.find((l: any) => l.id === 'line-1');
      expect(line.pointsOnLine).toContain('point-1');

      // Delete the point
      layersStore.deletePoint('point-1');

      // Verify point is removed from line's array
      line = layersStore.lineSegments.find((l: any) => l.id === 'line-1');
      expect(line.pointsOnLine).not.toContain('point-1');
      expect(line.pointsOnLine).toEqual([]);

      // Verify point is deleted from store
      const point = layersStore.points.find((p: any) => p.id === 'point-1');
      expect(point).toBeUndefined();
    });

    it('removes point from multiple lines if present', () => {
      // Create two lines
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Line 1',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.355 },
        mode: 'coordinate',
        pointsOnLine: ['point-1'],
      });

      layersStore.addLineSegment({
        id: 'line-2',
        name: 'Line 2',
        center: { lat: 48.85, lon: 2.35 },
        endpoint: { lat: 48.855, lon: 2.358 },
        mode: 'coordinate',
        startPointId: 'point-1',
      });

      // Create a point
      layersStore.addPoint({
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 48.858, lon: 2.353 },
        lineId: 'line-1',
      });

      // Delete the point
      layersStore.deletePoint('point-1');

      // Verify point is removed from both lines
      const line1 = layersStore.lineSegments.find((l: any) => l.id === 'line-1');
      const line2 = layersStore.lineSegments.find((l: any) => l.id === 'line-2');

      expect(line1.pointsOnLine).not.toContain('point-1');
      expect(line2.startPointId).toBeUndefined();
    });

    it('keeps other points in line when one point is deleted', () => {
      // Create a line with multiple points
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.355 },
        mode: 'coordinate',
        pointsOnLine: ['point-1', 'point-2', 'point-3'],
      });

      layersStore.addPoint({
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 48.857, lon: 2.353 },
        lineId: 'line-1',
      });

      layersStore.addPoint({
        id: 'point-2',
        name: 'Point 2',
        coordinates: { lat: 48.858, lon: 2.3535 },
        lineId: 'line-1',
      });

      layersStore.addPoint({
        id: 'point-3',
        name: 'Point 3',
        coordinates: { lat: 48.859, lon: 2.354 },
        lineId: 'line-1',
      });

      // Delete one point
      layersStore.deletePoint('point-2');

      // Verify point-2 is removed but others remain
      const line = layersStore.lineSegments.find((l: any) => l.id === 'line-1');
      expect(line.pointsOnLine).not.toContain('point-2');
      expect(line.pointsOnLine).toContain('point-1');
      expect(line.pointsOnLine).toContain('point-3');
      expect(line.pointsOnLine).toEqual(['point-1', 'point-3']);
    });

    it('removes point from startPointId when deleted', () => {
      // Create a line with start point
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.355 },
        mode: 'coordinate',
        startPointId: 'point-1',
      });

      layersStore.addPoint({
        id: 'point-1',
        name: 'Start Point',
        coordinates: { lat: 48.8566, lon: 2.3522 },
        lineId: 'line-1',
      });

      // Delete the point
      layersStore.deletePoint('point-1');

      // Verify startPointId is cleared
      const line = layersStore.lineSegments.find((l: any) => l.id === 'line-1');
      expect(line.startPointId).toBeUndefined();
    });

    it('removes point from endPointId when deleted', () => {
      // Create a line with end point
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.355 },
        mode: 'coordinate',
        endPointId: 'point-1',
      });

      layersStore.addPoint({
        id: 'point-1',
        name: 'End Point',
        coordinates: { lat: 48.86, lon: 2.355 },
        lineId: 'line-1',
      });

      // Delete the point
      layersStore.deletePoint('point-1');

      // Verify endPointId is cleared
      const line = layersStore.lineSegments.find((l: any) => l.id === 'line-1');
      expect(line.endPointId).toBeUndefined();
    });
  });

  describe('updateLinePointReferences', () => {
    it('sets lineId for points at start position', () => {
      // Create a point at specific coordinates
      layersStore.addPoint({
        id: 'point-1',
        name: 'Start Point',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      });

      // Create a line starting at the same coordinates
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.355 },
        mode: 'coordinate',
      });

      // The point's lineId should be set to the line
      const point = layersStore.points.find((p: any) => p.id === 'point-1');
      expect(point.lineId).toBe('line-1');

      // The line's startPointId should reference the point
      const line = layersStore.lineSegments.find((l: any) => l.id === 'line-1');
      expect(line.startPointId).toBe('point-1');
    });

    it('sets lineId for points at end position', () => {
      // Create a point at specific coordinates
      layersStore.addPoint({
        id: 'point-1',
        name: 'End Point',
        coordinates: { lat: 48.86, lon: 2.355 },
      });

      // Create a line ending at the same coordinates
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.355 },
        mode: 'coordinate',
      });

      // The point's lineId should be set to the line
      const point = layersStore.points.find((p: any) => p.id === 'point-1');
      expect(point.lineId).toBe('line-1');

      // The line's endPointId should reference the point
      const line = layersStore.lineSegments.find((l: any) => l.id === 'line-1');
      expect(line.endPointId).toBe('point-1');
    });

    it('sets lineId for points in pointsOnLine array', () => {
      // Create a line with points in pointsOnLine
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.355 },
        mode: 'coordinate',
        pointsOnLine: ['point-1', 'point-2'],
      });

      // Create points
      layersStore.addPoint({
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 48.857, lon: 2.353 },
      });

      layersStore.addPoint({
        id: 'point-2',
        name: 'Point 2',
        coordinates: { lat: 48.858, lon: 2.3535 },
      });

      // Trigger update
      layersStore.updateLinePointReferences('line-1');

      // Verify points have lineId set
      const point1 = layersStore.points.find((p: any) => p.id === 'point-1');
      const point2 = layersStore.points.find((p: any) => p.id === 'point-2');

      expect(point1.lineId).toBe('line-1');
      expect(point2.lineId).toBe('line-1');
    });
  });

  describe('getLinesReferencingPoint', () => {
    it('returns lines that reference a point in pointsOnLine', () => {
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Line 1',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.355 },
        mode: 'coordinate',
        pointsOnLine: ['point-1'],
      });

      const lines = layersStore.getLinesReferencingPoint('point-1');
      expect(lines.length).toBe(1);
      expect(lines[0].id).toBe('line-1');
    });

    it('returns lines that reference a point as startPointId', () => {
      // Create the point first
      layersStore.addPoint({
        id: 'point-1',
        name: 'Start Point',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      });

      // Create the line starting at the same position
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Line 1',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.355 },
        mode: 'coordinate',
      });

      const lines = layersStore.getLinesReferencingPoint('point-1');
      expect(lines.length).toBe(1);
      expect(lines[0].id).toBe('line-1');
    });

    it('returns lines that reference a point as endPointId', () => {
      // Create the point first
      layersStore.addPoint({
        id: 'point-1',
        name: 'End Point',
        coordinates: { lat: 48.86, lon: 2.355 },
      });

      // Create the line ending at the same position
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Line 1',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.355 },
        mode: 'coordinate',
      });

      const lines = layersStore.getLinesReferencingPoint('point-1');
      expect(lines.length).toBe(1);
      expect(lines[0].id).toBe('line-1');
    });

    it('returns multiple lines referencing the same point', () => {
      // Create the point first
      layersStore.addPoint({
        id: 'point-1',
        name: 'Shared Point',
        coordinates: { lat: 48.85, lon: 2.35 },
      });

      // Create line 1 with point in pointsOnLine
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Line 1',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.355 },
        mode: 'coordinate',
        pointsOnLine: ['point-1'],
      });

      // Update the point's lineId for the pointsOnLine reference
      layersStore.updateLinePointReferences('line-1');

      // Create line 2 starting at the same position
      layersStore.addLineSegment({
        id: 'line-2',
        name: 'Line 2',
        center: { lat: 48.85, lon: 2.35 },
        endpoint: { lat: 48.855, lon: 2.358 },
        mode: 'coordinate',
      });

      const lines = layersStore.getLinesReferencingPoint('point-1');
      expect(lines.length).toBe(2);
      expect(lines.map((l: any) => l.id)).toContain('line-1');
      expect(lines.map((l: any) => l.id)).toContain('line-2');
    });

    it('returns empty array when no lines reference the point', () => {
      const lines = layersStore.getLinesReferencingPoint('nonexistent-point');
      expect(lines.length).toBe(0);
    });
  });

  describe('Deleting line clears point references', () => {
    it('clears lineId from points when line is deleted', () => {
      // Create a point
      layersStore.addPoint({
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 48.8566, lon: 2.3522 },
        lineId: 'line-1',
      });

      // Create another point
      layersStore.addPoint({
        id: 'point-2',
        name: 'Point 2',
        coordinates: { lat: 48.857, lon: 2.353 },
        lineId: 'line-1',
      });

      // Create a line
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Line 1',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.355 },
        mode: 'coordinate',
        pointsOnLine: ['point-1', 'point-2'],
      });

      // Verify points have lineId set
      let point1 = layersStore.points.find((p: any) => p.id === 'point-1');
      let point2 = layersStore.points.find((p: any) => p.id === 'point-2');
      expect(point1?.lineId).toBe('line-1');
      expect(point2?.lineId).toBe('line-1');

      // Delete the line
      layersStore.deleteLineSegment('line-1');

      // Verify points have lineId cleared
      point1 = layersStore.points.find((p: any) => p.id === 'point-1');
      point2 = layersStore.points.find((p: any) => p.id === 'point-2');
      expect(point1?.lineId).toBeUndefined();
      expect(point2?.lineId).toBeUndefined();

      // Verify line is deleted
      const line = layersStore.lineSegments.find((l: any) => l.id === 'line-1');
      expect(line).toBeUndefined();
    });

    it('clears lineId from multiple points across different positions', () => {
      // Create points
      layersStore.addPoint({
        id: 'point-start',
        name: 'Start Point',
        coordinates: { lat: 48.8566, lon: 2.3522 },
        lineId: 'line-1',
      });

      layersStore.addPoint({
        id: 'point-mid',
        name: 'Mid Point',
        coordinates: { lat: 48.858, lon: 2.353 },
        lineId: 'line-1',
      });

      layersStore.addPoint({
        id: 'point-end',
        name: 'End Point',
        coordinates: { lat: 48.86, lon: 2.355 },
        lineId: 'line-1',
      });

      // Create a line
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Line 1',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.355 },
        mode: 'coordinate',
        startPointId: 'point-start',
        endPointId: 'point-end',
        pointsOnLine: ['point-mid'],
      });

      // Delete the line
      layersStore.deleteLineSegment('line-1');

      // Verify all points have lineId cleared
      const pointStart = layersStore.points.find((p: any) => p.id === 'point-start');
      const pointMid = layersStore.points.find((p: any) => p.id === 'point-mid');
      const pointEnd = layersStore.points.find((p: any) => p.id === 'point-end');

      expect(pointStart?.lineId).toBeUndefined();
      expect(pointMid?.lineId).toBeUndefined();
      expect(pointEnd?.lineId).toBeUndefined();
    });

    it('does not affect points on other lines', () => {
      // Create points
      layersStore.addPoint({
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 48.8566, lon: 2.3522 },
        lineId: 'line-1',
      });

      layersStore.addPoint({
        id: 'point-2',
        name: 'Point 2',
        coordinates: { lat: 48.85, lon: 2.35 },
        lineId: 'line-2',
      });

      // Create two lines
      layersStore.addLineSegment({
        id: 'line-1',
        name: 'Line 1',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.355 },
        mode: 'coordinate',
        pointsOnLine: ['point-1'],
      });

      layersStore.addLineSegment({
        id: 'line-2',
        name: 'Line 2',
        center: { lat: 48.85, lon: 2.35 },
        endpoint: { lat: 48.855, lon: 2.358 },
        mode: 'coordinate',
        pointsOnLine: ['point-2'],
      });

      // Delete line-1
      layersStore.deleteLineSegment('line-1');

      // Verify point-1 has lineId cleared
      const point1 = layersStore.points.find((p: any) => p.id === 'point-1');
      expect(point1?.lineId).toBeUndefined();

      // Verify point-2 still has lineId set to line-2
      const point2 = layersStore.points.find((p: any) => p.id === 'point-2');
      expect(point2?.lineId).toBe('line-2');
    });
  });
});
