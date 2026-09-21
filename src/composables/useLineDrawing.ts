/**
 * Composable for drawing and managing line segments on the map
 */

import type { MapContainer } from '@/composables/useMap';
import type { LineSegmentElement } from '@/types/project';
import { Feature } from 'ol';
import { LineString, Point } from 'ol/geom';
import { fromLonLat, transform } from 'ol/proj';
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';
import { v4 as uuidv4 } from 'uuid';
import { useLayersStore } from '@/stores/layers';
import { usePointDrawing } from './usePointDrawing';
import { useProjectGeometry } from './useProjectGeometry';

const DEFAULT_COLOR = '#000000';

export function useLineDrawing(mapRef: MapContainer) {
  const { lineCoordinates, interpolateLine, getDistance } = useProjectGeometry();
  const layersStore = useLayersStore();
  const pointDrawing = usePointDrawing(mapRef);

  const generateId = () => uuidv4();

  // Helper function to animate a line segment drawing from start to end
  const animateLineSegmentOnMap = (
    lineId: string,
    startLat: number,
    startLon: number,
    endLat: number,
    endLon: number,
    mode: 'coordinate' | 'azimuth' | 'intersection' = 'coordinate',
    intersectLat?: number,
    intersectLon?: number,
    color?: string,
    duration = 800 // Animation duration in ms
  ): Promise<void> => {
    return new Promise((resolve) => {
      if (!mapRef.map?.value || !mapRef.linesSource?.value) {
        resolve();
        return;
      }

      const startTime = performance.now();
      const path = lineCoordinates({ lat: startLat, lon: startLon }, { lat: endLat, lon: endLon });

      // Create the feature ONCE and update its geometry during animation
      const initialCoordinates = [
        fromLonLat([startLon, startLat]),
        fromLonLat([startLon, startLat]),
      ];
      const geometry = new LineString(initialCoordinates);
      const animatingFeature = new Feature({
        geometry,
        id: lineId,
        type: 'lineSegment',
      });

      animatingFeature.setId(lineId);
      animatingFeature.setStyle(
        new Style({
          stroke: new Stroke({
            color: color || DEFAULT_COLOR,
            width: 3,
          }),
        })
      );

      // Add the feature once at the start
      mapRef.linesSource.value.addFeature(animatingFeature);

      const animate = (currentTime: number) => {
        if (!mapRef.linesSource?.value) {
          resolve();
          return;
        }

        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const currentEnd = interpolateLine(
          { lat: startLat, lon: startLon },
          { lat: endLat, lon: endLon },
          progress
        );
        const count = Math.floor(progress * (path.length - 1)) + 1;
        geometry.setCoordinates(
          progress === 1
            ? path
            : [...path.slice(0, count), fromLonLat([currentEnd.lon, currentEnd.lat])]
        );

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // CRITICAL: Notify OpenLayers that the source has changed to trigger re-render
          if (mapRef.linesSource?.value) {
            mapRef.linesSource.value.changed();
          }

          // For intersection mode, show the intersection point marker
          if (
            mode === 'intersection' &&
            intersectLat !== undefined &&
            intersectLon !== undefined &&
            mapRef.linesSource?.value
          ) {
            const markerGeometry = new Point(fromLonLat([intersectLon, intersectLat]));
            const markerFeature = new Feature({
              geometry: markerGeometry,
              id: `intersection-${lineId}`,
              type: 'intersectionMarker',
            });

            markerFeature.setId(`intersection-${lineId}`);
            markerFeature.setStyle(
              new Style({
                image: new CircleStyle({
                  radius: 8,
                  fill: new Fill({ color: '#FFD700' }),
                  stroke: new Stroke({
                    color: '#FFA500',
                    width: 2,
                  }),
                }),
              })
            );

            mapRef.linesSource.value.addFeature(markerFeature);
          }

          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  };

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
    if (!mapRef.map?.value || !mapRef.linesSource?.value) {
      return;
    }

    const coordinates = lineCoordinates(
      { lat: startLat, lon: startLon },
      { lat: endLat, lon: endLon }
    );

    const geometry = new LineString(coordinates);
    const feature = new Feature({
      geometry,
      id: lineId,
      type: 'lineSegment',
    });

    feature.setId(lineId);
    feature.setStyle(
      new Style({
        stroke: new Stroke({
          color: color || DEFAULT_COLOR,
          width: 3,
        }),
      })
    );

    mapRef.linesSource.value.addFeature(feature);

    // For intersection mode, show the intersection point marker
    if (mode === 'intersection' && intersectLat !== undefined && intersectLon !== undefined) {
      const markerGeometry = new Point(fromLonLat([intersectLon, intersectLat]));
      const markerFeature = new Feature({
        geometry: markerGeometry,
        id: `intersection-${lineId}`,
        type: 'intersectionMarker',
      });

      markerFeature.setId(`intersection-${lineId}`);
      markerFeature.setStyle(
        new Style({
          image: new CircleStyle({
            radius: 8,
            fill: new Fill({ color: '#FFD700' }),
            stroke: new Stroke({
              color: '#FFA500',
              width: 2,
            }),
          }),
        })
      );

      mapRef.linesSource.value.addFeature(markerFeature);
    }
  };

  // Helper function to redraw a parallel line on the map without adding to store
  const redrawParallelOnMap = (lineId: string, latitude: number, color?: string) => {
    if (!mapRef.map?.value || !mapRef.linesSource?.value) {
      return;
    }

    const coordinates = [fromLonLat([-180, latitude]), fromLonLat([180, latitude])];

    const geometry = new LineString(coordinates);
    const feature = new Feature({
      geometry,
      id: lineId,
      type: 'parallel',
    });

    feature.setId(lineId);
    feature.setStyle(
      new Style({
        stroke: new Stroke({
          color: color || DEFAULT_COLOR,
          width: 3,
        }),
      })
    );

    mapRef.linesSource.value.addFeature(feature);
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
    intersectDistance?: number,
    createEndpoint?: boolean,
    endpointName?: string
  ): LineSegmentElement | null => {
    if (!mapRef.map?.value || !mapRef.linesSource?.value) {
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
        intersectLat !== undefined && intersectLon !== undefined
          ? { lat: intersectLat, lon: intersectLon }
          : undefined,
      intersectionDistance: intersectDistance,
      intersectionExtension:
        intersectLat !== undefined && intersectLon !== undefined
          ? getDistance([intersectLon, intersectLat], [endLon, endLat]) / 1000
          : undefined,
      color: DEFAULT_COLOR,
    } as LineSegmentElement;

    const coordinates = lineCoordinates(
      { lat: startLat, lon: startLon },
      { lat: endLat, lon: endLon }
    );

    // Create OpenLayers feature
    const geometry = new LineString(coordinates);
    const feature = new Feature({
      geometry,
      id: lineId,
      type: 'lineSegment',
    });

    feature.setId(lineId);
    feature.setStyle(
      new Style({
        stroke: new Stroke({
          color: lineElement.color,
          width: 3,
        }),
      })
    );

    // Add to store
    layersStore.addLineSegment(lineElement);

    // Add feature to map AFTER adding to store
    mapRef.linesSource.value.addFeature(feature);

    // Create endpoint if requested (for azimuth, intersection modes)
    // Not for coordinate mode (already uses existing points) or parallel mode (has no endpoint)
    if (createEndpoint && (mode === 'azimuth' || mode === 'intersection')) {
      // Generate a name if not provided
      let pointName = endpointName?.trim();
      if (!pointName) {
        // Auto-generate name based on context
        // Note: mode is guaranteed to be 'azimuth' or 'intersection' by the outer condition
        pointName =
          mode === 'azimuth'
            ? `Point at ${azimuth}° from ${name || 'line'}`
            : `Endpoint of ${name || 'line'}`;
      }

      // Draw the point on the map (this also adds it to the store and creates the label)
      const endpoint = pointDrawing.drawPoint(endLat, endLon, pointName);
      if (endpoint) layersStore.updatePoint(endpoint.id, { construction: { lineId } });
    }

    // For intersection mode, show the intersection point marker
    if (mode === 'intersection' && intersectLat !== undefined && intersectLon !== undefined) {
      const markerGeometry = new Point(fromLonLat([intersectLon, intersectLat]));
      const markerFeature = new Feature({
        geometry: markerGeometry,
        id: `intersection-${lineId}`,
        type: 'intersectionMarker',
      });

      markerFeature.setId(`intersection-${lineId}`);
      markerFeature.setStyle(
        new Style({
          image: new CircleStyle({
            radius: 8,
            fill: new Fill({ color: '#FFD700' }), // Gold
            stroke: new Stroke({
              color: '#FFA500', // Orange
              width: 2,
            }),
          }),
        })
      );

      mapRef.linesSource.value.addFeature(markerFeature);
    }

    // Fly to line segment bounds with animation AFTER drawing
    // Use requestAnimationFrame to ensure the feature is rendered before flying
    if (mapRef.flyToBoundsWithPanels) {
      requestAnimationFrame(() => {
        const extent = geometry.getExtent();
        const [minLon, minLat] = transform(extent.slice(0, 2), 'EPSG:3857', 'EPSG:4326');
        const [maxLon, maxLat] = transform(extent.slice(2, 4), 'EPSG:3857', 'EPSG:4326');
        const bounds: [[number, number], [number, number]] = [
          [minLat!, minLon!],
          [maxLat!, maxLon!],
        ];
        mapRef.flyToBoundsWithPanels(bounds);
      });
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
    if (!mapRef.map.value || !mapRef.linesSource.value || !lineId) {
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
        intersectLat !== undefined && intersectLon !== undefined
          ? { lat: intersectLat, lon: intersectLon }
          : undefined,
      intersectionDistance: intersectDistance,
      intersectionExtension:
        intersectLat !== undefined && intersectLon !== undefined
          ? getDistance([intersectLon, intersectLat], [endLon, endLat]) / 1000
          : undefined,
    });

    // Remove old line from map
    const feature = mapRef.linesSource.value?.getFeatureById(lineId);
    if (feature) {
      mapRef.linesSource.value.removeFeature(feature);
    }

    // Also remove intersection marker if present
    const intersectionMarker = mapRef.linesSource.value?.getFeatureById(`intersection-${lineId}`);
    if (intersectionMarker) {
      mapRef.linesSource.value.removeFeature(intersectionMarker);
    }

    // Redraw line segment
    const coordinates = lineCoordinates(
      { lat: startLat, lon: startLon },
      { lat: endLat, lon: endLon }
    );

    const geometry = new LineString(coordinates);
    const newFeature = new Feature({
      geometry,
      id: lineId,
      type: 'lineSegment',
    });

    newFeature.setId(lineId);
    newFeature.setStyle(
      new Style({
        stroke: new Stroke({
          color:
            layersStore.lineSegments.find((line) => line.id === lineId)?.color || DEFAULT_COLOR,
          width: 3,
        }),
      })
    );

    mapRef.linesSource.value.addFeature(newFeature);

    // For intersection mode, show the intersection point marker
    if (mode === 'intersection' && intersectLat !== undefined && intersectLon !== undefined) {
      const markerGeometry = new Point(fromLonLat([intersectLon, intersectLat]));
      const markerFeature = new Feature({
        geometry: markerGeometry,
        id: `intersection-${lineId}`,
        type: 'intersectionMarker',
      });

      markerFeature.setId(`intersection-${lineId}`);
      markerFeature.setStyle(
        new Style({
          image: new CircleStyle({
            radius: 8,
            fill: new Fill({ color: '#FFD700' }),
            stroke: new Stroke({
              color: '#FFA500',
              width: 2,
            }),
          }),
        })
      );

      mapRef.linesSource.value.addFeature(markerFeature);
    }
  };

  // Parallel drawing
  const drawParallel = (latitude: number, name?: string): LineSegmentElement | null => {
    if (!mapRef.map?.value || !mapRef.linesSource?.value) {
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
    const coordinates = [fromLonLat([-180, latitude]), fromLonLat([180, latitude])];

    const geometry = new LineString(coordinates);
    const feature = new Feature({
      geometry,
      id: lineId,
      type: 'parallel',
    });

    feature.setId(lineId);
    feature.setStyle(
      new Style({
        stroke: new Stroke({
          color: lineElement.color,
          width: 3,
        }),
      })
    );

    // Add to store
    layersStore.addLineSegment(lineElement);

    // Add feature to map AFTER adding to store
    mapRef.linesSource.value.addFeature(feature);

    // Fly to parallel bounds with animation AFTER drawing
    // Use requestAnimationFrame to ensure the feature is rendered before flying
    if (mapRef.flyToBoundsWithPanels) {
      requestAnimationFrame(() => {
        const bounds: [[number, number], [number, number]] = [
          [latitude - 1, -180],
          [latitude + 1, 180],
        ];
        mapRef.flyToBoundsWithPanels(bounds);
      });
    }

    return lineElement;
  };

  // Update existing parallel
  const updateParallel = (lineId: string, latitude: number, name: string) => {
    if (!mapRef.map.value || !mapRef.linesSource.value || !lineId) {
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
    const feature = mapRef.linesSource.value?.getFeatureById(lineId);
    if (feature) {
      mapRef.linesSource.value.removeFeature(feature);
    }

    // Redraw parallel
    const coordinates = [fromLonLat([-180, latitude]), fromLonLat([180, latitude])];

    const geometry = new LineString(coordinates);
    const newFeature = new Feature({
      geometry,
      id: lineId,
      type: 'parallel',
    });

    newFeature.setId(lineId);
    newFeature.setStyle(
      new Style({
        stroke: new Stroke({
          color:
            layersStore.lineSegments.find((line) => line.id === lineId)?.color || DEFAULT_COLOR,
          width: 3,
        }),
      })
    );

    mapRef.linesSource.value.addFeature(newFeature);
  };

  return {
    drawLineSegment,
    updateLineSegment,
    drawParallel,
    updateParallel,
    redrawLineSegmentOnMap,
    redrawParallelOnMap,
    animateLineSegmentOnMap,
  };
}
