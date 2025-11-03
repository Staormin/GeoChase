/**
 * Composable for drawing and managing points on the map
 */

import type { PointElement } from '@/services/storage';
import L from 'leaflet';
import { v4 as uuidv4 } from 'uuid';
import { useLayersStore } from '@/stores/layers';

const DEFAULT_COLOR = '#000000';

export function usePointDrawing(mapRef: any) {
  const layersStore = useLayersStore();

  const generateId = () => uuidv4();

  // Helper function to redraw a point on the map without adding to store
  const redrawPointOnMap = (pointId: string, lat: number, lon: number, _color?: string) => {
    if (!mapRef.map?.value || !mapRef.pointsGroup?.value) {
      return;
    }

    // Get point name from store
    const point = layersStore.points.find((p) => p.id === pointId);
    const pointName = point?.name || 'Point';

    // Create Leaflet marker (native pin) with permanent tooltip and add to points group
    const marker = L.marker([lat, lon])
      .bindTooltip(pointName, {
        permanent: true,
        direction: 'top',
        offset: [0, -20],
        className: 'point-label',
      })
      .addTo(mapRef.pointsGroup.value);

    const newLeafletId = L.stamp(marker);
    layersStore.storeLeafletId('point', pointId, newLeafletId);

    // Update the point element's leafletId in the store
    if (point) {
      point.leafletId = newLeafletId;
    }
  };

  // Point drawing
  const drawPoint = (
    lat: number,
    lon: number,
    name?: string,
    color?: string,
    elevation?: number
  ): PointElement | null => {
    if (!mapRef.map?.value || !mapRef.pointsGroup?.value) {
      return null;
    }

    const pointId = generateId();
    const pointElement = {
      id: pointId,
      name: name || `Point ${layersStore.pointCount + 1}`,
      coordinates: { lat, lon },
      elevation,
      color: color || DEFAULT_COLOR,
    } as PointElement;

    // Create Leaflet marker (native pin) with permanent tooltip and add to points group
    const marker = L.marker([lat, lon])
      .bindTooltip(pointElement.name, {
        permanent: true,
        direction: 'top',
        offset: [0, -20],
        className: 'point-label',
      })
      .addTo(mapRef.pointsGroup.value);

    // Store Leaflet ID
    pointElement.leafletId = L.stamp(marker);
    layersStore.storeLeafletId('point', pointId, pointElement.leafletId);

    // Add to store
    layersStore.addPoint(pointElement);

    // Fly to point with some padding and animation
    if (mapRef.flyToBounds) {
      const padding = 0.01; // ~1km padding
      const bounds: [[number, number], [number, number]] = [
        [lat - padding, lon - padding],
        [lat + padding, lon + padding],
      ];
      mapRef.flyToBounds(bounds);
    }

    return pointElement;
  };

  return {
    drawPoint,
    redrawPointOnMap,
  };
}
