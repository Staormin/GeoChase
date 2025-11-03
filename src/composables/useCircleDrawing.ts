/**
 * Composable for drawing and managing circles on the map
 */

import type { CircleElement } from '@/services/storage';
import L from 'leaflet';
import { v4 as uuidv4 } from 'uuid';
import { generateCircle } from '@/services/geometry';
import { useLayersStore } from '@/stores/layers';

const DEFAULT_COLOR = '#000000';

export function useCircleDrawing(mapRef: any) {
  const layersStore = useLayersStore();

  const generateId = () => uuidv4();

  // Helper function to redraw a circle on the map without adding to store
  const redrawCircleOnMap = (
    circleId: string,
    centerLat: number,
    centerLon: number,
    radiusKm: number,
    color?: string
  ) => {
    if (!mapRef.map?.value || !mapRef.circlesGroup?.value) {
      return;
    }

    const points = generateCircle(centerLat, centerLon, radiusKm, 360);
    const latLngs = points.map((p) => [p.lat, p.lon] as [number, number]);

    const polyline = L.polyline(latLngs, {
      color: color || DEFAULT_COLOR,
      weight: 3,
      opacity: 1,
      className: `circle-layer circle-${circleId}`,
    }).addTo(mapRef.circlesGroup.value);

    const newLeafletId = L.stamp(polyline);
    layersStore.storeLeafletId('circle', circleId, newLeafletId);

    // Update the circle element's leafletId in the store
    const circle = layersStore.circles.find((c) => c.id === circleId);
    if (circle) {
      circle.leafletId = newLeafletId;
    }
  };

  // Circle drawing
  const drawCircle = (centerLat: number, centerLon: number, radiusKm: number, name?: string) => {
    if (!mapRef.map?.value || !mapRef.circlesGroup?.value) {
      return null;
    }

    const circleId = generateId();
    const circleElement: CircleElement = {
      id: circleId,
      name: name || `Circle ${layersStore.circleCount + 1}`,
      center: { lat: centerLat, lon: centerLon },
      radius: radiusKm,
      color: DEFAULT_COLOR,
    };

    // Generate circle points
    const points = generateCircle(centerLat, centerLon, radiusKm, 360);
    const latLngs = points.map((p) => [p.lat, p.lon] as [number, number]);

    // Create Leaflet polyline and add to circles group
    const polyline = L.polyline(latLngs, {
      color: circleElement.color,
      weight: 3,
      opacity: 1,
      className: `circle-layer circle-${circleId}`,
    }).addTo(mapRef.circlesGroup.value);

    // Store Leaflet ID
    circleElement.leafletId = L.stamp(polyline);
    layersStore.storeLeafletId('circle', circleId, circleElement.leafletId);

    // Add to store
    layersStore.addCircle(circleElement);

    // Fly to circle bounds with animation
    if (mapRef.flyToBounds) {
      const bounds: [[number, number], [number, number]] = [
        [centerLat - radiusKm / 111, centerLon - radiusKm / 111],
        [centerLat + radiusKm / 111, centerLon + radiusKm / 111],
      ];
      mapRef.flyToBounds(bounds);
    }

    return circleElement;
  };

  // Update existing circle
  const updateCircle = (
    circleId: string | undefined,
    centerLat: number,
    centerLon: number,
    radiusKm: number,
    name: string
  ) => {
    if (!mapRef.map?.value || !circleId) {
      return;
    }

    // Update store
    layersStore.updateCircle(circleId, {
      name,
      center: { lat: centerLat, lon: centerLon },
      radius: radiusKm,
    });

    // Remove old circle from map
    const circle = layersStore.circles.find((c) => c.id === circleId);
    if (circle && circle.leafletId) {
      const elements = document.querySelectorAll(`.circle-${circleId}`);
      for (const el of elements) {
        const svgElement = el.closest('svg');
        if (svgElement) {
          svgElement.remove();
        }
      }
    }

    // Redraw circle
    const points = generateCircle(centerLat, centerLon, radiusKm, 360);
    const latLngs = points.map((p) => [p.lat, p.lon] as [number, number]);

    const polyline = L.polyline(latLngs, {
      color: DEFAULT_COLOR,
      weight: 3,
      opacity: 1,
      className: `circle-layer circle-${circleId}`,
    }).addTo(mapRef.circlesGroup.value);

    // Update Leaflet ID in store
    const newLeafletId = L.stamp(polyline);
    layersStore.storeLeafletId('circle', circleId, newLeafletId);
  };

  return {
    drawCircle,
    updateCircle,
    redrawCircleOnMap,
  };
}
