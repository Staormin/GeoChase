import type { LatLon } from './geometry';
import type { LineSegmentElement, ProjectProjection } from '@/types/project';
import { LineString, Polygon } from 'ol/geom';
import { fromLonLat, toLonLat } from 'ol/proj';
import { offset, getArea as sphericalArea, getDistance as sphericalDistance } from 'ol/sphere';
import { cartesGouvBearing, cartesGouvDestination } from './cartesGouvGeometry';
import {
  densifyGeodesic,
  geodesicDestination,
  geodesicIntermediate,
  geodesicInverse,
  geodesicPolygonArea,
} from './geodesy';
import * as legacy from './geometry';

/** Shared geometry policy for drawing, measurements, navigation, search and export. */
export function createProjectGeometry(getProjection: () => ProjectProjection) {
  const isGeodesic = () => getProjection() === 'geodesic';
  function getDistance(from: number[], to: number[]): number {
    return isGeodesic()
      ? geodesicInverse({ lon: from[0]!, lat: from[1]! }, { lon: to[0]!, lat: to[1]! }).distance
      : sphericalDistance(from, to);
  }
  function destinationPoint(lat: number, lon: number, distanceKm: number, bearing: number): LatLon {
    return isGeodesic()
      ? geodesicDestination({ lat, lon }, bearing, distanceKm * 1000)
      : cartesGouvDestination({ lat, lon }, distanceKm, bearing);
  }
  function calculateBearing(lat: number, lon: number, endLat: number, endLon: number): number {
    return isGeodesic()
      ? geodesicInverse({ lat, lon }, { lat: endLat, lon: endLon }).initialBearing
      : cartesGouvBearing({ lat, lon }, { lat: endLat, lon: endLon });
  }
  function endpointFromIntersection(
    lat: number,
    lon: number,
    throughLat: number,
    throughLon: number,
    extensionKm: number
  ): LatLon {
    if (!isGeodesic())
      return legacy.endpointFromIntersection(lat, lon, throughLat, throughLon, extensionKm);
    if (!Number.isFinite(extensionKm) || extensionKm < 0) throw new RangeError('Invalid extension');
    const through = { lat: throughLat, lon: throughLon };
    if (extensionKm === 0) return through;
    const approach = geodesicInverse({ lat, lon }, through);
    if (approach.distance === 0) throw new RangeError('Two distinct points are required');
    return geodesicDestination(through, approach.finalBearing, extensionKm * 1000);
  }
  function sampleLine(
    lat: number,
    lon: number,
    endLat: number,
    endLon: number,
    segments = 120
  ): LatLon[] {
    return isGeodesic()
      ? densifyGeodesic({ lat, lon }, { lat: endLat, lon: endLon }, segments + 1)
      : legacy.generateLinePointsLinear(lat, lon, endLat, endLon, segments);
  }
  function lineCoordinates(from: LatLon, to: LatLon): number[][] {
    return (isGeodesic() ? densifyGeodesic(from, to) : [from, to]).map((point) =>
      fromLonLat([point.lon, point.lat])
    );
  }
  function interpolateLine(from: LatLon, to: LatLon, fraction: number): LatLon {
    if (from.lat === to.lat && from.lon === to.lon) return { ...from };
    if (isGeodesic()) return geodesicIntermediate(from, to, fraction);
    const start = fromLonLat([from.lon, from.lat]);
    const end = fromLonLat([to.lon, to.lat]);
    const [lon, lat] = toLonLat([
      start[0]! + (end[0]! - start[0]!) * fraction,
      start[1]! + (end[1]! - start[1]!) * fraction,
    ]);
    return { lat: lat!, lon: lon! };
  }
  function pointAtDistance(from: LatLon, to: LatLon, distanceKm: number, fromEnd = false): LatLon {
    if (!Number.isFinite(distanceKm) || distanceKm < 0) throw new RangeError('Invalid distance');
    const origin = fromEnd ? to : from;
    const end = fromEnd ? from : to;
    const length = getDistance([origin.lon, origin.lat], [end.lon, end.lat]) / 1000;
    if (distanceKm > length + 0.0001) throw new RangeError('Distance exceeds the line length');
    if (distanceKm === 0 || length === 0) return { ...origin };
    if (Math.abs(distanceKm - length) < 0.0000001) return { ...end };
    if (isGeodesic()) return geodesicIntermediate(origin, end, Math.min(1, distanceKm / length));
    let low = 0;
    let high = 1;
    for (let i = 0; i < 40; i++) {
      const fraction = (low + high) / 2;
      const point = interpolateLine(origin, end, fraction);
      const measured = getDistance([origin.lon, origin.lat], [point.lon, point.lat]) / 1000;
      if (Math.abs(measured - distanceKm) < 0.00001) return point;
      if (measured < distanceKm) low = fraction;
      else high = fraction;
    }
    return interpolateLine(origin, end, (low + high) / 2);
  }
  function getSegmentEndpoint(segment: LineSegmentElement): LatLon | undefined {
    return (
      segment.endpoint ??
      (segment.mode === 'azimuth' && segment.distance !== undefined && segment.azimuth !== undefined
        ? destinationPoint(
            segment.center.lat,
            segment.center.lon,
            segment.distance,
            segment.azimuth
          )
        : undefined)
    );
  }
  function bearingAtPoint(segment: LineSegmentElement, point: LatLon): number | null {
    if (segment.mode === 'parallel') return 90;
    const endpoint = getSegmentEndpoint(segment);
    if (!endpoint) return null;
    if (!isGeodesic())
      return calculateBearing(segment.center.lat, segment.center.lon, endpoint.lat, endpoint.lon);
    if (
      Math.abs(point.lat - endpoint.lat) < 0.000001 &&
      Math.abs(point.lon - endpoint.lon) < 0.000001
    ) {
      return geodesicInverse(segment.center, endpoint).finalBearing;
    }
    return calculateBearing(point.lat, point.lon, endpoint.lat, endpoint.lon);
  }
  /** Match saved coordinates to the actual line, allowing for six-decimal point inputs. */
  function isPointOnLine(segment: LineSegmentElement, point: LatLon): boolean {
    const toleranceM = 1;
    const coordinate = [point.lon, point.lat];
    if (segment.mode === 'parallel') {
      return (
        getDistance(coordinate, [point.lon, segment.longitude ?? segment.center.lat]) <= toleranceM
      );
    }
    const endpoint = getSegmentEndpoint(segment);
    if (!endpoint) return false;
    const length = getDistance(
      [segment.center.lon, segment.center.lat],
      [endpoint.lon, endpoint.lat]
    );
    if (length === 0) return false;

    if (isGeodesic()) {
      // Points created by distance lie on the exact geodesic, between rendered vertices.
      const distance = getDistance([segment.center.lon, segment.center.lat], coordinate);
      if (distance <= length + toleranceM) {
        const onArc = geodesicIntermediate(
          segment.center,
          endpoint,
          Math.min(1, distance / length)
        );
        if (getDistance(coordinate, [onArc.lon, onArc.lat]) <= toleranceM) return true;
      }
    }

    // Crossing points lie on the rendered path, including sampled geodesic segments.
    const path = new LineString(lineCoordinates(segment.center, endpoint));
    const projected = fromLonLat(coordinate);
    const extent = path.getExtent();
    const worldWidth = 2 * fromLonLat([180, 0])[0]!;
    projected[0] =
      projected[0]! +
      Math.round(((extent[0]! + extent[2]!) / 2 - projected[0]!) / worldWidth) * worldWidth;
    const closest = toLonLat(path.getClosestPoint(projected));
    return getDistance(coordinate, closest) <= toleranceM;
  }
  // A circle radius is a ground distance, independent of the azimuth convention
  // used to construct straight Mercator lines.
  function circlePoint(lat: number, lon: number, radiusKm: number, bearing: number): LatLon {
    if (isGeodesic()) return geodesicDestination({ lat, lon }, bearing, radiusKm * 1000);
    const coordinates = offset([lon, lat], radiusKm * 1000, (bearing * Math.PI) / 180);
    return { lon: coordinates[0]!, lat: coordinates[1]! };
  }
  function generateCircle(lat: number, lon: number, radiusKm: number, segments = 360): LatLon[] {
    const points = Array.from({ length: segments }, (_, i) =>
      circlePoint(lat, lon, radiusKm, (i * 360) / segments)
    );
    points.push(points[0]!);
    return points;
  }
  /** Ground area in square meters, using the project's measurement model. */
  function polygonArea(points: LatLon[]): number {
    if (points.length < 3) return 0;
    if (isGeodesic()) return geodesicPolygonArea(points);
    const ring = [...points, points[0]!].map((point) => [point.lon, point.lat]);
    return sphericalArea(new Polygon([ring]), { projection: 'EPSG:4326' });
  }
  function polygonCoordinates(points: LatLon[]): number[][] {
    if (!isGeodesic()) return [...points, points[0]!].map((p) => fromLonLat([p.lon, p.lat]));
    const ring: LatLon[] = [];
    for (let i = 0; i < points.length; i++) {
      const edge = densifyGeodesic(points[i]!, points[(i + 1) % points.length]!);
      const offset =
        ring.length > 0 ? Math.round((ring.at(-1)!.lon - edge[0]!.lon) / 360) * 360 : 0;
      ring.push(...edge.slice(i ? 1 : 0).map((p) => ({ lat: p.lat, lon: p.lon + offset })));
    }
    return ring.map((p) => fromLonLat([p.lon, p.lat]));
  }
  return {
    isGeodesic,
    getDistance,
    destinationPoint,
    calculateBearing,
    calculateInverseBearing: (lat: number, lon: number, endLat: number, endLon: number) =>
      calculateBearing(endLat, endLon, lat, lon),
    endpointFromIntersection,
    sampleLine,
    lineCoordinates,
    interpolateLine,
    getSegmentEndpoint,
    bearingAtPoint,
    isPointOnLine,
    pointAtDistance,
    generateCircle,
    circlePoint,
    polygonCoordinates,
    polygonArea,
  };
}
