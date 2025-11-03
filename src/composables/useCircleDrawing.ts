/**
 * Composable for drawing and managing circles on the map
 */

import type { CircleElement } from '@/services/storage';
import { Feature } from 'ol';
import { LineString } from 'ol/geom';
import { circular as circularPolygon } from 'ol/geom/Polygon';
import { Stroke, Style } from 'ol/style';
import { v4 as uuidv4 } from 'uuid';
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
    if (!mapRef.map?.value || !mapRef.circlesSource?.value) {
      return;
    }

    // Use OpenLayers native geodesic circle generation
    // Note: circular() expects center in lon/lat (EPSG:4326), not Web Mercator
    const radiusMeters = radiusKm * 1000; // Convert km to meters
    const circlePolygon = circularPolygon([centerLon, centerLat], radiusMeters, 64);

    // Transform from EPSG:4326 to EPSG:3857 (Web Mercator) for the map
    circlePolygon.transform('EPSG:4326', 'EPSG:3857');

    // Get the coordinates from the polygon's linear ring
    const coordinates = circlePolygon.getLinearRing(0)!.getCoordinates();

    const geometry = new LineString(coordinates);
    const feature = new Feature({
      geometry,
      id: circleId,
      type: 'circle',
    });

    feature.setId(circleId);
    feature.setStyle(
      new Style({
        stroke: new Stroke({
          color: color || DEFAULT_COLOR,
          width: 3,
        }),
      })
    );

    mapRef.circlesSource.value.addFeature(feature);

    // Update the circle element's feature reference in the store
    const circle = layersStore.circles.find((c) => c.id === circleId);
    if (circle) {
      circle.mapElementId = circleId; // Using same ID for OpenLayers feature
    }
  };

  // Circle drawing
  const drawCircle = (centerLat: number, centerLon: number, radiusKm: number, name?: string) => {
    if (!mapRef.map?.value || !mapRef.circlesSource?.value) {
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

    // Use OpenLayers native geodesic circle generation
    // Note: circular() expects center in lon/lat (EPSG:4326), not Web Mercator
    const radiusMeters = radiusKm * 1000; // Convert km to meters
    const circlePolygon = circularPolygon([centerLon, centerLat], radiusMeters, 64);

    // Transform from EPSG:4326 to EPSG:3857 (Web Mercator) for the map
    circlePolygon.transform('EPSG:4326', 'EPSG:3857');

    // Get the coordinates from the polygon's linear ring
    const coordinates = circlePolygon.getLinearRing(0)!.getCoordinates();

    // Create OpenLayers feature
    const geometry = new LineString(coordinates);
    const feature = new Feature({
      geometry,
      id: circleId,
      type: 'circle',
    });

    feature.setId(circleId);
    feature.setStyle(
      new Style({
        stroke: new Stroke({
          color: circleElement.color,
          width: 3,
        }),
      })
    );

    // Store feature ID
    circleElement.mapElementId = circleId;
    layersStore.storeMapElementId('circle', circleId, circleId);

    // Add to store
    layersStore.addCircle(circleElement);

    // Add feature to map AFTER adding to store
    mapRef.circlesSource.value.addFeature(feature);

    // Fly to circle bounds with animation AFTER drawing
    // Use requestAnimationFrame to ensure the feature is rendered before flying
    if (mapRef.flyToBoundsWithPanels) {
      requestAnimationFrame(() => {
        const bounds: [[number, number], [number, number]] = [
          [centerLat - radiusKm / 111, centerLon - radiusKm / 111],
          [centerLat + radiusKm / 111, centerLon + radiusKm / 111],
        ];
        mapRef.flyToBoundsWithPanels(bounds);
      });
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
    const feature = mapRef.circlesSource.value?.getFeatureById(circleId);
    if (feature) {
      mapRef.circlesSource.value.removeFeature(feature);
    }

    // Redraw circle
    redrawCircleOnMap(circleId, centerLat, centerLon, radiusKm, DEFAULT_COLOR);
  };

  return {
    drawCircle,
    updateCircle,
    redrawCircleOnMap,
  };
}
