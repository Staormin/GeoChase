import type { MapContainer } from '@/composables/useMap';
import type { CircleElement } from '@/types/project';
/**
 * Composable for drawing and managing circles on the map
 */

import { Feature } from 'ol';
import { LineString } from 'ol/geom';
import { circular as circularPolygon } from 'ol/geom/Polygon';
import { fromLonLat } from 'ol/proj';
import { Stroke, Style } from 'ol/style';
import { v4 as uuidv4 } from 'uuid';
import { useLayersStore } from '@/stores/layers';
import { useProjectGeometry } from './useProjectGeometry';

const DEFAULT_COLOR = '#000000';

export function useCircleDrawing(mapRef: MapContainer) {
  const { isGeodesic, generateCircle } = useProjectGeometry();
  function circleCoordinates(lat: number, lon: number, radiusKm: number) {
    if (isGeodesic()) {
      let previousLon = lon;
      return generateCircle(lat, lon, radiusKm, 128).map((point) => {
        const unwrappedLon = point.lon + Math.round((previousLon - point.lon) / 360) * 360;
        previousLon = unwrappedLon;
        return fromLonLat([unwrappedLon, point.lat]);
      });
    }
    const polygon = circularPolygon([lon, lat], radiusKm * 1000, 64);
    polygon.transform('EPSG:4326', 'EPSG:3857');
    return polygon.getLinearRing(0)!.getCoordinates();
  }
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

    const coordinates = circleCoordinates(centerLat, centerLon, radiusKm);

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

    const coordinates = circleCoordinates(centerLat, centerLon, radiusKm);

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
      mapRef.circlesSource.value?.removeFeature(feature);
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
