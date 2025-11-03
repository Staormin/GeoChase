/**
 * Composable for drawing and managing polygons on the map
 */

import type { PolygonElement } from '@/services/storage';
import L from 'leaflet';
import { v4 as uuidv4 } from 'uuid';
import { useLayersStore } from '@/stores/layers';

export function usePolygonDrawing(mapRef: any) {
  const layersStore = useLayersStore();

  const generateId = () => uuidv4();

  // Polygon drawing
  const drawPolygon = (points: { lat: number; lon: number }[], name?: string, color?: string) => {
    if (!mapRef.map?.value || !mapRef.polygonsGroup?.value) {
      return null;
    }

    if (points.length < 3) {
      console.warn('Polygon must have at least 3 points');
      return null;
    }

    const polygonId = generateId();
    const polygonColor = color || '#90EE90'; // Light green
    const polygonElement: PolygonElement = {
      id: polygonId,
      name: name || `Polygon ${layersStore.polygonCount + 1}`,
      points,
      color: polygonColor,
    };

    // Create Leaflet polygon and add to polygons group
    const latLngs = points.map((p) => [p.lat, p.lon] as [number, number]);
    const polygon = L.polygon(latLngs, {
      color: polygonColor,
      fillColor: polygonColor,
      fillOpacity: 0.2,
      weight: 3,
      opacity: 1,
      className: `polygon-layer polygon-${polygonId}`,
    }).addTo(mapRef.polygonsGroup.value);

    // Store Leaflet ID
    polygonElement.leafletId = L.stamp(polygon);
    layersStore.storeLeafletId('polygon', polygonId, polygonElement.leafletId);

    // Add to store
    layersStore.addPolygon(polygonElement);

    // Fly to polygon bounds with animation
    if (mapRef.flyToBounds) {
      const bounds = polygon.getBounds();
      mapRef.flyToBounds([
        [bounds.getSouth(), bounds.getWest()],
        [bounds.getNorth(), bounds.getEast()],
      ]);
    }

    return polygonElement;
  };

  // Helper function to redraw a polygon on the map without adding to store
  const redrawPolygonOnMap = (
    polygonId: string,
    points: { lat: number; lon: number }[],
    color = '#90EE90'
  ) => {
    if (!mapRef.map?.value || !mapRef.polygonsGroup?.value) {
      return;
    }

    const polygonColor = color;
    const latLngs = points.map((p) => [p.lat, p.lon] as [number, number]);

    const polygon = L.polygon(latLngs, {
      color: polygonColor,
      fillColor: polygonColor,
      fillOpacity: 0.2,
      weight: 3,
      opacity: 1,
      className: `polygon-layer polygon-${polygonId}`,
    }).addTo(mapRef.polygonsGroup.value);

    const newLeafletId = L.stamp(polygon);
    layersStore.storeLeafletId('polygon', polygonId, newLeafletId);

    // Update the polygon element's leafletId in the store
    const polygonElement = layersStore.polygons.find((p) => p.id === polygonId);
    if (polygonElement) {
      polygonElement.leafletId = newLeafletId;
    }
  };

  return {
    drawPolygon,
    redrawPolygonOnMap,
  };
}
