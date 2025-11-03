/**
 * Composable for drawing and managing line segments on the map
 */

import type { LineSegmentElement } from '@/services/storage';
import { Feature } from 'ol';
import { LineString, Point } from 'ol/geom';
import { fromLonLat } from 'ol/proj';
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';
import { v4 as uuidv4 } from 'uuid';
import { useLayersStore } from '@/stores/layers';

const DEFAULT_COLOR = '#000000';

export function useLineDrawing(mapRef: any) {
  const layersStore = useLayersStore();

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

      // Create the feature ONCE and update its geometry during animation
      const initialCoordinates = [fromLonLat([startLon, startLat]), fromLonLat([startLon, startLat])];
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

        // Interpolate current end point
        const currentEndLat = startLat + (endLat - startLat) * progress;
        const currentEndLon = startLon + (endLon - startLon) * progress;

        // Update the geometry of the existing feature instead of removing/adding
        const newCoordinates = [
          fromLonLat([startLon, startLat]),
          fromLonLat([currentEndLon, currentEndLat]),
        ];

        geometry.setCoordinates(newCoordinates);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // CRITICAL: Notify OpenLayers that the source has changed to trigger re-render
          if (mapRef.linesSource?.value) {
            mapRef.linesSource.value.changed();
          }

          // Animation complete - store final feature
          const segment = layersStore.lineSegments.find((s) => s.id === lineId);
          if (segment) {
            segment.mapElementId = lineId;
          }

          // For intersection mode, show the intersection point marker
          if (
            mode === 'intersection' &&
            intersectLat &&
            intersectLon &&
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

    const coordinates = [fromLonLat([startLon, startLat]), fromLonLat([endLon, endLat])];

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

    // Update the line segment element's feature reference in the store
    const segment = layersStore.lineSegments.find((s) => s.id === lineId);
    if (segment) {
      segment.mapElementId = lineId;
    }

    // For intersection mode, show the intersection point marker
    if (mode === 'intersection' && intersectLat && intersectLon) {
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

    // Update the line segment element's feature reference in the store
    const segment = layersStore.lineSegments.find((s) => s.id === lineId);
    if (segment) {
      segment.mapElementId = lineId;
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
        intersectLat && intersectLon ? { lat: intersectLat, lon: intersectLon } : undefined,
      intersectionDistance: intersectDistance,
      color: DEFAULT_COLOR,
    } as LineSegmentElement;

    // Draw line as simple 2-point straight line
    const coordinates = [fromLonLat([startLon, startLat]), fromLonLat([endLon, endLat])];

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

    // Store feature ID
    lineElement.mapElementId = lineId;
    layersStore.storeMapElementId('lineSegment', lineId, lineId);

    // Add to store
    layersStore.addLineSegment(lineElement);

    // Add feature to map AFTER adding to store
    mapRef.linesSource.value.addFeature(feature);

    // For intersection mode, show the intersection point marker
    if (mode === 'intersection' && intersectLat && intersectLon) {
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
        const minLat = Math.min(startLat, endLat);
        const maxLat = Math.max(startLat, endLat);
        const minLon = Math.min(startLon, endLon);
        const maxLon = Math.max(startLon, endLon);
        const bounds: [[number, number], [number, number]] = [
          [minLat, minLon],
          [maxLat, maxLon],
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
    const coordinates = [fromLonLat([startLon, startLat]), fromLonLat([endLon, endLat])];

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
          color: DEFAULT_COLOR,
          width: 3,
        }),
      })
    );

    mapRef.linesSource.value.addFeature(newFeature);

    // For intersection mode, show the intersection point marker
    if (mode === 'intersection' && intersectLat && intersectLon) {
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

    // Store feature ID
    lineElement.mapElementId = lineId;
    layersStore.storeMapElementId('lineSegment', lineId, lineId);

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
          color: DEFAULT_COLOR,
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
