import type { LatLon } from './geometry';
import type { ProjectLayerData, ProjectProjection } from '@/types/project';
import { parseLayersJSON } from '@/domain/layers';
import { createProjectGeometry } from './projectGeometry';

/** Stage all calculations on a copy, so a failed conversion cannot damage the project. */
export function changeProjectProjection(
  layers: ProjectLayerData,
  previous: ProjectProjection,
  projection: ProjectProjection
): ProjectLayerData {
  return rebuildConstructions(layers, previous, projection);
}

/** Recompute the edited line and its generated endpoints and dependent constructions. */
export function changeIntersectionExtension(
  layers: ProjectLayerData,
  lineId: string,
  extensionKm: number,
  projection: ProjectProjection
): ProjectLayerData {
  if (!Number.isFinite(extensionKm) || extensionKm < 0) throw new Error('Invalid extension');
  return rebuildConstructions(layers, projection, projection, { lineId, extensionKm });
}

function rebuildConstructions(
  layers: ProjectLayerData,
  previous: ProjectProjection,
  projection: ProjectProjection,
  edit?: { lineId: string; extensionKm: number }
): ProjectLayerData {
  // The live layers may be Vue proxies. Validate a serialized snapshot before changing it.
  const result = parseLayersJSON(JSON.stringify(layers));
  if (previous === projection && !edit) return result;
  const before = createProjectGeometry(() => previous);
  const after = createProjectGeometry(() => projection);
  const lines = new Map(result.lineSegments.map((line) => [line.id, line]));
  const points = new Map(result.points.map((point) => [point.id, point]));
  const originalPoints = new Map(layers.points.map((point) => [point.id, point]));
  const visited = new Set<string>();
  const changedLines = new Set<string>();
  const visiting = new Set<string>();

  if (edit) {
    const line = lines.get(edit.lineId);
    if (line?.mode !== 'intersection' || !line.intersectionPoint || !line.endpoint)
      throw new Error('Invalid intersection line');
    line.intersectionExtension = edit.extensionKm;
    // Older intersection lines linked their generated endpoint without construction metadata.
    const endpoint = line.endPointId ? points.get(line.endPointId) : undefined;
    if (
      endpoint &&
      !endpoint.construction &&
      (Math.abs(endpoint.coordinates.lat - line.intersectionPoint.lat) > 0.000001 ||
        Math.abs(endpoint.coordinates.lon - line.intersectionPoint.lon) > 0.000001) &&
      (Math.abs(endpoint.coordinates.lat - line.center.lat) > 0.000001 ||
        Math.abs(endpoint.coordinates.lon - line.center.lon) > 0.000001)
    ) {
      endpoint.construction = { lineId: line.id };
    }
  }

  // Older files recorded points added along lines without their distance input.
  for (const line of result.lineSegments) {
    for (const id of line.pointsOnLine ?? []) {
      const point = points.get(id);
      if (point && !point.construction && id !== line.startPointId && id !== line.endPointId) {
        point.construction = {
          lineId: line.id,
          distanceKm:
            before.getDistance(
              [line.center.lon, line.center.lat],
              [point.coordinates.lon, point.coordinates.lat]
            ) / 1000,
        };
      }
    }
    if (line.mode === 'intersection' && line.intersectionPoint && line.endpoint) {
      line.intersectionExtension ??=
        before.getDistance(
          [line.intersectionPoint.lon, line.intersectionPoint.lat],
          [line.endpoint.lon, line.endpoint.lat]
        ) / 1000;
    }
  }

  function resolvePoint(id: string): LatLon | undefined {
    const point = points.get(id);
    const construction = point?.construction;
    if (!point || !construction) return point?.coordinates;
    const line = lines.get(construction.lineId);
    if (!line) return point.coordinates;
    resolveLine(line.id);
    if (edit && !changedLines.has(line.id)) return point.coordinates;
    if (line.endpoint) {
      if (
        edit &&
        construction.distanceKm !== undefined &&
        construction.distanceKm >
          after.getDistance(
            [line.center.lon, line.center.lat],
            [line.endpoint.lon, line.endpoint.lat]
          ) /
            1000
      ) {
        // Shortening a line must not delete points that now lie beyond its endpoint.
        point.construction = undefined;
        point.lineId = undefined;
        line.pointsOnLine = line.pointsOnLine?.filter((id) => id !== point.id);
        return point.coordinates;
      }
      point.coordinates =
        construction.distanceKm === undefined
          ? { ...line.endpoint }
          : after.pointAtDistance(
              line.center,
              line.endpoint,
              construction.distanceKm,
              construction.fromEnd
            );
    }
    return point.coordinates;
  }

  function resolveCoordinate(coordinate: LatLon, referenceId?: string, ownerId?: string): LatLon {
    const id =
      referenceId ??
      [...originalPoints.values()].find(
        (point) =>
          Math.abs(point.coordinates.lat - coordinate.lat) < 0.000001 &&
          Math.abs(point.coordinates.lon - coordinate.lon) < 0.000001
      )?.id;
    if (id && points.get(id)?.construction?.lineId === ownerId) return coordinate;
    return (id && resolvePoint(id)) || coordinate;
  }

  function resolveLine(id: string): void {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error('Circular construction references');
    const line = lines.get(id);
    if (!line || line.mode === 'parallel') return;
    visiting.add(id);
    const originalCenter = line.center;
    const originalEndpoint = line.endpoint;
    const originalIntersection = line.intersectionPoint;
    const changed = (before: LatLon | undefined, after: LatLon | undefined) =>
      before?.lat !== after?.lat || before?.lon !== after?.lon;
    line.center = { ...resolveCoordinate(line.center, line.startPointId, line.id) };
    let rebuild = !edit || line.id === edit.lineId || changed(originalCenter, line.center);
    if (line.intersectionPoint) {
      line.intersectionPoint = { ...resolveCoordinate(line.intersectionPoint, undefined, line.id) };
      rebuild ||= changed(originalIntersection, line.intersectionPoint);
    }
    if (line.angleFrom) {
      const reference = lines.get(line.angleFrom.lineId);
      if (reference) {
        resolveLine(reference.id);
        if (!edit || rebuild || changedLines.has(reference.id)) {
          const bearing = after.bearingAtPoint(reference, line.center);
          if (bearing !== null) line.azimuth = (bearing + line.angleFrom.degrees + 360) % 360;
          rebuild = true;
        }
      }
    }
    if (
      line.mode === 'azimuth' &&
      rebuild &&
      line.distance !== undefined &&
      line.azimuth !== undefined
    ) {
      line.endpoint = after.destinationPoint(
        line.center.lat,
        line.center.lon,
        line.distance,
        line.azimuth
      );
    } else if (
      line.mode === 'intersection' &&
      rebuild &&
      line.intersectionPoint &&
      line.intersectionExtension !== undefined
    ) {
      line.endpoint = after.endpointFromIntersection(
        line.center.lat,
        line.center.lon,
        line.intersectionPoint.lat,
        line.intersectionPoint.lon,
        line.intersectionExtension
      );
      line.distance =
        after.getDistance(
          [line.center.lon, line.center.lat],
          [line.endpoint.lon, line.endpoint.lat]
        ) / 1000;
      line.intersectionDistance = line.distance;
    } else if (line.mode === 'coordinate' && line.endpoint) {
      line.endpoint = { ...resolveCoordinate(line.endpoint, line.endPointId, line.id) };
    }
    if (
      changed(originalCenter, line.center) ||
      changed(originalEndpoint, line.endpoint) ||
      changed(originalIntersection, line.intersectionPoint)
    )
      changedLines.add(id);
    if (
      line.endpoint &&
      (!Number.isFinite(line.endpoint.lat) || !Number.isFinite(line.endpoint.lon))
    ) {
      throw new Error('Invalid calculated endpoint');
    }
    visiting.delete(id);
    visited.add(id);
  }

  for (const line of result.lineSegments) resolveLine(line.id);
  for (const point of result.points) resolvePoint(point.id);
  return result;
}
