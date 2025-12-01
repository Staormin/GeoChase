/**
 * Layers store - Manages drawing layers (circles, lines, points)
 */

import type {
  CircleElement,
  LineSegmentElement,
  NoteElement,
  PointElement,
  PolygonElement,
} from '@/services/storage';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export const useLayersStore = defineStore('layers', () => {
  // State
  const circles = ref<CircleElement[]>([]);
  const lineSegments = ref<LineSegmentElement[]>([]);
  const points = ref<PointElement[]>([]);
  const polygons = ref<PolygonElement[]>([]);
  const notes = ref<NoteElement[]>([]);

  // Map of OpenLayers feature IDs for feature management
  const mapElementIdMap = ref<Map<string, string>>(new Map());

  // Computed
  const isEmpty = computed(
    () =>
      circles.value.length === 0 &&
      lineSegments.value.length === 0 &&
      points.value.length === 0 &&
      polygons.value.length === 0 &&
      notes.value.length === 0
  );

  const totalCount = computed(
    () =>
      circles.value.length + lineSegments.value.length + points.value.length + polygons.value.length
  );

  const circleCount = computed(() => circles.value.length);

  const lineSegmentCount = computed(() => lineSegments.value.length);

  const pointCount = computed(() => points.value.length);

  const polygonCount = computed(() => polygons.value.length);

  // Sorted layers by creation date (newest first)
  const sortedCircles = computed(() => {
    return circles.value.toSorted((a, b) => {
      const aTime = a.createdAt || 0;
      const bTime = b.createdAt || 0;
      return bTime - aTime; // Newest first
    });
  });

  const sortedLineSegments = computed(() => {
    return lineSegments.value.toSorted((a, b) => {
      const aTime = a.createdAt || 0;
      const bTime = b.createdAt || 0;
      return bTime - aTime; // Newest first
    });
  });

  const sortedPoints = computed(() => {
    return points.value.toSorted((a, b) => {
      const aTime = a.createdAt || 0;
      const bTime = b.createdAt || 0;
      return bTime - aTime; // Newest first
    });
  });

  const sortedPolygons = computed(() => {
    return polygons.value.toSorted((a, b) => {
      const aTime = a.createdAt || 0;
      const bTime = b.createdAt || 0;
      return bTime - aTime; // Newest first
    });
  });

  const noteCount = computed(() => notes.value.length);

  const sortedNotes = computed(() => {
    return notes.value.toSorted((a, b) => {
      const aTime = a.updatedAt || a.createdAt || 0;
      const bTime = b.updatedAt || b.createdAt || 0;
      return bTime - aTime; // Most recently updated first
    });
  });

  // Actions
  function addCircle(circle: CircleElement): void {
    // Add timestamp if not present
    if (!circle.createdAt) {
      circle.createdAt = Date.now();
    }
    circles.value.push(circle);
  }

  function updateCircle(id: string | undefined, circle: Partial<CircleElement>): void {
    const index = circles.value.findIndex((c) => c.id === id);
    if (index !== -1 && circles.value[index]) {
      circles.value[index] = { ...circles.value[index], ...circle };
    }
  }

  function deleteCircle(id: string | undefined): void {
    const index = circles.value.findIndex((c) => c.id === id);
    if (index !== -1 && circles.value[index]) {
      const circle = circles.value[index];
      if (circle && circle.mapElementId !== undefined) {
        mapElementIdMap.value.delete(`circle_${id}`);
      }
      circles.value.splice(index, 1);
    }
  }

  function addLineSegment(segment: LineSegmentElement): void {
    // Add timestamp if not present
    if (!segment.createdAt) {
      segment.createdAt = Date.now();
    }
    lineSegments.value.push(segment);

    // Update point references for this line
    if (segment.id) {
      updateLinePointReferences(segment.id);
    }
  }

  function updateLineSegment(id: string | undefined, segment: Partial<LineSegmentElement>): void {
    const index = lineSegments.value.findIndex((s) => s.id === id);
    if (index !== -1 && lineSegments.value[index]) {
      lineSegments.value[index] = {
        ...lineSegments.value[index],
        ...segment,
      } as LineSegmentElement;

      // Update point references for this line after updating
      if (id) {
        updateLinePointReferences(id);
      }
    }
  }

  function deleteLineSegment(id: string | undefined): void {
    const index = lineSegments.value.findIndex((s) => s.id === id);
    if (index !== -1 && lineSegments.value[index]) {
      const segment = lineSegments.value[index];
      if (segment && segment.mapElementId !== undefined) {
        mapElementIdMap.value.delete(`lineSegment_${id}`);
      }

      // Clear lineId from all points that reference this line
      if (id) {
        for (const point of points.value) {
          if (point.lineId === id) {
            point.lineId = undefined;
          }
        }
      }

      lineSegments.value.splice(index, 1);
    }
  }

  function addPoint(point: PointElement): void {
    // Add timestamp if not present
    if (!point.createdAt) {
      point.createdAt = Date.now();
    }
    points.value.push(point);

    // Update line references for this point (check if it lies on any existing line)
    if (point.id) {
      updatePointLineReference(point.id);
    }
  }

  function updatePoint(id: string | undefined, point: Partial<PointElement>): void {
    const index = points.value.findIndex((p) => p.id === id);
    if (index !== -1 && points.value[index]) {
      points.value[index] = { ...points.value[index], ...point } as PointElement;
    }
  }

  function deletePoint(id: string | undefined): void {
    const index = points.value.findIndex((p) => p.id === id);
    if (index !== -1 && points.value[index]) {
      const point = points.value[index];
      if (point && point.mapElementId !== undefined) {
        mapElementIdMap.value.delete(`point_${id}`);
      }

      // Remove references to this point from all lines
      if (id) {
        removePointReferencesFromLines(id);
      }

      // Remove point from polygons and check validity (bidirectional relationship cleanup)
      if (id && point && point.polygonIds) {
        const polygonsToDelete: string[] = [];

        for (const polygonId of point.polygonIds) {
          const polygon = polygons.value.find((p) => p.id === polygonId);
          if (polygon) {
            // Remove this point from polygon's pointIds
            polygon.pointIds = polygon.pointIds.filter((pid) => pid !== id);

            // If polygon now has < 3 points, mark for deletion
            if (polygon.pointIds.length < 3) {
              polygonsToDelete.push(polygonId);
            }
          }
        }

        // Delete invalid polygons
        for (const polygonId of polygonsToDelete) {
          deletePolygon(polygonId);
        }
      }

      // Delete the point
      points.value.splice(index, 1);
    }
  }

  function addPolygon(polygon: PolygonElement): void {
    // Add timestamp if not present
    if (!polygon.createdAt) {
      polygon.createdAt = Date.now();
    }
    polygons.value.push(polygon);

    // Update bidirectional relationship: polygon -> points and points -> polygon
    if (polygon.id) {
      updatePolygonPointReferences(polygon.id);
    }
  }

  function updatePolygon(id: string | undefined, polygon: Partial<PolygonElement>): void {
    const index = polygons.value.findIndex((p) => p.id === id);
    if (index !== -1 && polygons.value[index]) {
      polygons.value[index] = { ...polygons.value[index], ...polygon } as PolygonElement;

      // Update bidirectional relationship after updating polygon
      if (id) {
        updatePolygonPointReferences(id);
      }
    }
  }

  function deletePolygon(id: string | undefined): void {
    const index = polygons.value.findIndex((p) => p.id === id);
    if (index !== -1 && polygons.value[index]) {
      const polygon = polygons.value[index];

      // Clear polygon references from all points (bidirectional relationship cleanup)
      if (id && polygon && polygon.pointIds) {
        for (const pointId of polygon.pointIds) {
          const point = points.value.find((p) => p.id === pointId);
          if (point?.polygonIds) {
            point.polygonIds = point.polygonIds.filter((pid) => pid !== id);
          }
        }
      }

      if (polygon && polygon.mapElementId !== undefined) {
        mapElementIdMap.value.delete(`polygon_${id}`);
      }
      polygons.value.splice(index, 1);
    }
  }

  /**
   * Helper function to get element by type and id
   */
  function getElement(
    elementType: 'circle' | 'lineSegment' | 'point' | 'polygon',
    elementId: string
  ): CircleElement | LineSegmentElement | PointElement | PolygonElement | undefined {
    switch (elementType) {
      case 'circle': {
        return circles.value.find((c) => c.id === elementId);
      }
      case 'lineSegment': {
        return lineSegments.value.find((s) => s.id === elementId);
      }
      case 'point': {
        return points.value.find((p) => p.id === elementId);
      }
      case 'polygon': {
        return polygons.value.find((p) => p.id === elementId);
      }
      default: {
        return undefined;
      }
    }
  }

  function addNote(note: NoteElement): void {
    if (!note.createdAt) {
      note.createdAt = Date.now();
    }
    if (!note.updatedAt) {
      note.updatedAt = Date.now();
    }

    // Maintain bidirectional link: set element.noteId
    if (note.linkedElementType && note.linkedElementId && note.id) {
      const element = getElement(note.linkedElementType, note.linkedElementId);
      if (element) {
        // Check if element already has a note (enforce one-to-one)
        if (element.noteId && element.noteId !== note.id) {
          // Element already has a note, replacing with new note
        }
        element.noteId = note.id;
      }
    }

    notes.value.push(note);
  }

  function updateNote(id: string | undefined, note: Partial<NoteElement>): void {
    const index = notes.value.findIndex((n) => n.id === id);
    if (index !== -1 && notes.value[index]) {
      const oldNote = notes.value[index];
      const updatedNote = {
        ...oldNote,
        ...note,
        updatedAt: Date.now(),
      } as NoteElement;

      // Handle element linking changes
      const oldElementId = oldNote.linkedElementId;
      const oldElementType = oldNote.linkedElementType;
      const newElementId = updatedNote.linkedElementId;
      const newElementType = updatedNote.linkedElementType;

      // If element link changed, update both old and new elements
      if (oldElementId !== newElementId || oldElementType !== newElementType) {
        // Clear old element's noteId
        if (oldElementType && oldElementId) {
          const oldElement = getElement(oldElementType, oldElementId);
          if (oldElement && oldElement.noteId === id) {
            oldElement.noteId = undefined;
          }
        }

        // Set new element's noteId
        if (newElementType && newElementId && updatedNote.id) {
          const newElement = getElement(newElementType, newElementId);
          if (newElement) {
            if (newElement.noteId && newElement.noteId !== updatedNote.id) {
              // Element already has a note, replacing with updated note
            }
            newElement.noteId = updatedNote.id;
          }
        }
      }

      notes.value[index] = updatedNote;
    }
  }

  function deleteNote(id: string | undefined): void {
    const index = notes.value.findIndex((n) => n.id === id);
    if (index !== -1) {
      const note = notes.value[index];

      // Clear the linked element's noteId
      if (note && note.linkedElementType && note.linkedElementId) {
        const element = getElement(note.linkedElementType, note.linkedElementId);
        if (element && element.noteId === id) {
          element.noteId = undefined;
        }
      }

      notes.value.splice(index, 1);
    }
  }

  function storeMapElementId(
    elementType: string,
    elementId: string | undefined,
    mapElementId: string
  ): void {
    const key = `${elementType}_${elementId}`;
    mapElementIdMap.value.set(key, mapElementId);
  }

  function getMapElementId(elementType: string, elementId: string | undefined): string | undefined {
    const key = `${elementType}_${elementId}`;
    return mapElementIdMap.value.get(key);
  }

  function clearLayers(): void {
    circles.value = [];
    lineSegments.value = [];
    points.value = [];
    polygons.value = [];
    notes.value = [];
    mapElementIdMap.value.clear();
  }

  /**
   * Validate and sanitize element data before loading
   */
  function validateCircle(circle: any): circle is CircleElement {
    return (
      circle &&
      typeof circle.id === 'string' &&
      typeof circle.name === 'string' &&
      circle.center &&
      typeof circle.center.lat === 'number' &&
      typeof circle.center.lon === 'number' &&
      typeof circle.radius === 'number' &&
      !Number.isNaN(circle.center.lat) &&
      !Number.isNaN(circle.center.lon) &&
      !Number.isNaN(circle.radius) &&
      circle.radius > 0
    );
  }

  function validateLineSegment(segment: any): segment is LineSegmentElement {
    if (
      !segment ||
      typeof segment.id !== 'string' ||
      typeof segment.name !== 'string' ||
      !segment.center ||
      typeof segment.center.lat !== 'number' ||
      typeof segment.center.lon !== 'number' ||
      !segment.mode
    ) {
      return false;
    }

    // Special validation for parallel lines
    if (segment.mode === 'parallel') {
      return typeof segment.longitude === 'number' && !Number.isNaN(segment.longitude);
    }

    // Regular line segments need endpoint
    return (
      segment.endpoint &&
      typeof segment.endpoint.lat === 'number' &&
      typeof segment.endpoint.lon === 'number' &&
      !Number.isNaN(segment.endpoint.lat) &&
      !Number.isNaN(segment.endpoint.lon)
    );
  }

  function validatePoint(point: any): point is PointElement {
    return (
      point &&
      typeof point.id === 'string' &&
      typeof point.name === 'string' &&
      point.coordinates &&
      typeof point.coordinates.lat === 'number' &&
      typeof point.coordinates.lon === 'number' &&
      !Number.isNaN(point.coordinates.lat) &&
      !Number.isNaN(point.coordinates.lon)
    );
  }

  function validatePolygon(polygon: any): polygon is PolygonElement {
    return (
      polygon &&
      typeof polygon.id === 'string' &&
      typeof polygon.name === 'string' &&
      Array.isArray(polygon.pointIds) &&
      polygon.pointIds.length >= 3 &&
      polygon.pointIds.every((pointId: any) => typeof pointId === 'string')
    );
  }

  function validateNote(note: any): note is NoteElement {
    return (
      note &&
      typeof note.id === 'string' &&
      typeof note.title === 'string' &&
      typeof note.content === 'string'
    );
  }

  // Helper to migrate legacy savedCoordinates to points
  function migrateSavedCoordinatesToPoints(
    savedCoordinates: Array<{
      id: string;
      name: string;
      lat: number;
      lon: number;
      timestamp?: number;
    }>,
    validPoints: PointElement[]
  ): void {
    for (const coord of savedCoordinates) {
      if (
        !coord ||
        typeof coord.id !== 'string' ||
        typeof coord.name !== 'string' ||
        typeof coord.lat !== 'number' ||
        typeof coord.lon !== 'number' ||
        Number.isNaN(coord.lat) ||
        Number.isNaN(coord.lon)
      ) {
        continue;
      }

      // Check if a point with this ID or at these coordinates already exists
      const existingPoint = validPoints.find((p) => p.id === coord.id);
      if (existingPoint) {
        continue;
      }

      const pointAtCoords = validPoints.find(
        (p) =>
          Math.abs(p.coordinates.lat - coord.lat) < 0.000_001 &&
          Math.abs(p.coordinates.lon - coord.lon) < 0.000_001
      );
      if (pointAtCoords) {
        continue;
      }

      // Convert coordinate to point
      validPoints.push({
        id: coord.id,
        name: coord.name,
        coordinates: { lat: coord.lat, lon: coord.lon },
        createdAt: coord.timestamp || Date.now(),
      });
    }
  }

  function loadLayers(data: {
    circles: CircleElement[];
    lineSegments: LineSegmentElement[];
    points: PointElement[];
    polygons?: PolygonElement[];
    notes?: NoteElement[];
    // Legacy field - savedCoordinates are migrated to points
    savedCoordinates?: Array<{
      id: string;
      name: string;
      lat: number;
      lon: number;
      timestamp?: number;
    }>;
  }): void {
    clearLayers();

    // Validate and filter data before loading
    const validCircles = (data.circles || []).filter((circle) => {
      return validateCircle(circle);
    });

    const validLineSegments = (data.lineSegments || []).filter((segment) => {
      return validateLineSegment(segment);
    });

    const validPoints = (data.points || []).filter((point) => {
      return validatePoint(point);
    });

    // Migrate legacy savedCoordinates to points
    if (data.savedCoordinates && Array.isArray(data.savedCoordinates)) {
      migrateSavedCoordinatesToPoints(data.savedCoordinates, validPoints);
    }

    // Migrate old polygon format (coordinates) to new format (point IDs)
    const validPolygons = (data.polygons || [])
      .map((polygon: any) => {
        // Check if this is an old format polygon with coordinates
        if (polygon.points && !polygon.pointIds && Array.isArray(polygon.points)) {
          // Old format: has coordinates array, need to convert to point IDs
          const pointIds: string[] = [];

          for (const coord of polygon.points) {
            if (
              coord &&
              typeof coord.lat === 'number' &&
              typeof coord.lon === 'number' &&
              !Number.isNaN(coord.lat) &&
              !Number.isNaN(coord.lon)
            ) {
              // Try to find existing point at these coordinates
              let point = validPoints.find(
                (p) =>
                  Math.abs(p.coordinates.lat - coord.lat) < 0.000_001 &&
                  Math.abs(p.coordinates.lon - coord.lon) < 0.000_001
              );

              if (!point) {
                // Create a new point for this coordinate
                const pointId = `${polygon.id}-point-${pointIds.length}`;
                point = {
                  id: pointId,
                  name: `${polygon.name} Point ${pointIds.length + 1}`,
                  coordinates: { lat: coord.lat, lon: coord.lon },
                  createdAt: Date.now(),
                };
                validPoints.push(point);
              }

              pointIds.push(point.id);
            }
          }

          // Return migrated polygon (convert to new format)
          return {
            ...polygon,
            pointIds,
            points: undefined, // Remove old field
          };
        }

        // New format: already has pointIds
        return polygon;
      })
      .filter((polygon) => {
        return validatePolygon(polygon);
      });

    const validNotes = (data.notes || []).filter((note) => {
      return validateNote(note);
    });

    // Assign timestamps to elements that don't have them (for old projects)
    // Use a sequential counter to maintain original order
    let baseTimestamp =
      Date.now() -
      (validCircles.length + validLineSegments.length + validPoints.length + validPolygons.length) *
        1000;

    for (const circle of validCircles) {
      if (!circle.createdAt) {
        circle.createdAt = baseTimestamp;
        baseTimestamp += 1000; // 1 second apart
      }
    }

    for (const segment of validLineSegments) {
      if (!segment.createdAt) {
        segment.createdAt = baseTimestamp;
        baseTimestamp += 1000;
      }
    }

    for (const point of validPoints) {
      if (!point.createdAt) {
        point.createdAt = baseTimestamp;
        baseTimestamp += 1000;
      }
    }

    for (const polygon of validPolygons) {
      if (!polygon.createdAt) {
        polygon.createdAt = baseTimestamp;
        baseTimestamp += 1000;
      }
    }

    for (const note of validNotes) {
      if (!note.createdAt) {
        note.createdAt = baseTimestamp;
        baseTimestamp += 1000;
      }
    }

    circles.value = [...validCircles];
    lineSegments.value = [...validLineSegments];
    points.value = [...validPoints];
    polygons.value = [...validPolygons];
    notes.value = [...validNotes];

    // Update point references in all lines
    // This ensures compatibility with both old projects (without point refs)
    // and new projects (with point refs), and handles any data inconsistencies
    for (const segment of lineSegments.value) {
      if (segment.id) {
        updateLinePointReferences(segment.id);
      }
    }

    // Update point references in all polygons (bidirectional relationship)
    // This ensures compatibility with both old projects (migrated from coordinates)
    // and new projects (with point IDs), and handles any data inconsistencies
    for (const polygon of polygons.value) {
      if (polygon.id) {
        updatePolygonPointReferences(polygon.id);
      }
    }
  }

  function exportLayers() {
    return {
      circles: circles.value,
      lineSegments: lineSegments.value,
      points: points.value,
      polygons: polygons.value,
      notes: notes.value,
    };
  }

  // Helper function to find a point at specific coordinates
  function findPointAtCoordinates(
    lat: number,
    lon: number,
    tolerance = 0.0001
  ): PointElement | undefined {
    return points.value.find(
      (p) =>
        Math.abs(p.coordinates.lat - lat) < tolerance &&
        Math.abs(p.coordinates.lon - lon) < tolerance
    );
  }

  // Helper function to update point references in lines when a line is created/updated
  // Maintains bidirectional relationship: line -> point and point -> line
  function updateLinePointReferences(lineId: string) {
    const line = lineSegments.value.find((l) => l.id === lineId);
    if (!line || !line.center) return;

    // Find points at start and end positions
    const startPoint = findPointAtCoordinates(line.center.lat, line.center.lon);
    const endPoint = line.endpoint
      ? findPointAtCoordinates(line.endpoint.lat, line.endpoint.lon)
      : undefined;

    // Update the line with point references
    line.startPointId = startPoint?.id;
    line.endPointId = endPoint?.id;

    // Initialize pointsOnLine if not present
    if (!line.pointsOnLine) {
      line.pointsOnLine = [];
    }

    // Update bidirectional relationship: set this line as the point's lineId (1 point => 0 or 1 line)
    if (startPoint) {
      startPoint.lineId = lineId;
    }

    if (endPoint) {
      endPoint.lineId = lineId;
    }

    // Also update lineId for points in pointsOnLine array
    for (const pointId of line.pointsOnLine) {
      const point = points.value.find((p) => p.id === pointId);
      if (point) {
        point.lineId = lineId;
      }
    }
  }

  // Helper function to update a point's line reference when the point is created
  // Checks if the point lies on any existing line (at start, end, or along the line)
  function updatePointLineReference(pointId: string) {
    const pointIndex = points.value.findIndex((p) => p.id === pointId);
    if (pointIndex === -1) return;

    const point = points.value[pointIndex];
    if (!point) return;

    const tolerance = 0.0001;

    for (const line of lineSegments.value) {
      // Check if point is at line start
      if (
        Math.abs(point.coordinates.lat - line.center.lat) < tolerance &&
        Math.abs(point.coordinates.lon - line.center.lon) < tolerance
      ) {
        // Use array replacement to ensure Vue reactivity detects the change
        points.value[pointIndex] = { ...point, lineId: line.id };
        line.startPointId = pointId;
        return;
      }

      // Check if point is at line end
      if (
        line.endpoint &&
        Math.abs(point.coordinates.lat - line.endpoint.lat) < tolerance &&
        Math.abs(point.coordinates.lon - line.endpoint.lon) < tolerance
      ) {
        // Use array replacement to ensure Vue reactivity detects the change
        points.value[pointIndex] = { ...point, lineId: line.id };
        line.endPointId = pointId;
        return;
      }
    }
  }

  // Helper function to remove point references from all lines when a point is deleted
  function removePointReferencesFromLines(pointId: string) {
    for (const line of lineSegments.value) {
      // Remove from startPointId
      if (line.startPointId === pointId) {
        line.startPointId = undefined;
      }

      // Remove from endPointId
      if (line.endPointId === pointId) {
        line.endPointId = undefined;
      }

      // Remove from pointsOnLine array
      if (line.pointsOnLine && line.pointsOnLine.includes(pointId)) {
        line.pointsOnLine = line.pointsOnLine.filter((id) => id !== pointId);
      }
    }
  }

  // Helper function to get all lines that reference a specific point
  function getLinesReferencingPoint(pointId: string): LineSegmentElement[] {
    return lineSegments.value.filter(
      (line) =>
        line.startPointId === pointId ||
        line.endPointId === pointId ||
        (line.pointsOnLine && line.pointsOnLine.includes(pointId))
    );
  }

  // Helper function to update point references in polygons when a polygon is created/updated
  // Maintains bidirectional relationship: polygon -> points and points -> polygon
  function updatePolygonPointReferences(polygonId: string) {
    const polygon = polygons.value.find((p) => p.id === polygonId);
    if (!polygon || !polygon.pointIds) return;

    // Update bidirectional relationship: polygon → points and points → polygon
    for (const pointId of polygon.pointIds) {
      const point = points.value.find((p) => p.id === pointId);
      if (point) {
        // Initialize polygonIds array if not present
        if (!point.polygonIds) {
          point.polygonIds = [];
        }
        // Add this polygon if not already referenced
        if (!point.polygonIds.includes(polygonId)) {
          point.polygonIds.push(polygonId);
        }
      }
    }

    // Clean up: remove polygon reference from points no longer in polygon
    for (const point of points.value) {
      if (point.polygonIds?.includes(polygonId) && !polygon.pointIds.includes(point.id)) {
        point.polygonIds = point.polygonIds.filter((pid) => pid !== polygonId);
      }
    }
  }

  // Helper function to get all polygons that reference a specific point
  function getPolygonsReferencingPoint(pointId: string): PolygonElement[] {
    return polygons.value.filter((polygon) => polygon.pointIds?.includes(pointId));
  }

  return {
    // State
    circles,
    lineSegments,
    points,
    polygons,
    notes,
    mapElementIdMap,

    // Computed
    isEmpty,
    totalCount,
    circleCount,
    lineSegmentCount,
    pointCount,
    polygonCount,
    noteCount,
    sortedCircles,
    sortedLineSegments,
    sortedPoints,
    sortedPolygons,
    sortedNotes,

    // Actions
    addCircle,
    updateCircle,
    deleteCircle,
    addLineSegment,
    updateLineSegment,
    deleteLineSegment,
    addPoint,
    updatePoint,
    deletePoint,
    addPolygon,
    updatePolygon,
    deletePolygon,
    addNote,
    updateNote,
    deleteNote,
    storeMapElementId,
    getMapElementId,
    clearLayers,
    loadLayers,
    exportLayers,
    findPointAtCoordinates,
    updateLinePointReferences,
    removePointReferencesFromLines,
    getLinesReferencingPoint,
    updatePolygonPointReferences,
    getPolygonsReferencingPoint,
  };
});
