/**
 * Composable for drawing and managing polygons on the map
 */

import type { PolygonElement } from '@/services/storage';
import { Feature } from 'ol';
import { Polygon } from 'ol/geom';
import { fromLonLat } from 'ol/proj';
import { Fill, Stroke, Style } from 'ol/style';
import { v4 as uuidv4 } from 'uuid';
import { useLayersStore } from '@/stores/layers';

export function usePolygonDrawing(mapRef: any) {
  const layersStore = useLayersStore();

  const generateId = () => uuidv4();

  // Helper function to convert color to rgba with opacity
  const getPolygonFillColor = (color: string, opacity = 0.2): string => {
    if (color.startsWith('#')) {
      // Convert hex to rgba
      const hex = color.slice(1);
      const r = Number.parseInt(hex.slice(0, 2), 16);
      const g = Number.parseInt(hex.slice(2, 4), 16);
      const b = Number.parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    if (color.startsWith('rgb(')) {
      // Convert rgb to rgba
      return color.replace(')', `, ${opacity})`).replace('rgb', 'rgba');
    }
    if (color.startsWith('rgba(')) {
      // Already rgba, just set opacity
      return color.replace(/[\d.]+\)$/, `${opacity})`);
    }
    // Fallback: return color as-is
    return color;
  };

  // Polygon drawing
  const drawPolygon = (pointIds: string[], name?: string, color?: string) => {
    if (!mapRef.map?.value || !mapRef.polygonsSource?.value) {
      return null;
    }

    if (pointIds.length < 3) {
      return null;
    }

    // Resolve point IDs to coordinates
    const points = pointIds
      .map((pointId) => {
        const point = layersStore.points.find((p) => p.id === pointId);
        return point ? point.coordinates : null;
      })
      .filter((p): p is { lat: number; lon: number } => p !== null);

    // Verify all points were found
    if (points.length !== pointIds.length) {
      console.error('Some points not found for polygon');
      return null;
    }

    const polygonId = generateId();
    const polygonColor = color || '#90EE90'; // Light green
    const polygonElement: PolygonElement = {
      id: polygonId,
      name: name || `Polygon ${layersStore.polygonCount + 1}`,
      pointIds, // Store IDs instead of coordinates
      color: polygonColor,
    };

    // Create OpenLayers polygon coordinates
    const coordinates = points.map((p) => fromLonLat([p.lon, p.lat]));
    // Close the polygon by adding the first point at the end
    coordinates.push(coordinates[0]!);

    const geometry = new Polygon([coordinates]);
    const feature = new Feature({
      geometry,
      id: polygonId,
      type: 'polygon',
    });

    feature.setId(polygonId);
    feature.setStyle(
      new Style({
        stroke: new Stroke({
          color: polygonColor,
          width: 3,
        }),
        fill: new Fill({
          color: getPolygonFillColor(polygonColor, 0.2),
        }),
      })
    );

    // Store feature ID
    polygonElement.mapElementId = polygonId;
    layersStore.storeMapElementId('polygon', polygonId, polygonId);

    // Add to store
    layersStore.addPolygon(polygonElement);

    // Add feature to map AFTER adding to store
    mapRef.polygonsSource.value.addFeature(feature);

    // Fly to polygon bounds with animation AFTER drawing
    // Use requestAnimationFrame to ensure the feature is rendered before flying
    if (mapRef.flyToBoundsWithPanels) {
      requestAnimationFrame(() => {
        const lats = points.map((p) => p.lat);
        const lons = points.map((p) => p.lon);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);

        const bounds: [[number, number], [number, number]] = [
          [minLat, minLon],
          [maxLat, maxLon],
        ];
        mapRef.flyToBoundsWithPanels(bounds);
      });
    }

    return polygonElement;
  };

  // Helper function to redraw a polygon on the map without adding to store
  const redrawPolygonOnMap = (polygonId: string, pointIds: string[], color = '#90EE90') => {
    if (!mapRef.map?.value || !mapRef.polygonsSource?.value) {
      return;
    }

    // Resolve point IDs to coordinates
    const points = pointIds
      .map((pointId) => {
        const point = layersStore.points.find((p) => p.id === pointId);
        return point ? point.coordinates : null;
      })
      .filter((p): p is { lat: number; lon: number } => p !== null);

    if (points.length < 3) {
      console.error('Insufficient valid points for polygon');
      return;
    }

    const polygonColor = color;
    const coordinates = points.map((p) => fromLonLat([p.lon, p.lat]));
    // Close the polygon by adding the first point at the end
    coordinates.push(coordinates[0]!);

    const geometry = new Polygon([coordinates]);
    const feature = new Feature({
      geometry,
      id: polygonId,
      type: 'polygon',
    });

    feature.setId(polygonId);
    feature.setStyle(
      new Style({
        stroke: new Stroke({
          color: polygonColor,
          width: 3,
        }),
        fill: new Fill({
          color: getPolygonFillColor(polygonColor, 0.2),
        }),
      })
    );

    mapRef.polygonsSource.value.addFeature(feature);

    // Update the polygon element's feature reference in the store
    const polygonElement = layersStore.polygons.find((p) => p.id === polygonId);
    if (polygonElement) {
      polygonElement.mapElementId = polygonId;
    }
  };

  return {
    drawPolygon,
    redrawPolygonOnMap,
  };
}
