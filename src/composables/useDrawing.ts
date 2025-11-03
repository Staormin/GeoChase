/**
 * Composable for drawing shapes on the map (orchestrator)
 */

import L from 'leaflet';
import { useLayersStore } from '@/stores/layers';
import { useCircleDrawing } from './useCircleDrawing';
import { useLineDrawing } from './useLineDrawing';
import { usePointDrawing } from './usePointDrawing';
import { usePolygonDrawing } from './usePolygonDrawing';

export function useDrawing(mapRef: any) {
  const layersStore = useLayersStore();

  // Initialize specialized drawing composables
  const circleDrawing = useCircleDrawing(mapRef);
  const lineDrawing = useLineDrawing(mapRef);
  const pointDrawing = usePointDrawing(mapRef);
  const polygonDrawing = usePolygonDrawing(mapRef);

  // Update element visibility
  const updateElementVisibility = (
    elementType: string,
    elementId: string | undefined,
    visible: boolean
  ) => {
    if (!mapRef.map?.value || !elementId) {
      return;
    }

    const leafletId = layersStore.getLeafletId(elementType, elementId);
    if (!leafletId) {
      return;
    }

    let found = false;

    // First, try to find and toggle the layer if it's currently on the map
    mapRef.map.value.eachLayer((layer: any) => {
      if (L.stamp(layer) === leafletId) {
        found = true;
        if (visible) {
          // Layer is already visible, nothing to do
          return;
        } else {
          // Remove layer from map
          mapRef.map.value.removeLayer(layer);
        }
      }
    });

    // If we need to show the element but it wasn't found on the map, we need to redraw it
    if (visible && !found) {
      // Redraw the element based on its type (without adding to store)
      switch (elementType) {
        case 'circle': {
          const circle = layersStore.circles.find((c) => c.id === elementId);
          if (circle && circle.id) {
            circleDrawing.redrawCircleOnMap(
              circle.id,
              circle.center.lat,
              circle.center.lon,
              circle.radius
            );
          }

          break;
        }
        case 'lineSegment': {
          const segment = layersStore.lineSegments.find((s) => s.id === elementId);
          if (segment && segment.id && segment.mode === 'parallel') {
            // For parallel lines, redraw them using drawParallel
            lineDrawing.drawParallel(
              segment.longitude === undefined ? 0 : segment.longitude,
              segment.name
            );
          } else if (segment && segment.id && segment.endpoint) {
            lineDrawing.redrawLineSegmentOnMap(
              segment.id,
              segment.center.lat,
              segment.center.lon,
              segment.endpoint.lat,
              segment.endpoint.lon,
              segment.mode as 'coordinate' | 'azimuth' | 'intersection',
              segment.intersectionPoint?.lat,
              segment.intersectionPoint?.lon
            );
          }

          break;
        }
        case 'point': {
          const point = layersStore.points.find((p) => p.id === elementId);
          if (point && point.id) {
            pointDrawing.redrawPointOnMap(point.id, point.coordinates.lat, point.coordinates.lon);
          }

          break;
        }
        case 'polygon': {
          const polygon = layersStore.polygons.find((p) => p.id === elementId);
          if (polygon && polygon.id) {
            polygonDrawing.redrawPolygonOnMap(polygon.id, polygon.points, polygon.color);
          }

          break;
        }
        // No default
      }
    }

    // For intersection markers, also toggle their visibility
    if (elementType === 'lineSegment') {
      const className = `intersection-${elementId}`;
      const elements = document.querySelectorAll(`.${className}`);
      for (const el of elements) {
        const svgElement = el.closest('svg');
        if (svgElement) {
          svgElement.style.display = visible ? '' : 'none';
        }
      }
    }
  };

  // Helper to remove polygons affected by point deletion
  const removeAffectedPolygons = (deletedCoords: { lat: number; lon: number }) => {
    const polygonsToRemove: string[] = [];

    for (const polygon of layersStore.polygons) {
      const containsPoint = polygon.points.some(
        (p) =>
          Math.abs(p.lat - deletedCoords.lat) < 0.000_001 &&
          Math.abs(p.lon - deletedCoords.lon) < 0.000_001
      );

      if (containsPoint) {
        const remainingPoints = polygon.points.filter(
          (p) =>
            Math.abs(p.lat - deletedCoords.lat) >= 0.000_001 ||
            Math.abs(p.lon - deletedCoords.lon) >= 0.000_001
        );

        if (remainingPoints.length < 3 && polygon.id) {
          polygonsToRemove.push(polygon.id);
        }
      }
    }

    for (const polygonId of polygonsToRemove) {
      const polygon = layersStore.polygons.find((p) => p.id === polygonId);
      if (polygon && mapRef.map?.value) {
        if (polygon.leafletId !== undefined) {
          mapRef.map.value.eachLayer((layer: any) => {
            if (L.stamp(layer) === polygon.leafletId) {
              mapRef.map.value.removeLayer(layer);
            }
          });
        }
        mapRef.map.value.eachLayer((layer: any) => {
          const className = layer.options?.className;
          if (className && className.includes(`polygon-${polygonId}`)) {
            mapRef.map.value.removeLayer(layer);
          }
        });
      }
    }
  };

  // Helper to remove layer by leafletId
  const removeLayerById = (leafletId: number) => {
    if (!mapRef.map?.value) return;
    mapRef.map.value.eachLayer((layer: any) => {
      if (L.stamp(layer) === leafletId) {
        mapRef.map.value.removeLayer(layer);
      }
    });
  };

  // Delete element from map
  const deleteElement = (elementType: string, elementId: string | undefined) => {
    if (!mapRef.map?.value || !elementId) {
      return;
    }

    // Remove from map using Leaflet's layer management
    switch (elementType) {
      case 'circle': {
        const circle = layersStore.circles.find((c) => c.id === elementId);
        if (circle?.leafletId !== undefined) {
          removeLayerById(circle.leafletId);
        }
        break;
      }
      case 'lineSegment': {
        const segment = layersStore.lineSegments.find((s) => s.id === elementId);
        if (segment?.leafletId !== undefined) {
          removeLayerById(segment.leafletId);
        }

        // Also remove intersection marker if present
        mapRef.map.value.eachLayer((layer: any) => {
          const className = layer.options?.className;
          if (className?.includes(`intersection-${elementId}`)) {
            mapRef.map.value.removeLayer(layer);
          }
        });
        break;
      }
      case 'point': {
        const point = layersStore.points.find((p) => p.id === elementId);
        if (point?.leafletId !== undefined) {
          removeLayerById(point.leafletId);
        }

        if (point?.coordinates) {
          removeAffectedPolygons(point.coordinates);
        }
        break;
      }
      case 'polygon': {
        const polygon = layersStore.polygons.find((p) => p.id === elementId);
        if (polygon?.leafletId !== undefined) {
          removeLayerById(polygon.leafletId);
        }

        // Fallback: also try removing by className
        mapRef.map.value.eachLayer((layer: any) => {
          const className = layer.options?.className;
          if (className?.includes(`polygon-${elementId}`)) {
            mapRef.map.value.removeLayer(layer);
          }
        });
        break;
      }
      // No default
    }

    // Delete any notes linked to this element
    const linkedNotes = layersStore.notes.filter(
      (note) => note.linkedElementType === elementType && note.linkedElementId === elementId
    );
    for (const note of linkedNotes) {
      if (note.id) {
        layersStore.deleteNote(note.id);
      }
    }

    // Remove from store
    switch (elementType) {
      case 'circle': {
        layersStore.deleteCircle(elementId);
        break;
      }
      case 'lineSegment': {
        layersStore.deleteLineSegment(elementId);
        break;
      }
      case 'point': {
        layersStore.deletePoint(elementId);
        break;
      }
      case 'polygon': {
        layersStore.deletePolygon(elementId);
        break;
      }
      // No default
    }
  };

  // Clear all elements
  const clearAllElements = () => {
    layersStore.clearLayers();
    // Clear all FeatureGroups
    mapRef.circlesGroup?.value?.clearLayers();
    mapRef.linesGroup?.value?.clearLayers();
    mapRef.pointsGroup?.value?.clearLayers();
    mapRef.polygonsGroup?.value?.clearLayers();
  };

  // Redraw all elements on map (useful after loading project)
  // eslint-disable-next-line complexity
  const redrawAllElements = () => {
    // Clear only map layers using FeatureGroups, not the store (store is already populated)
    mapRef.circlesGroup?.value?.clearLayers();
    mapRef.linesGroup?.value?.clearLayers();
    mapRef.pointsGroup?.value?.clearLayers();
    mapRef.polygonsGroup?.value?.clearLayers();

    const circles = layersStore.circles;
    const lineSegments = layersStore.lineSegments;
    const points = layersStore.points;
    const polygons = layersStore.polygons;

    // Redraw circles (using redraw helper to avoid adding to store twice)
    for (const circle of circles) {
      if (circle.id) {
        circleDrawing.redrawCircleOnMap(
          circle.id,
          circle.center.lat,
          circle.center.lon,
          circle.radius,
          circle.color
        );
      }
    }

    // Redraw line segments (using redraw helper to avoid adding to store twice)
    for (const segment of lineSegments) {
      if (segment.id) {
        if (segment.mode === 'parallel' && segment.longitude !== undefined) {
          // Redraw parallel line
          lineDrawing.redrawParallelOnMap(segment.id, segment.longitude, segment.color);
        } else if (segment.endpoint) {
          // Redraw regular line segment
          lineDrawing.redrawLineSegmentOnMap(
            segment.id,
            segment.center.lat,
            segment.center.lon,
            segment.endpoint.lat,
            segment.endpoint.lon,
            segment.mode as 'coordinate' | 'azimuth' | 'intersection',
            segment.intersectionPoint?.lat,
            segment.intersectionPoint?.lon,
            segment.color
          );
        }
      }
    }

    // Redraw points (using redraw helper to avoid adding to store twice)
    for (const point of points) {
      if (point.id) {
        pointDrawing.redrawPointOnMap(
          point.id,
          point.coordinates.lat,
          point.coordinates.lon,
          point.color
        );
      }
    }

    // Redraw polygons (using redraw helper to avoid adding to store twice)
    for (const polygon of polygons) {
      if (polygon.id) {
        polygonDrawing.redrawPolygonOnMap(polygon.id, polygon.points, polygon.color);
      }
    }

    // Fly to all elements if any exist with animation
    if (
      (circles.length > 0 || lineSegments.length > 0 || points.length > 0 || polygons.length > 0) &&
      mapRef.flyToBounds
    ) {
      // Calculate bounds that include all elements
      let minLat = 90,
        maxLat = -90,
        minLon = 180,
        maxLon = -180;

      for (const circle of circles) {
        const lat = circle.center.lat;
        const lon = circle.center.lon;
        const radiusInDegrees = circle.radius / 111; // Approximate: 111km per degree
        minLat = Math.min(minLat, lat - radiusInDegrees);
        maxLat = Math.max(maxLat, lat + radiusInDegrees);
        minLon = Math.min(minLon, lon - radiusInDegrees);
        maxLon = Math.max(maxLon, lon + radiusInDegrees);
      }

      for (const segment of lineSegments) {
        minLat = Math.min(minLat, segment.center.lat, segment.endpoint?.lat || 90);
        maxLat = Math.max(maxLat, segment.center.lat, segment.endpoint?.lat || -90);
        minLon = Math.min(minLon, segment.center.lon, segment.endpoint?.lon || 180);
        maxLon = Math.max(maxLon, segment.center.lon, segment.endpoint?.lon || -180);
      }

      for (const point of points) {
        minLat = Math.min(minLat, point.coordinates.lat);
        maxLat = Math.max(maxLat, point.coordinates.lat);
        minLon = Math.min(minLon, point.coordinates.lon);
        maxLon = Math.max(maxLon, point.coordinates.lon);
      }

      for (const polygon of polygons) {
        for (const point of polygon.points) {
          minLat = Math.min(minLat, point.lat);
          maxLat = Math.max(maxLat, point.lat);
          minLon = Math.min(minLon, point.lon);
          maxLon = Math.max(maxLon, point.lon);
        }
      }

      if (minLat <= maxLat && minLon <= maxLon) {
        mapRef.flyToBounds([
          [minLat, minLon],
          [maxLat, maxLon],
        ]);
      }
    }
  };

  return {
    // Circle methods
    drawCircle: circleDrawing.drawCircle,
    updateCircle: circleDrawing.updateCircle,
    // Line methods
    drawLineSegment: lineDrawing.drawLineSegment,
    updateLineSegment: lineDrawing.updateLineSegment,
    drawParallel: lineDrawing.drawParallel,
    updateParallel: lineDrawing.updateParallel,
    // Point methods
    drawPoint: pointDrawing.drawPoint,
    // Polygon methods
    drawPolygon: polygonDrawing.drawPolygon,
    // Utility methods
    updateElementVisibility,
    deleteElement,
    clearAllElements,
    redrawAllElements,
  };
}
