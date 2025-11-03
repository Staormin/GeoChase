/**
 * Composable for drawing and managing points on the map
 */

import type { PointElement } from '@/services/storage';
import { Feature } from 'ol';
import { Point } from 'ol/geom';
import Overlay from 'ol/Overlay';
import { fromLonLat } from 'ol/proj';
import { Icon, Style } from 'ol/style';
import { v4 as uuidv4 } from 'uuid';
import { useLayersStore } from '@/stores/layers';

const DEFAULT_COLOR = '#000000';

// Default marker icon (blue pin)
const DEFAULT_MARKER_ICON = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCAyNSA0MSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIuNSAwQzUuNTk2IDAgMCA1LjU5NiAwIDEyLjVjMCAzLjUzIDEuNDQyIDYuNzE1IDMuNzcgOS4wMTVMMTIuNSA0MWw4LjczLTE5LjQ4NUMyMy4wNTggMTkuMjE1IDI1IDE1LjAzIDI1IDEyLjUgMjUgNS41OTYgMTkuNDA0IDAgMTIuNSAwem0wIDE5YTYuNSA2LjUgMCAxIDEgMC0xMyA2LjUgNi41IDAgMCAxIDAgMTN6IiBmaWxsPSIjMzM4OGZmIi8+PC9zdmc+`;

export function usePointDrawing(mapRef: any) {
  const layersStore = useLayersStore();

  const generateId = () => uuidv4();

  // Helper function to create label overlay
  const createLabelOverlay = (pointId: string, name: string, coordinate: any) => {
    const labelElement = document.createElement('div');
    labelElement.className = 'point-label';
    labelElement.textContent = name;

    // Get current zoom to set initial visibility
    const currentZoom = mapRef.map?.value?.getView().getZoom() || 0;
    const initialOpacity = currentZoom >= 12 ? '1' : '0';

    labelElement.style.cssText = `
      position: absolute;
      background: white;
      color: #1e293b;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      pointer-events: none;
      transform: translate(-50%, -100%);
      margin-top: -25px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      opacity: ${initialOpacity};
      transition: opacity 0.2s ease;
    `;

    const overlay = new Overlay({
      element: labelElement,
      positioning: 'bottom-center',
      offset: [0, -20],
      stopEvent: false,
    });

    overlay.setPosition(coordinate);
    overlay.set('id', `label-${pointId}`); // Set ID as a property for later retrieval

    return overlay;
  };

  // Helper function to redraw a point on the map without adding to store
  const redrawPointOnMap = (pointId: string, lat: number, lon: number, _color?: string) => {
    if (!mapRef.map?.value || !mapRef.pointsSource?.value) {
      return;
    }

    // Get point name from store
    const point = layersStore.points.find((p) => p.id === pointId);
    const pointName = point?.name || 'Point';

    const coordinate = fromLonLat([lon, lat]);

    // Create OpenLayers feature with marker icon
    const geometry = new Point(coordinate);
    const feature = new Feature({
      geometry,
      id: pointId,
      type: 'point',
      name: pointName,
    });

    feature.setId(pointId);
    feature.setStyle(
      new Style({
        image: new Icon({
          src: DEFAULT_MARKER_ICON,
          anchor: [0.5, 1],
          scale: 1,
        }),
      })
    );

    mapRef.pointsSource.value.addFeature(feature);

    // Create and add label overlay
    const labelOverlay = createLabelOverlay(pointId, pointName, coordinate);
    mapRef.map.value.addOverlay(labelOverlay);

    // Update the point element's feature reference in the store
    if (point) {
      point.mapElementId = pointId;
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
    if (!mapRef.map?.value || !mapRef.pointsSource?.value) {
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

    const coordinate = fromLonLat([lon, lat]);

    // Create OpenLayers feature with marker icon
    const geometry = new Point(coordinate);
    const feature = new Feature({
      geometry,
      id: pointId,
      type: 'point',
      name: pointElement.name,
    });

    feature.setId(pointId);
    feature.setStyle(
      new Style({
        image: new Icon({
          src: DEFAULT_MARKER_ICON,
          anchor: [0.5, 1],
          scale: 1,
        }),
      })
    );

    // Store feature ID
    pointElement.mapElementId = pointId;
    layersStore.storeMapElementId('point', pointId, pointId);

    // Add to store
    layersStore.addPoint(pointElement);

    // Add feature to map AFTER adding to store
    mapRef.pointsSource.value.addFeature(feature);

    // Create and add label overlay
    const labelOverlay = createLabelOverlay(pointId, pointElement.name, coordinate);
    mapRef.map.value.addOverlay(labelOverlay);

    // Fly to point with some padding and animation AFTER drawing
    // Use requestAnimationFrame to ensure the feature is rendered before flying
    if (mapRef.flyToBoundsWithPanels) {
      requestAnimationFrame(() => {
        const padding = 0.01; // ~1km padding
        const bounds: [[number, number], [number, number]] = [
          [lat - padding, lon - padding],
          [lat + padding, lon + padding],
        ];
        mapRef.flyToBoundsWithPanels(bounds);
      });
    }

    return pointElement;
  };

  return {
    drawPoint,
    redrawPointOnMap,
  };
}
