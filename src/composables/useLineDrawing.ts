/**
 * Composable for drawing and managing line segments on the map
 */

import type { LineSegmentElement } from '@/services/storage';
import L from 'leaflet';
import { v4 as uuidv4 } from 'uuid';
import { useLayersStore } from '@/stores/layers';

const DEFAULT_COLOR = '#000000';

export function useLineDrawing(mapRef: any) {
  const layersStore = useLayersStore();

  const generateId = () => uuidv4();

  // Helper function to redraw a line segment on the map without adding to store
  const redrawLineSegmentOnMap = (
    lineId: string,
    startLat: number,
    startLon: number,
    endLat: number,
    endLon: number,
    mode: 'coordinate' | 'azimuth' | 'intersection' = 'coordinate',
    intersectLat?: number,
    intersectLon?: number,
    color?: string
  ) => {
    if (!mapRef.map?.value || !mapRef.linesGroup?.value) {
      return;
    }

    const latLngs = [
      [startLat, startLon] as [number, number],
      [endLat, endLon] as [number, number],
    ];

    const polyline = L.polyline(latLngs, {
      color: color || DEFAULT_COLOR,
      weight: 3,
      opacity: 1,
      className: `line-layer line-${lineId}`,
    }).addTo(mapRef.linesGroup.value);

    const newLeafletId = L.stamp(polyline);
    layersStore.storeLeafletId('lineSegment', lineId, newLeafletId);

    // Update the line segment element's leafletId in the store
    const segment = layersStore.lineSegments.find((s) => s.id === lineId);
    if (segment) {
      segment.leafletId = newLeafletId;
    }

    // For intersection mode, show the intersection point marker
    if (mode === 'intersection' && intersectLat && intersectLon) {
      L.circleMarker([intersectLat, intersectLon], {
        radius: 8,
        fillColor: '#FFD700',
        color: '#FFA500',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
        className: `intersection-marker intersection-${lineId}`,
      }).addTo(mapRef.linesGroup.value);
    }
  };

  // Helper function to redraw a parallel line on the map without adding to store
  const redrawParallelOnMap = (lineId: string, latitude: number, color?: string) => {
    if (!mapRef.map?.value || !mapRef.linesGroup?.value) {
      return;
    }

    const latLngs: [number, number][] = [
      [latitude, -180],
      [latitude, 180],
    ];

    const polyline = L.polyline(latLngs, {
      color: color || DEFAULT_COLOR,
      weight: 3,
      opacity: 1,
      className: `line-layer line-${lineId}`,
    }).addTo(mapRef.linesGroup.value);

    const newLeafletId = L.stamp(polyline);
    layersStore.storeLeafletId('lineSegment', lineId, newLeafletId);

    // Update the line segment element's leafletId in the store
    const segment = layersStore.lineSegments.find((s) => s.id === lineId);
    if (segment) {
      segment.leafletId = newLeafletId;
    }
  };

  // Line segment drawing
  const drawLineSegment = (
    startLat: number,
    startLon: number,
    endLat: number,
    endLon: number,
    name?: string,
    mode: 'coordinate' | 'azimuth' | 'intersection' = 'coordinate',
    distance?: number,
    azimuth?: number,
    intersectLat?: number,
    intersectLon?: number,
    intersectDistance?: number
  ): LineSegmentElement | null => {
    if (!mapRef.map?.value || !mapRef.linesGroup?.value) {
      return null;
    }

    const lineId = generateId();
    const lineElement = {
      id: lineId,
      name: name || `Line Segment ${layersStore.lineSegmentCount + 1}`,
      center: { lat: startLat, lon: startLon },
      endpoint: { lat: endLat, lon: endLon },
      mode,
      distance,
      azimuth,
      intersectionPoint:
        intersectLat && intersectLon ? { lat: intersectLat, lon: intersectLon } : undefined,
      intersectionDistance: intersectDistance,
      color: DEFAULT_COLOR,
    } as LineSegmentElement;

    // Draw line as simple 2-point straight line (matches POC and GPX output)
    const latLngs = [
      [startLat, startLon] as [number, number],
      [endLat, endLon] as [number, number],
    ];

    // Create Leaflet polyline and add to lines group
    const polyline = L.polyline(latLngs, {
      color: lineElement.color,
      weight: 3,
      opacity: 1,
      className: `line-layer line-${lineId}`,
    }).addTo(mapRef.linesGroup.value);

    // Store Leaflet ID
    lineElement.leafletId = L.stamp(polyline);
    layersStore.storeLeafletId('lineSegment', lineId, lineElement.leafletId);

    // For intersection mode, show the intersection point marker
    if (mode === 'intersection' && intersectLat && intersectLon) {
      L.circleMarker([intersectLat, intersectLon], {
        radius: 8,
        fillColor: '#FFD700', // Gold
        color: '#FFA500', // Orange
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
        className: `intersection-marker intersection-${lineId}`,
      }).addTo(mapRef.linesGroup.value);
    }

    // Add to store
    layersStore.addLineSegment(lineElement);

    // Fly to line segment bounds with animation
    if (mapRef.flyToBounds) {
      const minLat = Math.min(startLat, endLat);
      const maxLat = Math.max(startLat, endLat);
      const minLon = Math.min(startLon, endLon);
      const maxLon = Math.max(startLon, endLon);
      const bounds: [[number, number], [number, number]] = [
        [minLat, minLon],
        [maxLat, maxLon],
      ];
      mapRef.flyToBounds(bounds);
    }

    return lineElement;
  };

  // Update existing line segment
  const updateLineSegment = (
    lineId: string | undefined,
    startLat: number,
    startLon: number,
    endLat: number,
    endLon: number,
    name: string,
    mode: 'coordinate' | 'azimuth' | 'intersection' = 'coordinate',
    distance?: number,
    azimuth?: number,
    intersectLat?: number,
    intersectLon?: number,
    intersectDistance?: number
  ) => {
    if (!mapRef.map?.value || !lineId) {
      return;
    }

    // Update store
    layersStore.updateLineSegment(lineId, {
      name,
      center: { lat: startLat, lon: startLon },
      endpoint: { lat: endLat, lon: endLon },
      mode,
      distance,
      azimuth,
      intersectionPoint:
        intersectLat && intersectLon ? { lat: intersectLat, lon: intersectLon } : undefined,
      intersectionDistance: intersectDistance,
    });

    // Remove old line from map using className
    const lineClass = `line-${lineId}`;
    const lineElements = document.querySelectorAll(`.${lineClass}`);
    for (const el of lineElements) {
      const svgElement = el.closest('svg');
      if (svgElement) {
        svgElement.remove();
      }
    }

    // Also remove intersection marker if present
    const className = `intersection-${lineId}`;
    const intersectionElements = document.querySelectorAll(`.${className}`);
    for (const el of intersectionElements) {
      const svgElement = el.closest('svg');
      if (svgElement) {
        svgElement.remove();
      }
    }

    // Redraw line segment
    const latLngs = [
      [startLat, startLon] as [number, number],
      [endLat, endLon] as [number, number],
    ];

    const polyline = L.polyline(latLngs, {
      color: DEFAULT_COLOR,
      weight: 3,
      opacity: 1,
      className: `line-layer line-${lineId}`,
    }).addTo(mapRef.linesGroup.value);

    // Update Leaflet ID in store
    const newLeafletId = L.stamp(polyline);
    layersStore.storeLeafletId('lineSegment', lineId, newLeafletId);

    // For intersection mode, show the intersection point marker
    if (mode === 'intersection' && intersectLat && intersectLon) {
      L.circleMarker([intersectLat, intersectLon], {
        radius: 8,
        fillColor: '#FFD700',
        color: '#FFA500',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
        className: `intersection-marker intersection-${lineId}`,
      }).addTo(mapRef.linesGroup.value);
    }
  };

  // Parallel drawing
  const drawParallel = (latitude: number, name?: string): LineSegmentElement | null => {
    if (!mapRef.map?.value || !mapRef.linesGroup?.value) {
      return null;
    }

    const lineId = generateId();
    const lineElement = {
      id: lineId,
      name: name || `Parallel ${layersStore.lineSegmentCount + 1}`,
      center: { lat: latitude, lon: 0 },
      mode: 'parallel' as const,
      longitude: latitude,
      color: DEFAULT_COLOR,
    } as LineSegmentElement;

    // Draw parallel (horizontal line) from west to east at constant latitude
    const latLngs: [number, number][] = [
      [latitude, -180],
      [latitude, 180],
    ];

    const polyline = L.polyline(latLngs, {
      color: lineElement.color,
      weight: 3,
      opacity: 1,
      className: `line-layer line-${lineId}`,
    }).addTo(mapRef.linesGroup.value);

    // Store Leaflet ID
    lineElement.leafletId = L.stamp(polyline);
    layersStore.storeLeafletId('lineSegment', lineId, lineElement.leafletId);

    // Add to store
    layersStore.addLineSegment(lineElement);

    // Fly to parallel bounds with animation
    if (mapRef.flyToBounds) {
      const bounds: [[number, number], [number, number]] = [
        [latitude - 1, -180],
        [latitude + 1, 180],
      ];
      mapRef.flyToBounds(bounds);
    }

    return lineElement;
  };

  // Update existing parallel
  const updateParallel = (lineId: string, latitude: number, name: string) => {
    if (!mapRef.map?.value || !lineId) {
      return;
    }

    // Update store
    layersStore.updateLineSegment(lineId, {
      name,
      center: { lat: latitude, lon: 0 },
      mode: 'parallel',
      longitude: latitude,
    });

    // Remove old parallel from map
    const line = layersStore.lineSegments.find((l) => l.id === lineId);
    if (line && line.leafletId) {
      mapRef.map.value.eachLayer((layer: any) => {
        if (L.stamp(layer) === line.leafletId) {
          mapRef.map.value.removeLayer(layer);
        }
      });
    }

    // Redraw parallel
    const latLngs: [number, number][] = [
      [latitude, -180],
      [latitude, 180],
    ];

    const polyline = L.polyline(latLngs, {
      color: DEFAULT_COLOR,
      weight: 3,
      opacity: 1,
      className: `line-layer line-${lineId}`,
    }).addTo(mapRef.linesGroup.value);

    // Update Leaflet ID in store
    const newLeafletId = L.stamp(polyline);
    layersStore.storeLeafletId('lineSegment', lineId, newLeafletId);
  };

  return {
    drawLineSegment,
    updateLineSegment,
    drawParallel,
    updateParallel,
    redrawLineSegmentOnMap,
    redrawParallelOnMap,
  };
}
