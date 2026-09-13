import type {
  CircleElement,
  LayerImportData,
  LegacyCoordinate,
  LegacyPolygon,
  LineSegmentElement,
  NoteElement,
  PointElement,
  PolygonElement,
  ProjectLayerData,
  ProjectProjection,
} from '@/types/project';
import { v4 as uuidv4 } from 'uuid';
import { isRecord } from '@/utils/guards';

function isOptionalIdList(value: unknown): value is string[] | undefined {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every((id: unknown) => typeof id === 'string'))
  );
}

/**
 * Validate and sanitize element data before loading
 */
function validateCircle(circle: unknown): circle is CircleElement {
  return (
    isRecord(circle) &&
    typeof circle.id === 'string' &&
    typeof circle.name === 'string' &&
    isRecord(circle.center) &&
    typeof circle.center.lat === 'number' &&
    typeof circle.center.lon === 'number' &&
    typeof circle.radius === 'number' &&
    Number.isFinite(circle.center.lat) &&
    Number.isFinite(circle.center.lon) &&
    Number.isFinite(circle.radius) &&
    circle.radius > 0
  );
}

function validateLineSegment(segment: unknown): segment is LineSegmentElement {
  if (
    !isRecord(segment) ||
    typeof segment.id !== 'string' ||
    typeof segment.name !== 'string' ||
    !isRecord(segment.center) ||
    typeof segment.center.lat !== 'number' ||
    typeof segment.center.lon !== 'number' ||
    !Number.isFinite(segment.center.lat) ||
    !Number.isFinite(segment.center.lon) ||
    !isOptionalIdList(segment.pointsOnLine) ||
    (segment.angleFrom !== undefined &&
      (!isRecord(segment.angleFrom) ||
        typeof segment.angleFrom.lineId !== 'string' ||
        typeof segment.angleFrom.degrees !== 'number' ||
        !Number.isFinite(segment.angleFrom.degrees))) ||
    (segment.intersectionExtension !== undefined &&
      (typeof segment.intersectionExtension !== 'number' ||
        !Number.isFinite(segment.intersectionExtension) ||
        segment.intersectionExtension < 0)) ||
    typeof segment.mode !== 'string' ||
    !['coordinate', 'azimuth', 'intersection', 'parallel'].includes(segment.mode)
  ) {
    return false;
  }

  // Special validation for parallel lines
  if (segment.mode === 'parallel') {
    return typeof segment.longitude === 'number' && Number.isFinite(segment.longitude);
  }

  // Regular line segments need endpoint
  return (
    isRecord(segment.endpoint) &&
    typeof segment.endpoint.lat === 'number' &&
    typeof segment.endpoint.lon === 'number' &&
    Number.isFinite(segment.endpoint.lat) &&
    Number.isFinite(segment.endpoint.lon)
  );
}

function validatePoint(point: unknown): point is PointElement {
  return (
    isRecord(point) &&
    typeof point.id === 'string' &&
    typeof point.name === 'string' &&
    isRecord(point.coordinates) &&
    typeof point.coordinates.lat === 'number' &&
    typeof point.coordinates.lon === 'number' &&
    Number.isFinite(point.coordinates.lat) &&
    Number.isFinite(point.coordinates.lon) &&
    isOptionalIdList(point.polygonIds) &&
    (point.construction === undefined ||
      (isRecord(point.construction) &&
        typeof point.construction.lineId === 'string' &&
        (point.construction.distanceKm === undefined ||
          (typeof point.construction.distanceKm === 'number' &&
            Number.isFinite(point.construction.distanceKm) &&
            point.construction.distanceKm >= 0)) &&
        (point.construction.fromEnd === undefined ||
          typeof point.construction.fromEnd === 'boolean')))
  );
}

function validatePolygon(polygon: unknown): polygon is PolygonElement {
  return (
    isRecord(polygon) &&
    typeof polygon.id === 'string' &&
    typeof polygon.name === 'string' &&
    Array.isArray(polygon.pointIds) &&
    polygon.pointIds.length >= 3 &&
    polygon.pointIds.every((pointId: unknown) => typeof pointId === 'string')
  );
}

function validateNote(note: unknown): note is NoteElement {
  return (
    isRecord(note) &&
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
    const existingPoint = validPoints.some((p) => p.id === coord.id);
    if (existingPoint) {
      continue;
    }

    const pointAtCoords = validPoints.some(
      (p) =>
        Math.abs(p.coordinates.lat - coord.lat) < 0.000001 &&
        Math.abs(p.coordinates.lon - coord.lon) < 0.000001
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

export function normalizeLayers(data: LayerImportData): ProjectLayerData {
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
    .map((polygon) => {
      // Check if this is an old format polygon with coordinates
      if ('points' in polygon && !polygon.pointIds && Array.isArray(polygon.points)) {
        // Old format: has coordinates array, need to convert to point IDs
        const pointIds: string[] = [];

        for (const coord of polygon.points) {
          if (
            coord &&
            typeof coord.lat === 'number' &&
            typeof coord.lon === 'number' &&
            Number.isFinite(coord.lat) &&
            Number.isFinite(coord.lon)
          ) {
            // Try to find existing point at these coordinates
            let point = validPoints.find(
              (p) =>
                Math.abs(p.coordinates.lat - coord.lat) < 0.000001 &&
                Math.abs(p.coordinates.lon - coord.lon) < 0.000001
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

  for (const element of [
    ...validCircles,
    ...validLineSegments,
    ...validPoints,
    ...validPolygons,
    ...validNotes,
  ]) {
    if (!element.createdAt) {
      element.createdAt = baseTimestamp;
      baseTimestamp += 1000;
    }
  }

  return {
    circles: validCircles,
    lineSegments: validLineSegments,
    points: validPoints,
    polygons: validPolygons,
    notes: validNotes,
  };
}

/** Parse an exported project or a legacy layer-only file without mutating application state. */
export function parseLayersJSON(json: string): ProjectLayerData {
  const value: unknown = JSON.parse(json);
  if (!isRecord(value)) throw new Error('Invalid project format');
  const data = isRecord(value.data) ? value.data : value;
  const keys = [
    'circles',
    'lineSegments',
    'points',
    'polygons',
    'notes',
    'coordinates',
    'savedCoordinates',
  ];
  if (!keys.some((key) => Array.isArray(data[key]))) throw new Error('Invalid project format');

  function array<T>(key: string, validate: (item: unknown) => item is T): T[] {
    const items: unknown = data[key];
    if (items === undefined) return [];
    if (!Array.isArray(items) || !items.every((item: unknown) => validate(item)))
      throw new Error(`Invalid project field: ${key}`);
    return items;
  }

  const coordinates = array('coordinates', isLegacyCoordinate);
  const savedCoordinates = array('savedCoordinates', isLegacyCoordinate);
  return normalizeLayers({
    circles: array('circles', validateCircle),
    lineSegments: array('lineSegments', validateLineSegment),
    points: array('points', validatePoint),
    polygons: array('polygons', isImportPolygon),
    notes: array('notes', validateNote),
    savedCoordinates: [...coordinates, ...savedCoordinates].map((coordinate) => ({
      ...coordinate,
      id: coordinate.id || uuidv4(),
    })),
  });
}

function isLegacyCoordinate(
  value: unknown
): value is Omit<LegacyCoordinate, 'id'> & { id?: string } {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    typeof value.lat === 'number' &&
    Number.isFinite(value.lat) &&
    typeof value.lon === 'number' &&
    Number.isFinite(value.lon) &&
    (value.id === undefined || typeof value.id === 'string')
  );
}

function isImportPolygon(value: unknown): value is PolygonElement | LegacyPolygon {
  if (validatePolygon(value)) return true;
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    Array.isArray(value.points) &&
    value.points.length >= 3 &&
    value.points.every(
      (point: unknown) =>
        isRecord(point) &&
        typeof point.lat === 'number' &&
        Number.isFinite(point.lat) &&
        typeof point.lon === 'number' &&
        Number.isFinite(point.lon)
    )
  );
}

/** Validate the project setting before callers replace any active drawings. */
export function parseProjectJSON(json: string): {
  data: ProjectLayerData;
  projection: ProjectProjection;
} {
  const value: unknown = JSON.parse(json);
  if (!isRecord(value)) throw new Error('Invalid project format');
  const projection = value.projection === undefined ? 'mercator' : value.projection;
  if (projection !== 'mercator' && projection !== 'geodesic')
    throw new Error('Invalid project projection');
  return { data: parseLayersJSON(json), projection };
}
