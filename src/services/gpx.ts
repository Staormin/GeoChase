/**
 * GPX service - Functions for generating GPX files
 * Reused from original application with TypeScript typing
 */

import type { LatLon } from './geometry';
import type { ProjectProjection, RouteElement } from '@/types/project';
import { downloadFile } from '@/utils/download';
import { createProjectGeometry } from './projectGeometry';

export interface CircleData {
  lat: number;
  lon: number;
  radius?: number;
  name?: string;
}

export interface LineSegmentData {
  name?: string;
  center: { lat: number; lon: number };
  endpoint?: { lat: number; lon: number };
  mode: 'coordinate' | 'azimuth' | 'intersection' | 'parallel';
  distance?: number;
  azimuth?: number;
  longitude?: number;
}

export interface PointData {
  name?: string;
  coordinates: { lat: number; lon: number };
}

/**
 * Generate line segment tracks for GPX
 */
export function generateLineSegmentTracks(
  segments: LineSegmentData[],
  projection: ProjectProjection = 'mercator'
): string {
  const geometry = createProjectGeometry(() => projection);
  return segments
    .map((segment, index) => {
      let points: { lat: number; lon: number }[];
      if (segment.mode === 'parallel') {
        points = Array.from({ length: 181 }, (_, i) => ({
          lat: segment.longitude ?? 0,
          lon: -180 + i * 2,
        }));
      } else {
        const endpoint =
          segment.endpoint ??
          (segment.mode === 'azimuth' &&
          segment.distance !== undefined &&
          segment.azimuth !== undefined
            ? geometry.destinationPoint(
                segment.center.lat,
                segment.center.lon,
                segment.distance,
                segment.azimuth
              )
            : undefined);
        if (!endpoint) return '';
        points = geometry.isGeodesic()
          ? geometry.sampleLine(
              segment.center.lat,
              segment.center.lon,
              endpoint.lat,
              endpoint.lon,
              100
            )
          : [segment.center, endpoint];
      }
      const parallel = segment.mode === 'parallel';
      return `  <trk>
    <name>${escapeXML(segment.name || `${parallel ? 'Parallel' : 'Line Segment'} ${index + 1}`)}</name>
    <type>${parallel ? 'Parallel' : 'LineSegment'}</type>
    <trkseg>
${points.map((point) => trackPointXML(point)).join('')}    </trkseg>
  </trk>
`;
    })
    .join('');
}

function trackPointXML(point: LatLon): string {
  const lat = point.lat.toFixed(12);
  const lon = normalizeLongitude(point.lon).toFixed(12);
  return `      <trkpt lat="${lat}" lon="${lon}">
        <ele>0</ele>
      </trkpt>
`;
}

function normalizeLongitude(lon: number): number {
  return lon >= -180 && lon <= 180 ? lon : ((((lon + 180) % 360) + 360) % 360) - 180;
}

function escapeXML(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/**
 * Generate complete GPX with circles, line segments, and points
 */
export function generateCompleteGPX(
  centers: CircleData[],
  radiiKm: number[],
  numPoints: number,
  segments: LineSegmentData[],
  layerPoints: PointData[] = [],
  projection: ProjectProjection = 'mercator',
  routes: RouteElement[] = []
): string {
  const { generateCircle } = createProjectGeometry(() => projection);
  const timestamp = new Date().toISOString();
  const radiiDesc =
    radiiKm.length === 1 ? `radius ${radiiKm[0]} km` : `radii ${radiiKm.join(', ')} km`;
  const first = centers[0];
  const centersDesc =
    centers.length === 1
      ? `center at ${first?.lat ?? 0}, ${first?.lon ?? 0}`
      : `${centers.length} centers`;

  let descSuffix = '';
  if (segments.length > 0) {
    descSuffix += ` plus ${segments.length} line segment(s)`;
  }
  if (layerPoints.length > 0) {
    descSuffix += ` plus ${layerPoints.length} point(s)`;
  }

  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GPX Circle Generator"
     xmlns="https://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="https://www.topografix.com/GPX/1/1 https://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>Circle Tracks and Line Segments</name>
    <desc>Circular tracks with ${centersDesc} and ${radiiDesc}${descSuffix}</desc>
    <time>${timestamp}</time>
  </metadata>
`;

  // Add waypoints for all centers
  for (const [centerIndex, center] of centers.entries()) {
    gpx += `  <wpt lat="${center.lat.toFixed(12)}" lon="${center.lon.toFixed(12)}">
    <ele>0</ele>
    <name>Center ${centerIndex + 1}</name>
    <desc>Circle center point ${centerIndex + 1}</desc>
    <sym>Flag, Blue</sym>
  </wpt>
`;
  }

  // Add waypoints for all layer points
  for (const point of layerPoints) {
    gpx += `  <wpt lat="${point.coordinates.lat.toFixed(12)}" lon="${point.coordinates.lon.toFixed(12)}">
    <ele>0</ele>
    <name>${escapeXML(point.name || '')}</name>
    <desc>User added point</desc>
    <sym>Flag, Red</sym>
  </wpt>
`;
  }

  // Generate tracks for each center and radius combination
  for (const [centerIndex, center] of centers.entries()) {
    for (const radiusKm of radiiKm) {
      const points = generateCircle(center.lat, center.lon, radiusKm, numPoints);

      gpx += `  <trk>
    <name>Center ${centerIndex + 1} - Circle ${radiusKm}km</name>
    <type>Circle</type>
    <trkseg>
`;

      for (const point of points) {
        gpx += trackPointXML(point);
      }

      gpx += `    </trkseg>
  </trk>
`;
    }
  }

  // Add line segment tracks
  if (segments.length > 0) {
    gpx += generateLineSegmentTracks(segments, projection);
  }

  for (const route of routes) {
    gpx += `<trk><name>${escapeXML(route.name)}</name><type>Route</type><trkseg>${route.coordinates.map(([lon, lat]) => trackPointXML({ lat, lon })).join('')}</trkseg></trk>`;
  }
  gpx += `</gpx>`;

  return gpx;
}

/**
 * Generate timestamp for filename
 */
export function getTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${date}_${hours}-${minutes}-${seconds}`;
}

/**
 * Download GPX file to client
 */
export function downloadGPX(content: string, filename: string): void {
  downloadFile(content, filename, 'application/gpx+xml');
}
