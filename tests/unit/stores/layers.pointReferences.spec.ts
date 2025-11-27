/**
 * Unit tests for point reference tracking in line segments
 */

import type { LineSegmentElement, PointElement } from '@/services/storage';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLayersStore } from '@/stores/layers';

describe('LayersStore - Point Reference Tracking', () => {
  let layersStore: ReturnType<typeof useLayersStore>;

  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    layersStore = useLayersStore();
  });

  describe('findPointAtCoordinates', () => {
    it('should find a point at exact coordinates', () => {
      const point: PointElement = {
        id: 'point-1',
        name: 'Test Point',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      };
      layersStore.addPoint(point);

      const found = layersStore.findPointAtCoordinates(48.8566, 2.3522);
      expect(found).toBeDefined();
      expect(found?.id).toBe('point-1');
    });

    it('should find a point within tolerance', () => {
      const point: PointElement = {
        id: 'point-1',
        name: 'Test Point',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      };
      layersStore.addPoint(point);

      // Within default tolerance (0.0001)
      const found = layersStore.findPointAtCoordinates(48.856_605, 2.352_205);
      expect(found).toBeDefined();
      expect(found?.id).toBe('point-1');
    });

    it('should not find a point outside tolerance', () => {
      const point: PointElement = {
        id: 'point-1',
        name: 'Test Point',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      };
      layersStore.addPoint(point);

      // Outside default tolerance
      const found = layersStore.findPointAtCoordinates(48.8577, 2.3533);
      expect(found).toBeUndefined();
    });

    it('should respect custom tolerance', () => {
      const point: PointElement = {
        id: 'point-1',
        name: 'Test Point',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      };
      layersStore.addPoint(point);

      // Within custom tolerance
      const found = layersStore.findPointAtCoordinates(48.857, 2.353, 0.01);
      expect(found).toBeDefined();
      expect(found?.id).toBe('point-1');
    });
  });

  describe('updateLinePointReferences', () => {
    it('should set startPointId when point exists at start coordinates', () => {
      const point: PointElement = {
        id: 'point-1',
        name: 'Start Point',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      };
      layersStore.addPoint(point);

      const line: LineSegmentElement = {
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.3555 },
        mode: 'coordinate',
      };
      layersStore.addLineSegment(line);

      const updatedLine = layersStore.lineSegments.find((l) => l.id === 'line-1');
      expect(updatedLine?.startPointId).toBe('point-1');
      expect(updatedLine?.endPointId).toBeUndefined();
    });

    it('should set endPointId when point exists at end coordinates', () => {
      const point: PointElement = {
        id: 'point-2',
        name: 'End Point',
        coordinates: { lat: 48.86, lon: 2.3555 },
      };
      layersStore.addPoint(point);

      const line: LineSegmentElement = {
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.3555 },
        mode: 'coordinate',
      };
      layersStore.addLineSegment(line);

      const updatedLine = layersStore.lineSegments.find((l) => l.id === 'line-1');
      expect(updatedLine?.startPointId).toBeUndefined();
      expect(updatedLine?.endPointId).toBe('point-2');
    });

    it('should set both startPointId and endPointId when points exist at both ends', () => {
      const startPoint: PointElement = {
        id: 'point-1',
        name: 'Start Point',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      };
      const endPoint: PointElement = {
        id: 'point-2',
        name: 'End Point',
        coordinates: { lat: 48.86, lon: 2.3555 },
      };
      layersStore.addPoint(startPoint);
      layersStore.addPoint(endPoint);

      const line: LineSegmentElement = {
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.3555 },
        mode: 'coordinate',
      };
      layersStore.addLineSegment(line);

      const updatedLine = layersStore.lineSegments.find((l) => l.id === 'line-1');
      expect(updatedLine?.startPointId).toBe('point-1');
      expect(updatedLine?.endPointId).toBe('point-2');
    });

    it('should update references when line is updated', () => {
      const point: PointElement = {
        id: 'point-1',
        name: 'New End Point',
        coordinates: { lat: 48.87, lon: 2.36 },
      };
      layersStore.addPoint(point);

      const line: LineSegmentElement = {
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.3555 },
        mode: 'coordinate',
      };
      layersStore.addLineSegment(line);

      // Update line endpoint
      layersStore.updateLineSegment('line-1', {
        endpoint: { lat: 48.87, lon: 2.36 },
      });

      const updatedLine = layersStore.lineSegments.find((l) => l.id === 'line-1');
      expect(updatedLine?.endPointId).toBe('point-1');
    });

    it('should initialize pointsOnLine array', () => {
      const line: LineSegmentElement = {
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.3555 },
        mode: 'coordinate',
      };
      layersStore.addLineSegment(line);

      const updatedLine = layersStore.lineSegments.find((l) => l.id === 'line-1');
      expect(updatedLine?.pointsOnLine).toBeDefined();
      expect(Array.isArray(updatedLine?.pointsOnLine)).toBe(true);
      expect(updatedLine?.pointsOnLine?.length).toBe(0);
    });
  });

  describe('removePointReferencesFromLines', () => {
    it('should remove startPointId reference when point is deleted', () => {
      const point: PointElement = {
        id: 'point-1',
        name: 'Start Point',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      };
      layersStore.addPoint(point);

      const line: LineSegmentElement = {
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.3555 },
        mode: 'coordinate',
      };
      layersStore.addLineSegment(line);

      // Verify reference exists
      let updatedLine = layersStore.lineSegments.find((l) => l.id === 'line-1');
      expect(updatedLine?.startPointId).toBe('point-1');

      // Delete the point
      layersStore.deletePoint('point-1');

      // Verify reference is removed but line still exists
      updatedLine = layersStore.lineSegments.find((l) => l.id === 'line-1');
      expect(updatedLine).toBeDefined();
      expect(updatedLine?.startPointId).toBeUndefined();
    });

    it('should remove endPointId reference when point is deleted', () => {
      const point: PointElement = {
        id: 'point-2',
        name: 'End Point',
        coordinates: { lat: 48.86, lon: 2.3555 },
      };
      layersStore.addPoint(point);

      const line: LineSegmentElement = {
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.3555 },
        mode: 'coordinate',
      };
      layersStore.addLineSegment(line);

      // Verify reference exists
      let updatedLine = layersStore.lineSegments.find((l) => l.id === 'line-1');
      expect(updatedLine?.endPointId).toBe('point-2');

      // Delete the point
      layersStore.deletePoint('point-2');

      // Verify reference is removed but line still exists
      updatedLine = layersStore.lineSegments.find((l) => l.id === 'line-1');
      expect(updatedLine).toBeDefined();
      expect(updatedLine?.endPointId).toBeUndefined();
    });

    it('should remove point from pointsOnLine array when deleted', () => {
      const point: PointElement = {
        id: 'point-3',
        name: 'Middle Point',
        coordinates: { lat: 48.858, lon: 2.354 },
      };
      layersStore.addPoint(point);

      const line: LineSegmentElement = {
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.3555 },
        mode: 'coordinate',
        pointsOnLine: ['point-3', 'point-4'],
      };
      layersStore.lineSegments.push(line);

      // Delete the point
      layersStore.deletePoint('point-3');

      // Verify reference is removed from array
      const updatedLine = layersStore.lineSegments.find((l) => l.id === 'line-1');
      expect(updatedLine?.pointsOnLine).toEqual(['point-4']);
    });

    it('should not delete line when referenced point is deleted', () => {
      const point1: PointElement = {
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      };
      const point2: PointElement = {
        id: 'point-2',
        name: 'Point 2',
        coordinates: { lat: 48.86, lon: 2.3555 },
      };
      layersStore.addPoint(point1);
      layersStore.addPoint(point2);

      const line: LineSegmentElement = {
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.3555 },
        mode: 'coordinate',
      };
      layersStore.addLineSegment(line);

      const initialLineCount = layersStore.lineSegments.length;

      // Delete both points
      layersStore.deletePoint('point-1');
      layersStore.deletePoint('point-2');

      // Line should still exist
      expect(layersStore.lineSegments.length).toBe(initialLineCount);
      const updatedLine = layersStore.lineSegments.find((l) => l.id === 'line-1');
      expect(updatedLine).toBeDefined();
      expect(updatedLine?.startPointId).toBeUndefined();
      expect(updatedLine?.endPointId).toBeUndefined();
    });
  });

  describe('getLinesReferencingPoint', () => {
    it('should return lines with point as startPoint', () => {
      const point: PointElement = {
        id: 'point-1',
        name: 'Start Point',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      };
      layersStore.addPoint(point);

      const line1: LineSegmentElement = {
        id: 'line-1',
        name: 'Line 1',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.3555 },
        mode: 'coordinate',
      };
      const line2: LineSegmentElement = {
        id: 'line-2',
        name: 'Line 2',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.87, lon: 2.36 },
        mode: 'coordinate',
      };
      layersStore.addLineSegment(line1);
      layersStore.addLineSegment(line2);

      const referencingLines = layersStore.getLinesReferencingPoint('point-1');
      expect(referencingLines.length).toBe(2);
      expect(referencingLines.map((l) => l.id)).toContain('line-1');
      expect(referencingLines.map((l) => l.id)).toContain('line-2');
    });

    it('should return lines with point as endPoint', () => {
      const point: PointElement = {
        id: 'point-2',
        name: 'End Point',
        coordinates: { lat: 48.86, lon: 2.3555 },
      };
      layersStore.addPoint(point);

      const line: LineSegmentElement = {
        id: 'line-1',
        name: 'Line 1',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.3555 },
        mode: 'coordinate',
      };
      layersStore.addLineSegment(line);

      const referencingLines = layersStore.getLinesReferencingPoint('point-2');
      expect(referencingLines.length).toBe(1);
      expect(referencingLines[0].id).toBe('line-1');
    });

    it('should return lines with point in pointsOnLine array', () => {
      const line: LineSegmentElement = {
        id: 'line-1',
        name: 'Line 1',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.3555 },
        mode: 'coordinate',
        pointsOnLine: ['point-3', 'point-4'],
      };
      layersStore.lineSegments.push(line);

      const referencingLines = layersStore.getLinesReferencingPoint('point-3');
      expect(referencingLines.length).toBe(1);
      expect(referencingLines[0].id).toBe('line-1');
    });

    it('should return empty array when no lines reference the point', () => {
      const referencingLines = layersStore.getLinesReferencingPoint('non-existent-point');
      expect(referencingLines).toEqual([]);
    });

    it('should not return duplicates when point is referenced multiple ways', () => {
      const point: PointElement = {
        id: 'point-1',
        name: 'Multi-ref Point',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      };
      layersStore.addPoint(point);

      // Create a line where the same point is both start and in pointsOnLine
      const line: LineSegmentElement = {
        id: 'line-1',
        name: 'Line 1',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.3555 },
        mode: 'coordinate',
        startPointId: 'point-1',
        pointsOnLine: ['point-1'],
      };
      layersStore.lineSegments.push(line);

      const referencingLines = layersStore.getLinesReferencingPoint('point-1');
      expect(referencingLines.length).toBe(1);
      expect(referencingLines[0].id).toBe('line-1');
    });
  });

  describe('Backward Compatibility', () => {
    it('should handle loading old projects without point references', () => {
      const point: PointElement = {
        id: 'point-1',
        name: 'Point',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      };

      // Old line format without point references
      const oldLine = {
        id: 'line-1',
        name: 'Old Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.3555 },
        mode: 'coordinate' as const,
      };

      layersStore.loadLayers({
        circles: [],
        lineSegments: [oldLine],
        points: [point],
        polygons: [],
        notes: [],
      });

      // Point references should be added automatically
      const loadedLine = layersStore.lineSegments.find((l) => l.id === 'line-1');
      expect(loadedLine?.startPointId).toBe('point-1');
      expect(loadedLine?.pointsOnLine).toBeDefined();
    });

    it('should preserve existing point references when loading', () => {
      const point1: PointElement = {
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      };
      const point2: PointElement = {
        id: 'point-2',
        name: 'Point 2',
        coordinates: { lat: 48.86, lon: 2.3555 },
      };

      // New line format with point references
      const newLine: LineSegmentElement = {
        id: 'line-1',
        name: 'New Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.3555 },
        mode: 'coordinate',
        startPointId: 'point-1',
        endPointId: 'point-2',
        pointsOnLine: ['point-3'],
      };

      layersStore.loadLayers({
        circles: [],
        lineSegments: [newLine],
        points: [point1, point2],
        polygons: [],
        notes: [],
      });

      const loadedLine = layersStore.lineSegments.find((l) => l.id === 'line-1');
      expect(loadedLine?.startPointId).toBe('point-1');
      expect(loadedLine?.endPointId).toBe('point-2');
      expect(loadedLine?.pointsOnLine).toContain('point-3');
    });

    it('should update references if coordinates match but IDs dont', () => {
      const point: PointElement = {
        id: 'new-point-id',
        name: 'Point',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      };

      // Line with old/wrong point reference
      const line: LineSegmentElement = {
        id: 'line-1',
        name: 'Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.3555 },
        mode: 'coordinate',
        startPointId: 'old-point-id',
      };

      layersStore.loadLayers({
        circles: [],
        lineSegments: [line],
        points: [point],
        polygons: [],
        notes: [],
      });

      // Should update to correct point ID based on coordinates
      const loadedLine = layersStore.lineSegments.find((l) => l.id === 'line-1');
      expect(loadedLine?.startPointId).toBe('new-point-id');
    });
  });

  describe('Export/Import', () => {
    it('should export lines with point references', () => {
      const point1: PointElement = {
        id: 'point-1',
        name: 'Point 1',
        coordinates: { lat: 48.8566, lon: 2.3522 },
      };
      const point2: PointElement = {
        id: 'point-2',
        name: 'Point 2',
        coordinates: { lat: 48.86, lon: 2.3555 },
      };
      layersStore.addPoint(point1);
      layersStore.addPoint(point2);

      const line: LineSegmentElement = {
        id: 'line-1',
        name: 'Test Line',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.86, lon: 2.3555 },
        mode: 'coordinate',
      };
      layersStore.addLineSegment(line);

      const exported = layersStore.exportLayers();
      const exportedLine = exported.lineSegments.find((l) => l.id === 'line-1');

      expect(exportedLine?.startPointId).toBe('point-1');
      expect(exportedLine?.endPointId).toBe('point-2');
      expect(exportedLine?.pointsOnLine).toBeDefined();
    });

    it('should import and restore point references correctly', () => {
      const dataToImport = {
        circles: [],
        lineSegments: [
          {
            id: 'line-1',
            name: 'Imported Line',
            center: { lat: 48.8566, lon: 2.3522 },
            endpoint: { lat: 48.86, lon: 2.3555 },
            mode: 'coordinate' as const,
            startPointId: 'point-1',
            endPointId: 'point-2',
            pointsOnLine: ['point-3'],
          },
        ],
        points: [
          {
            id: 'point-1',
            name: 'Point 1',
            coordinates: { lat: 48.8566, lon: 2.3522 },
          },
          {
            id: 'point-2',
            name: 'Point 2',
            coordinates: { lat: 48.86, lon: 2.3555 },
          },
        ],
        polygons: [],
        notes: [],
      };

      layersStore.loadLayers(dataToImport);

      const importedLine = layersStore.lineSegments.find((l) => l.id === 'line-1');
      expect(importedLine?.startPointId).toBe('point-1');
      expect(importedLine?.endPointId).toBe('point-2');
      expect(importedLine?.pointsOnLine).toContain('point-3');
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multiple lines sharing the same points', () => {
      const sharedPoint: PointElement = {
        id: 'shared-point',
        name: 'Shared Point',
        coordinates: { lat: 48.858, lon: 2.354 },
      };
      layersStore.addPoint(sharedPoint);

      const line1: LineSegmentElement = {
        id: 'line-1',
        name: 'Line 1',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.858, lon: 2.354 },
        mode: 'coordinate',
      };
      const line2: LineSegmentElement = {
        id: 'line-2',
        name: 'Line 2',
        center: { lat: 48.858, lon: 2.354 },
        endpoint: { lat: 48.86, lon: 2.3555 },
        mode: 'coordinate',
      };
      layersStore.addLineSegment(line1);
      layersStore.addLineSegment(line2);

      // Line 1 should have shared point as endpoint
      const updatedLine1 = layersStore.lineSegments.find((l) => l.id === 'line-1');
      expect(updatedLine1?.endPointId).toBe('shared-point');

      // Line 2 should have shared point as startpoint
      const updatedLine2 = layersStore.lineSegments.find((l) => l.id === 'line-2');
      expect(updatedLine2?.startPointId).toBe('shared-point');

      // Both lines should be returned when querying for lines referencing the shared point
      const referencingLines = layersStore.getLinesReferencingPoint('shared-point');
      expect(referencingLines.length).toBe(2);
    });

    it('should handle point deletion affecting multiple lines', () => {
      const sharedPoint: PointElement = {
        id: 'shared-point',
        name: 'Shared Point',
        coordinates: { lat: 48.858, lon: 2.354 },
      };
      layersStore.addPoint(sharedPoint);

      const line1: LineSegmentElement = {
        id: 'line-1',
        name: 'Line 1',
        center: { lat: 48.8566, lon: 2.3522 },
        endpoint: { lat: 48.858, lon: 2.354 },
        mode: 'coordinate',
      };
      const line2: LineSegmentElement = {
        id: 'line-2',
        name: 'Line 2',
        center: { lat: 48.858, lon: 2.354 },
        endpoint: { lat: 48.86, lon: 2.3555 },
        mode: 'coordinate',
      };
      const line3: LineSegmentElement = {
        id: 'line-3',
        name: 'Line 3',
        center: { lat: 48.85, lon: 2.35 },
        endpoint: { lat: 48.865, lon: 2.357 },
        mode: 'coordinate',
        pointsOnLine: ['shared-point'],
      };

      layersStore.addLineSegment(line1);
      layersStore.addLineSegment(line2);
      layersStore.lineSegments.push(line3);

      // Delete the shared point
      layersStore.deletePoint('shared-point');

      // All lines should still exist
      expect(layersStore.lineSegments.length).toBe(3);

      // References should be removed from all lines
      const updatedLine1 = layersStore.lineSegments.find((l) => l.id === 'line-1');
      const updatedLine2 = layersStore.lineSegments.find((l) => l.id === 'line-2');
      const updatedLine3 = layersStore.lineSegments.find((l) => l.id === 'line-3');

      expect(updatedLine1?.endPointId).toBeUndefined();
      expect(updatedLine2?.startPointId).toBeUndefined();
      expect(updatedLine3?.pointsOnLine).toEqual([]);
    });

    it('should handle parallel lines (without endpoints)', () => {
      const line: LineSegmentElement = {
        id: 'parallel-1',
        name: 'Parallel Line',
        center: { lat: 45, lon: 0 },
        mode: 'parallel',
        longitude: 45,
      };
      layersStore.addLineSegment(line);

      // Should not crash and should initialize pointsOnLine
      const updatedLine = layersStore.lineSegments.find((l) => l.id === 'parallel-1');
      expect(updatedLine).toBeDefined();
      expect(updatedLine?.pointsOnLine).toBeDefined();
      expect(updatedLine?.startPointId).toBeUndefined();
      expect(updatedLine?.endPointId).toBeUndefined();
    });
  });
});
