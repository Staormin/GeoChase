/**
 * Composable for drawing shapes on the map (orchestrator)
 */

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

  // Helper to get source for element type
  const getSourceForElementType = (elementType: string) => {
    switch (elementType) {
      case 'circle': {
        return mapRef.circlesSource?.value;
      }
      case 'lineSegment': {
        return mapRef.linesSource?.value;
      }
      case 'point': {
        return mapRef.pointsSource?.value;
      }
      case 'polygon': {
        return mapRef.polygonsSource?.value;
      }
      default: {
        return null;
      }
    }
  };

  // Helper to remove element and associated overlays from map
  const removeElementFromMap = (elementType: string, elementId: string, source: any) => {
    const feature = source.getFeatureById(elementId);
    if (!feature) return;

    source.removeFeature(feature);

    // For points, also remove the label overlay
    if (elementType === 'point' && mapRef.map?.value) {
      const labelOverlay = mapRef.map.value
        .getOverlays()
        .getArray()
        .find((o: any) => o.get('id') === `label-${elementId}`);
      if (labelOverlay) {
        mapRef.map.value.removeOverlay(labelOverlay);
      }
    }
  };

  // Helper to redraw element on map
  const redrawElementOnMap = async (
    elementType: string,
    elementId: string,
    animate: boolean
  ): Promise<void> => {
    switch (elementType) {
      case 'circle': {
        const circle = layersStore.circles.find((c) => c.id === elementId);
        if (circle && circle.id) {
          circleDrawing.redrawCircleOnMap(
            circle.id,
            circle.center.lat,
            circle.center.lon,
            circle.radius,
            circle.color
          );
        }
        break;
      }
      case 'lineSegment': {
        const segment = layersStore.lineSegments.find((s) => s.id === elementId);
        if (segment && segment.id) {
          await redrawLineSegment(segment, elementId, animate);
        }
        break;
      }
      case 'point': {
        const point = layersStore.points.find((p) => p.id === elementId);
        if (point && point.id) {
          pointDrawing.redrawPointOnMap(
            point.id,
            point.coordinates.lat,
            point.coordinates.lon,
            point.color
          );
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
    }
  };

  // Helper to redraw line segment with optional animation
  const redrawLineSegment = async (segment: any, elementId: string, animate: boolean) => {
    // Handle parallel lines (horizontal lines at constant latitude)
    if (segment.mode === 'parallel' && segment.longitude !== undefined) {
      lineDrawing.redrawParallelOnMap(segment.id, segment.longitude, segment.color);
      return;
    }

    // Handle regular line segments (coordinate, azimuth, intersection modes)
    if (segment.endpoint) {
      if (animate) {
        await lineDrawing.animateLineSegmentOnMap(
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
      } else {
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
  };

  // Update element visibility
  const updateElementVisibility = async (
    elementType: string,
    elementId: string | undefined,
    visible: boolean,
    animate = false
  ) => {
    if (!mapRef.map?.value || !elementId) {
      return;
    }

    const source = getSourceForElementType(elementType);
    if (!source) {
      return;
    }

    const feature = source.getFeatureById(elementId);
    const found = !!feature;

    if (found && !visible) {
      removeElementFromMap(elementType, elementId, source);
    } else if (visible && !found) {
      await redrawElementOnMap(elementType, elementId, animate);
    }

    // For intersection markers, also toggle their visibility
    if (elementType === 'lineSegment') {
      const intersectionFeature = mapRef.linesSource?.value?.getFeatureById(
        `intersection-${elementId}`
      );
      if (intersectionFeature && !visible) {
        mapRef.linesSource.value.removeFeature(intersectionFeature);
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
      // Remove the feature from the polygons source
      if (mapRef.polygonsSource?.value) {
        const feature = mapRef.polygonsSource.value.getFeatureById(polygonId);
        if (feature) {
          mapRef.polygonsSource.value.removeFeature(feature);
        }
      }
    }
  };

  // Helper to remove feature by ID from source
  const removeFeatureById = (source: any, featureId: string) => {
    if (!source) return;
    const feature = source.getFeatureById(featureId);
    if (feature) {
      source.removeFeature(feature);
    }
  };

  // Delete element from map
  const deleteElement = (elementType: string, elementId: string | undefined) => {
    if (!mapRef.map?.value || !elementId) {
      return;
    }

    // Remove from map using OpenLayers feature management
    switch (elementType) {
      case 'circle': {
        removeFeatureById(mapRef.circlesSource?.value, elementId);
        break;
      }
      case 'lineSegment': {
        removeFeatureById(mapRef.linesSource?.value, elementId);

        // Also remove intersection marker if present
        removeFeatureById(mapRef.linesSource?.value, `intersection-${elementId}`);
        break;
      }
      case 'point': {
        removeFeatureById(mapRef.pointsSource?.value, elementId);

        // Also remove the label overlay
        const labelOverlay = mapRef.map.value
          .getOverlays()
          .getArray()
          .find((o: any) => o.get('id') === `label-${elementId}`);
        if (labelOverlay) {
          mapRef.map.value.removeOverlay(labelOverlay);
        }

        const point = layersStore.points.find((p) => p.id === elementId);
        if (point?.coordinates) {
          removeAffectedPolygons(point.coordinates);
        }
        break;
      }
      case 'polygon': {
        removeFeatureById(mapRef.polygonsSource?.value, elementId);
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
    // Clear all VectorSources
    mapRef.circlesSource?.value?.clear();
    mapRef.linesSource?.value?.clear();
    mapRef.pointsSource?.value?.clear();
    mapRef.polygonsSource?.value?.clear();

    // Clear all overlays (point labels)
    if (mapRef.map?.value) {
      const overlays = mapRef.map.value.getOverlays().getArray().slice();
      for (const overlay of overlays) {
        mapRef.map.value.removeOverlay(overlay);
      }
    }
  };

  // Redraw all elements on map (useful after loading project)
  // eslint-disable-next-line complexity
  const redrawAllElements = () => {
    // Clear only map layers using VectorSources, not the store (store is already populated)
    mapRef.circlesSource?.value?.clear();
    mapRef.linesSource?.value?.clear();
    mapRef.pointsSource?.value?.clear();
    mapRef.polygonsSource?.value?.clear();

    // Clear all overlays (point labels)
    if (mapRef.map?.value) {
      const overlays = mapRef.map.value.getOverlays().getArray().slice();
      for (const overlay of overlays) {
        mapRef.map.value.removeOverlay(overlay);
      }
    }

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
    // Skip if skipAutoFly flag is set (when restoring saved view data)
    if (
      (circles.length > 0 || lineSegments.length > 0 || points.length > 0 || polygons.length > 0) &&
      mapRef.flyToBoundsWithPanels &&
      !(mapRef as any).skipAutoFly
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
        mapRef.flyToBoundsWithPanels([
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
